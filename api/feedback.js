const ALLOWED_CATEGORIES = new Set(['incorrect', 'unclear', 'quiz']);
const ALLOWED_RISKS = new Set(['AN_TOAN', 'NGHI_NGO', 'NGUY_HIEM']);

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

module.exports = function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  const { category, risk } = request.body || {};
  if (!ALLOWED_CATEGORIES.has(category) || !ALLOWED_RISKS.has(risk)) {
    sendJson(response, 400, { error: { message: 'Invalid feedback.' } });
    return;
  }

  // Deliberately log only fixed enums. Never accept or store message content,
  // screenshots, phone numbers, account numbers, or free-text identifiers.
  console.info(JSON.stringify({
    event: 'scamcheck_feedback',
    category,
    risk,
    recordedAt: new Date().toISOString(),
  }));

  sendJson(response, 202, { ok: true });
};
