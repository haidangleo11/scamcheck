const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const { SCAMCHECK_RAG_VERSION, buildRagContext } = require('./rag-corpus');
const ALLOWED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
]);
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 12000;
const RAG_MODES = new Set(['message_analysis', 'extension_scan']);

function sendJson(response, status, payload) {
  response.status(status).json(payload);
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

  if (!process.env.GROQ_API_KEY) {
    sendJson(response, 503, { error: { message: 'AI service is not configured.' } });
    return;
  }

  const { model, messages, response_format: responseFormat, temperature, max_tokens: maxTokens, scamcheck_mode: scamcheckMode } = request.body || {};
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
  const rag = RAG_MODES.has(scamcheckMode) ? buildRagContext(lastUserMessage) : { matches: [], prompt: '' };
  const enrichedMessages = rag.prompt
    ? [...messages.slice(0, lastUserIndex), { role: 'system', content: rag.prompt }, ...messages.slice(lastUserIndex)]
    : messages;

  const payload = { model, messages: enrichedMessages };
  if (responseFormat?.type === 'json_object') payload.response_format = { type: 'json_object' };
  if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) payload.temperature = temperature;
  if (Number.isInteger(maxTokens) && maxTokens > 0 && maxTokens <= 2048) payload.max_tokens = maxTokens;

  try {
    const upstream = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      sendJson(response, upstream.status, {
        error: { message: data?.error?.message || 'The AI service could not complete the request.' },
      });
      return;
    }

    sendJson(response, 200, {
      ...data,
      scamcheckRag: {
        enabled: RAG_MODES.has(scamcheckMode),
        version: SCAMCHECK_RAG_VERSION,
        matches: rag.matches.map(({ id, title, category, risk, matchedSignals, score }) => ({ id, title, category, risk, matchedSignals, score }))
      }
    });
  } catch {
    sendJson(response, 502, { error: { message: 'The AI service is temporarily unavailable.' } });
  }
};
