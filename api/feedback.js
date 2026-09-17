const { createHash, randomBytes } = require('node:crypto');
const { isIP } = require('node:net');

const ALLOWED_CATEGORIES = new Set(['incorrect', 'unclear', 'quiz']);
const ALLOWED_RISKS = new Set(['AN_TOAN', 'NGHI_NGO', 'NGUY_HIEM']);
// Feedback has no account or message content, so this is intentionally a small
// per-process abuse guard rather than an identity or analytics system.
const FEEDBACK_RATE_LIMIT = { limit: 12, windowMs: 60 * 1000 };
const MAX_RATE_LIMIT_BUCKETS = 2048;
const RATE_LIMIT_SALT = randomBytes(16).toString('hex');
const rateLimitBuckets = new Map();
const FEEDBACK_SOURCE = 'web';
const SUPABASE_WRITE_TIMEOUT_MS = 4000;

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function getRequestHeader(request, name) {
  const headers = request?.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getRateLimitKey(request) {
  const forwardedFor = getRequestHeader(request, 'x-forwarded-for');
  const firstForwardedAddress = typeof forwardedFor === 'string'
    ? forwardedFor.split(',', 1)[0].trim().replace(/^\[|\]$/g, '')
    : '';
  const realIp = getRequestHeader(request, 'x-real-ip');
  const clientIp = (firstForwardedAddress.length <= 64 && isIP(firstForwardedAddress))
    ? firstForwardedAddress.toLowerCase()
    : (typeof realIp === 'string' && realIp.length <= 64 && isIP(realIp.trim())
      ? realIp.trim().toLowerCase()
      : 'unknown');

  // Do not retain raw IP addresses in memory or logs.
  return createHash('sha256').update(`${RATE_LIMIT_SALT}:${clientIp}`).digest('hex');
}

function takeRateLimit(request) {
  const now = Date.now();
  const key = getRateLimitKey(request);
  let bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
      for (const [existingKey, existingBucket] of rateLimitBuckets) {
        if (!existingBucket || existingBucket.resetAt <= now) rateLimitBuckets.delete(existingKey);
      }
      // The map only stores a brief, salted rate-limit key. If it is still
      // full after pruning, make room instead of allowing unbounded memory use.
      if (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
        rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
      }
    }
    bucket = { count: 0, resetAt: now + FEEDBACK_RATE_LIMIT.windowMs };
    rateLimitBuckets.set(key, bucket);
  }

  if (bucket.count >= FEEDBACK_RATE_LIMIT.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

function isValidFeedback(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  if (keys.length !== 2 || keys.some(key => key !== 'category' && key !== 'risk')) return false;
  return ALLOWED_CATEGORIES.has(body.category) && ALLOWED_RISKS.has(body.risk);
}

function getFeedbackPersistenceConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
    return { url: parsed.href.replace(/\/$/, ''), serviceRoleKey };
  } catch {
    return null;
  }
}

async function persistFeedbackIfConfigured(category, risk) {
  const config = getFeedbackPersistenceConfig();
  if (!config || typeof fetch !== 'function') return;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), SUPABASE_WRITE_TIMEOUT_MS)
    : null;

  try {
    const upstream = await fetch(`${config.url}/rest/v1/analysis_feedback`, {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      // Source is deliberately fixed server-side. The browser can submit only
      // the two validated enum fields and never gets the service-role key.
      body: JSON.stringify({ source: FEEDBACK_SOURCE, category, risk }),
      signal: controller?.signal,
    });
    if (!upstream.ok) {
      console.warn(JSON.stringify({
        event: 'scamcheck_feedback_persistence_fallback',
        reason: `http_${upstream.status}`,
      }));
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'scamcheck_feedback_persistence_fallback',
      reason: error?.name === 'AbortError' ? 'timeout' : 'request_failed',
    }));
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

module.exports = async function handler(request, response) {
  // The web app and the extension can use a central endpoint. This endpoint
  // accepts only fixed enum values and never receives cookies or credentials.
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    sendJson(response, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  if (!isValidFeedback(request.body)) {
    sendJson(response, 400, { error: { message: 'Invalid feedback.' } });
    return;
  }

  const rateLimit = takeRateLimit(request);
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendJson(response, 429, {
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many feedback requests. Please try again shortly.',
        retryAfter: rateLimit.retryAfterSeconds,
      },
    });
    return;
  }

  const { category, risk } = request.body;

  // Deliberately log only fixed enums. Never accept or store message content,
  // screenshots, phone numbers, account numbers, or free-text identifiers.
  console.info(JSON.stringify({
    event: 'scamcheck_feedback',
    source: FEEDBACK_SOURCE,
    category,
    risk,
    recordedAt: new Date().toISOString(),
  }));

  // Persistence is optional. If the secure server-only key or migration is
  // unavailable, the already-recorded privacy-safe console event remains the
  // fallback and the user still receives a successful acknowledgement.
  await persistFeedbackIfConfigured(category, risk);

  sendJson(response, 202, { ok: true });
};
