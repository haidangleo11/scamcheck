const assert = require('node:assert/strict');

const handler = require('../api/feedback');

function invoke({ method = 'POST', body, headers = {} } = {}) {
  const output = { headers: {}, statusCode: null, body: null, ended: false };
  const response = {
    setHeader(name, value) {
      output.headers[String(name).toLowerCase()] = value;
      return this;
    },
    status(statusCode) {
      output.statusCode = statusCode;
      return this;
    },
    json(bodyValue) {
      output.body = bodyValue;
      return this;
    },
    end() {
      output.ended = true;
      return this;
    },
  };

  return Promise.resolve(handler({ method, body, headers }, response)).then(() => output);
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function main() {
  const originalFetch = global.fetch;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const warnings = [];
  console.info = () => {};
  console.warn = value => warnings.push(String(value));

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const preflight = await invoke({ method: 'OPTIONS' });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], '*');
    assert.equal(preflight.headers['cache-control'], 'no-store');

    const invalid = await invoke({ body: { category: 'incorrect', risk: 'AN_TOAN', message: 'must not be accepted' } });
    assert.equal(invalid.statusCode, 400);

    const consoleFallback = await invoke({
      body: { category: 'incorrect', risk: 'NGUY_HIEM' },
      headers: { 'x-forwarded-for': '198.51.100.10' },
    });
    assert.equal(consoleFallback.statusCode, 202);

    const calls = [];
    process.env.SUPABASE_URL = 'https://project-ref.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 201 };
    };
    const persisted = await invoke({
      body: { category: 'unclear', risk: 'NGHI_NGO' },
      headers: { 'x-forwarded-for': '198.51.100.11' },
    });
    assert.equal(persisted.statusCode, 202);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://project-ref.supabase.co/rest/v1/analysis_feedback');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      source: 'web',
      category: 'unclear',
      risk: 'NGHI_NGO',
    });
    assert.equal(calls[0].options.headers.apikey, 'test-service-role-key');

    global.fetch = async () => ({ ok: false, status: 404 });
    const migrationFallback = await invoke({
      body: { category: 'quiz', risk: 'AN_TOAN' },
      headers: { 'x-forwarded-for': '198.51.100.12' },
    });
    assert.equal(migrationFallback.statusCode, 202);
    assert.ok(warnings.some(value => value.includes('scamcheck_feedback_persistence_fallback')));

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    global.fetch = originalFetch;
    for (let index = 0; index < 12; index += 1) {
      const response = await invoke({
        body: { category: 'incorrect', risk: 'AN_TOAN' },
        headers: { 'x-forwarded-for': '198.51.100.13' },
      });
      assert.equal(response.statusCode, 202);
    }
    const limited = await invoke({
      body: { category: 'incorrect', risk: 'AN_TOAN' },
      headers: { 'x-forwarded-for': '198.51.100.13' },
    });
    assert.equal(limited.statusCode, 429);
    assert.match(String(limited.headers['retry-after']), /^\d+$/);

    originalInfo('Feedback API tests: OK');
  } finally {
    global.fetch = originalFetch;
    console.info = originalInfo;
    console.warn = originalWarn;
    restoreEnv('SUPABASE_URL', originalSupabaseUrl);
    restoreEnv('SUPABASE_SERVICE_ROLE_KEY', originalServiceRoleKey);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
