const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const { SCAMCHECK_RAG_VERSION, buildRagContext, buildScamCatalogPrompt } = require('../lib/rag-corpus');
const ALLOWED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
]);
const DEFAULT_ANALYSIS_MODEL = 'openai/gpt-oss-120b';
const AUTO_GUARD_MODEL = 'openai/gpt-oss-20b';
const OPENAI_ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-5.4-mini';
const OPENAI_AUTO_GUARD_MODEL = process.env.OPENAI_AUTO_GUARD_MODEL || 'gpt-5.6-luna';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 12000;
const RAG_MODES = new Set(['message_analysis', 'extension_scan', 'auto_guard']);
const PROVIDER_TIMEOUTS_MS = {
  groq: { autoGuard: 6000, analysis: 9000 },
  openai: { autoGuard: 20000, analysis: 25000 },
};

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function canFallbackFromGroq(upstream, networkError) {
  // Only fail over for quota/rate limits, a Groq service failure, or a network
  // failure. Invalid requests must remain visible rather than being retried on
  // OpenAI and generating an unnecessary second charge.
  return networkError || upstream?.status === 429 || upstream?.status >= 500;
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

function buildOpenAiPayload(basePayload, isAutoGuard) {
  const { max_tokens: maxTokens, ...payloadWithoutGroqLimit } = basePayload;
  const payload = {
    ...payloadWithoutGroqLimit,
    model: isAutoGuard ? OPENAI_AUTO_GUARD_MODEL : OPENAI_ANALYSIS_MODEL,
  };
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

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  if (!hasGroq && !hasOpenAi) {
    sendJson(response, 503, { error: { message: 'AI service is not configured.' } });
    return;
  }

  const { model, messages, response_format: responseFormat, temperature, max_tokens: maxTokens, scamcheck_mode: scamcheckMode, language } = request.body || {};
  if (!ALLOWED_MODELS.has(model) || !Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
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
  const responseLanguage = language === 'en' ? 'en' : 'vi';
  const rag = RAG_MODES.has(scamcheckMode) ? buildRagContext(lastUserMessage) : { matches: [], prompt: '' };
  // Keep the full catalogue at the start of Auto Guard's system context. Groq
  // can then cache this identical prefix between page checks; the retrieved,
  // message-specific context stays after it.
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

  // Keep the website's regular analysis model unchanged, while Auto Guard has
  // its own lighter model and therefore its own Groq model quota.
  const apiModel = isAutoGuard ? AUTO_GUARD_MODEL : DEFAULT_ANALYSIS_MODEL;

  const groqPayload = { model: apiModel, messages: enrichedMessages };
  if (responseFormat?.type === 'json_object') groqPayload.response_format = { type: 'json_object' };
  if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) groqPayload.temperature = temperature;
  if (Number.isInteger(maxTokens) && maxTokens > 0 && maxTokens <= 2048) groqPayload.max_tokens = maxTokens;
  if (isAutoGuard) groqPayload.reasoning_effort = 'low';

  const openAiPayload = buildOpenAiPayload(groqPayload, isAutoGuard);
  const groqTimeout = isAutoGuard ? PROVIDER_TIMEOUTS_MS.groq.autoGuard : PROVIDER_TIMEOUTS_MS.groq.analysis;
  const openAiTimeout = isAutoGuard ? PROVIDER_TIMEOUTS_MS.openai.autoGuard : PROVIDER_TIMEOUTS_MS.openai.analysis;
  const sendSuccess = (data, provider, fallbackUsed) => {
    sendJson(response, 200, enrichSuccess(data, rag, scamcheckMode, isAutoGuard, provider, fallbackUsed));
  };
  const sendProviderError = (upstream, data) => {
    sendJson(response, upstream?.status || 502, {
      error: { message: data?.error?.message || 'The AI service could not complete the request.' },
    });
  };

  // Groq is the primary provider. OpenAI is contacted only after a recoverable
  // Groq failure, so ordinary requests do not consume OpenAI credits.
  if (hasGroq) {
    let groqResult;
    let groqNetworkError = false;
    try {
      groqResult = await callChatProvider(GROQ_API_URL, process.env.GROQ_API_KEY, groqPayload, groqTimeout);
    } catch {
      groqNetworkError = true;
    }

    if (groqResult?.upstream.ok) {
      sendSuccess(groqResult.data, 'groq', false);
      return;
    }

    if (!hasOpenAi || !canFallbackFromGroq(groqResult?.upstream, groqNetworkError)) {
      sendProviderError(groqResult?.upstream, groqResult?.data);
      return;
    }

    try {
      const openAiResult = await callChatProvider(OPENAI_API_URL, process.env.OPENAI_API_KEY, openAiPayload, openAiTimeout);
      if (openAiResult.upstream.ok) {
        sendSuccess(openAiResult.data, 'openai', true);
        return;
      }
      sendProviderError(openAiResult.upstream, openAiResult.data);
      return;
    } catch {
      sendJson(response, 502, { error: { message: 'Both AI providers are temporarily unavailable.' } });
      return;
    }
  }

  // OpenAI can also serve as the primary provider when Groq is intentionally
  // removed or temporarily not configured in the Vercel environment.
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
