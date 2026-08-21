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

function sendJson(response, status, payload) {
  response.status(status).json(payload);
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

function buildOpenAiPayload({ messages, responseFormat, temperature, maxTokens }, isAutoGuard) {
  const payload = {
    model: isAutoGuard ? OPENAI_AUTO_GUARD_MODEL : OPENAI_ANALYSIS_MODEL,
    messages,
  };
  if (responseFormat?.type === 'json_object') payload.response_format = { type: 'json_object' };
  if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) payload.temperature = temperature;
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
    temperature,
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
