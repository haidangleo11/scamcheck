const { createHash, randomBytes } = require('node:crypto');
const { isIP } = require('node:net');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const { SCAMCHECK_RAG_VERSION, buildRagContext, buildScamCatalogPrompt } = require('../lib/rag-corpus');
// The older client identifiers remain valid so already-installed extensions
// keep working, but the backend ignores them and always selects OpenAI below.
const ALLOWED_CLIENT_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'scamcheck-openai',
]);
const OPENAI_ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-5.4-mini';
const OPENAI_AUTO_GUARD_MODEL = process.env.OPENAI_AUTO_GUARD_MODEL || 'gpt-5.6-luna';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 12000;
const RAG_MODES = new Set(['message_analysis', 'extension_scan', 'auto_guard']);
const PROVIDER_TIMEOUTS_MS = {
  autoGuard: 25000,
  analysis: 30000,
};
// This is intentionally a process-local, best-effort limiter. Serverless
// instances do not share memory, so it is an abuse/cost guard rather than an
// account-level quota. Keep automated page checks less restrictive than an
// explicit user analysis, while still bounding provider usage.
const RATE_LIMIT_POLICIES = {
  analysis: { limit: 12, windowMs: 60 * 1000 },
  autoGuard: { limit: 30, windowMs: 60 * 1000 },
};
const MAX_RATE_LIMIT_BUCKETS = 4096;
const RATE_LIMIT_PRUNE_INTERVAL_MS = 60 * 1000;
const RATE_LIMIT_SALT = randomBytes(16).toString('hex');
const rateLimitBuckets = new Map();
let lastRateLimitPruneAt = 0;

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function getRequestHeader(request, name) {
  const headers = request?.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeIpAddress(value) {
  if (typeof value !== 'string') return '';
  // Proxies commonly provide a comma-separated X-Forwarded-For chain. The
  // first address is the original visitor and X-Real-IP is the fallback.
  const address = value.trim().replace(/^\[|\]$/g, '');
  return address.length <= 64 && isIP(address) ? address.toLowerCase() : '';
}

function getClientRateLimitKey(request) {
  const forwardedFor = getRequestHeader(request, 'x-forwarded-for');
  const forwardedAddress = typeof forwardedFor === 'string' ? forwardedFor.split(',', 1)[0] : '';
  const clientIp = normalizeIpAddress(forwardedAddress)
    || normalizeIpAddress(getRequestHeader(request, 'x-real-ip'))
    || 'unknown';

  // Do not retain a raw address as the Map key. The per-process salt keeps
  // this ephemeral key from being useful outside the running instance.
  return createHash('sha256').update(`${RATE_LIMIT_SALT}:${clientIp}`).digest('hex');
}

function pruneRateLimitBuckets(now, force = false) {
  if (!force && now - lastRateLimitPruneAt < RATE_LIMIT_PRUNE_INTERVAL_MS) return;
  for (const [key, bucket] of rateLimitBuckets) {
    if (!bucket || bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }
  lastRateLimitPruneAt = now;
}

function ensureRateLimitCapacity(now) {
  pruneRateLimitBuckets(now);
  if (rateLimitBuckets.size < MAX_RATE_LIMIT_BUCKETS) return;

  // A full store should never grow without bound. Expire anything possible,
  // then evict the bucket that will reset soonest to make space for a new IP.
  pruneRateLimitBuckets(now, true);
  while (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    let soonestKey = null;
    let soonestResetAt = Infinity;
    for (const [key, bucket] of rateLimitBuckets) {
      if (bucket.resetAt < soonestResetAt) {
        soonestKey = key;
        soonestResetAt = bucket.resetAt;
      }
    }
    if (!soonestKey) return;
    rateLimitBuckets.delete(soonestKey);
  }
}

function takeRateLimit(request, policyName) {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const key = `${policyName}:${getClientRateLimitKey(request)}`;
  let bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket) ensureRateLimitCapacity(now);
    bucket = { count: 0, resetAt: now + policy.windowMs };
    rateLimitBuckets.set(key, bucket);
  }

  if (bucket.count >= policy.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

function sendRateLimitExceeded(response, retryAfterSeconds) {
  response.setHeader('Retry-After', String(retryAfterSeconds));
  response.setHeader('Cache-Control', 'no-store');
  sendJson(response, 429, {
    error: {
      code: 'rate_limit_exceeded',
      message: 'Too many ScamCheck requests. Please try again shortly.',
      retryAfter: retryAfterSeconds,
    },
  });
}

async function callChatProvider(url, apiKey, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => null);
    return { upstream, data };
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiPayload({ messages, responseFormat, maxTokens }, isAutoGuard) {
  const payload = {
    model: isAutoGuard ? OPENAI_AUTO_GUARD_MODEL : OPENAI_ANALYSIS_MODEL,
    messages,
  };
  if (responseFormat?.type === 'json_object') payload.response_format = { type: 'json_object' };
  // The configured GPT-5 family models use their default sampling behaviour
  // and reject non-default temperature values on Chat Completions.
  // GPT-5 models use max_completion_tokens on the Chat Completions endpoint.
  if (maxTokens) payload.max_completion_tokens = maxTokens;
  if (isAutoGuard) payload.reasoning_effort = 'low';
  return payload;
}

function enrichSuccess(data, rag, scamcheckMode, isAutoGuard, provider, fallbackUsed) {
  return {
    ...data,
    scamcheckProvider: {
      provider,
      fallbackUsed,
    },
    scamcheckRag: {
      enabled: RAG_MODES.has(scamcheckMode),
      version: SCAMCHECK_RAG_VERSION,
      catalogIncluded: isAutoGuard,
      matches: rag.matches.map(({ id, title, category, risk, matchedSignals, score }) => ({ id, title, category, risk, matchedSignals, score }))
    }
  };
}

module.exports = async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Expose-Headers', 'Retry-After');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  if (!hasOpenAi) {
    sendJson(response, 503, { error: { message: 'OpenAI service is not configured.' } });
    return;
  }

  const { model, messages, response_format: responseFormat, temperature, max_tokens: maxTokens, scamcheck_mode: scamcheckMode, language } = request.body || {};
  if (!ALLOWED_CLIENT_MODELS.has(model) || !Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    sendJson(response, 400, { error: { message: 'Invalid AI request.' } });
    return;
  }

  const validMessages = messages.every(({ role, content }) =>
    ['system', 'user', 'assistant'].includes(role)
    && typeof content === 'string'
    && content.length > 0
    && content.length <= MAX_MESSAGE_LENGTH,
  );
  if (!validMessages) {
    sendJson(response, 400, { error: { message: 'Invalid AI messages.' } });
    return;
  }

  const lastUserIndex = messages.map(message => message.role).lastIndexOf('user');
  const lastUserMessage = lastUserIndex >= 0 ? messages[lastUserIndex].content : '';
  const isAutoGuard = scamcheckMode === 'auto_guard';
  const rateLimit = takeRateLimit(request, isAutoGuard ? 'autoGuard' : 'analysis');
  if (!rateLimit.allowed) {
    sendRateLimitExceeded(response, rateLimit.retryAfterSeconds);
    return;
  }
  const responseLanguage = language === 'en' ? 'en' : 'vi';
  const rag = RAG_MODES.has(scamcheckMode) ? buildRagContext(lastUserMessage) : { matches: [], prompt: '' };
  // Keep the full catalogue at the start of Auto Guard's system context; the
  // retrieved, message-specific context stays after it.
  const systemContext = (isAutoGuard
    ? [
      buildScamCatalogPrompt(),
      responseLanguage === 'en'
        ? 'LANGUAGE REQUIREMENT: Return every human-readable value in English only.'
        : 'YÊU CẦU NGÔN NGỮ: Mọi nội dung người dùng nhìn thấy trong JSON, gồm summary, redFlags và safeActions, phải hoàn toàn bằng tiếng Việt có dấu. Không dùng tiếng Anh, dù nội dung đang quét là tiếng Anh.',
      rag.prompt
    ]
    : [rag.prompt]
  ).filter(Boolean).join('\n\n');
  const enrichedMessages = systemContext
    ? [...messages.slice(0, lastUserIndex), { role: 'system', content: systemContext }, ...messages.slice(lastUserIndex)]
    : messages;

  const openAiPayload = buildOpenAiPayload({
    messages: enrichedMessages,
    responseFormat,
    maxTokens: Number.isInteger(maxTokens) && maxTokens > 0 && maxTokens <= 2048 ? maxTokens : undefined,
  }, isAutoGuard);
  const openAiTimeout = isAutoGuard ? PROVIDER_TIMEOUTS_MS.autoGuard : PROVIDER_TIMEOUTS_MS.analysis;
  const sendSuccess = (data, provider, fallbackUsed) => {
    sendJson(response, 200, enrichSuccess(data, rag, scamcheckMode, isAutoGuard, provider, fallbackUsed));
  };
  const sendProviderError = (upstream, data) => {
    sendJson(response, upstream?.status || 502, {
      error: { message: data?.error?.message || 'The AI service could not complete the request.' },
    });
  };

  // OpenAI is the only production provider for every website and extension
  // request. No Groq key, endpoint, quota, or fallback is used here.
  try {
    const openAiResult = await callChatProvider(OPENAI_API_URL, process.env.OPENAI_API_KEY, openAiPayload, openAiTimeout);
    if (openAiResult.upstream.ok) {
      sendSuccess(openAiResult.data, 'openai', false);
      return;
    }
    sendProviderError(openAiResult.upstream, openAiResult.data);
  } catch {
    sendJson(response, 502, { error: { message: 'The AI service is temporarily unavailable.' } });
  }
};
