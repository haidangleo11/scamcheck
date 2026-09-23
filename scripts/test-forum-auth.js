/* Offline regression tests for the Forum's real inline authentication code. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.SCAMCHECK_FORUM_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing Forum source boundaries: ${start}`);
  return html.slice(from, to);
}
const actualSource = sourceBetween('const FORUM_SUPABASE_URL', 'let lastDirectLinkCheck')
  + '\n' + sourceBetween('function getForumToken()', 'function getTabFromLocation()');
const USER_ID = '11111111-1111-4111-8111-111111111111';
function tokenFor(name = 'Member') {
  return 'test.' + Buffer.from(JSON.stringify({
    sub: USER_ID, exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'member@example.invalid', user_metadata: { display_name: name },
  })).toString('base64url') + '.signature';
}
const TOKEN = tokenFor();
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function until(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('Expected asynchronous Forum operation did not start');
}

function harness(options = {}) {
  const values = new Map();
  const elements = new Map();
  const calls = [];
  const timers = new Map();
  const messages = [];
  let timerId = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: '', value: '', disabled: false, className: '',
      get textContent() { return this._textContent || ''; },
      set textContent(value) {
        this._textContent = value;
        if (id === 'forumStatus') messages.push(value);
      },
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      setAttribute() {}, querySelectorAll() { return []; },
    });
    return elements.get(id);
  }
  element('forumEmail').value = 'member@example.invalid';
  element('forumPassword').value = 'only-a-test-password';
  const count = kind => calls.filter(call => call.kind === kind).length;
  const profile = { id: USER_ID, display_name: 'Member', role: 'member', forum_status: 'active', ...options.profile };
  const context = vm.createContext({
    console: { warn() {}, error() {}, log() {} },
    AbortController, URL, URLSearchParams, TypeError, Error,
    sessionStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    },
    document: { getElementById: element, querySelectorAll: () => [] },
    window: {
      APP_CONFIG: { SUPABASE_URL: 'https://forum.test.invalid', SUPABASE_PUBLISHABLE_KEY: 'public-test-key' },
      location: { pathname: '/forum', search: '', hash: '' },
      atob: value => Buffer.from(value, 'base64').toString('binary'),
      setTimeout(callback, milliseconds) {
        const id = ++timerId;
        timers.set(id, { callback, milliseconds });
        // Network deadlines stay controllable; short retry delays need no real wait.
        if (milliseconds < 12000) queueMicrotask(() => {
          if (timers.delete(id)) callback();
        });
        return id;
      },
      clearTimeout(id) { timers.delete(id); },
    },
    async fetch(url, request = {}) {
      const requestPath = new URL(url).pathname;
      const kind = requestPath === '/auth/v1/token' ? 'password'
        : requestPath === '/rest/v1/profiles' ? 'profile'
          : requestPath === '/rest/v1/posts' ? 'feed' : 'other';
      calls.push({ kind, url, request });
      function timeoutRequest() {
        const deadline = [...timers.values()].reverse().find(timer => timer.milliseconds >= 12000);
        assert.ok(deadline, `${kind} request must have a deadline`);
        return new Promise((resolve, reject) => {
          request.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
          deadline.callback();
        });
      }
      if (kind === 'password') {
        const result = options.onPassword ? await options.onPassword(count(kind), request) : undefined;
        if (result === 'timeout') return timeoutRequest();
        return result || options.passwordResponse || response(200, {
          access_token: TOKEN, refresh_token: 'test-refresh', user: { id: USER_ID },
        });
      }
      if (kind === 'profile') {
        const result = options.onProfile ? await options.onProfile(count(kind), request) : undefined;
        if (result === 'timeout') return timeoutRequest();
        return result || response(200, [profile]);
      }
      if (kind === 'feed') return options.onFeed ? options.onFeed(count(kind), request) : response(200, []);
      throw new Error(`Unexpected endpoint in offline Forum test: ${requestPath}`);
    },
  });
  vm.runInContext(`
    let forumCategoryFilter = 'all';
    let currentLanguage = 'en';
    function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'); }
    function getForumCopy() { return new Proxy({}, { get: (_, key) => String(key) }); }
    function getAdminCopy() { return new Proxy({}, { get: (_, key) => String(key) }); }
  ` + actualSource, context, { filename: 'index.html:Forum' });
  return {
    calls, count, element, messages,
    run: expression => vm.runInContext(expression, context),
    submit: () => vm.runInContext('submitForumAuth({ preventDefault() {} })', context),
    token: () => vm.runInContext('getForumToken()', context),
    user: () => vm.runInContext('forumUser', context),
    render: force => vm.runInContext(`renderForum(${Boolean(force)})`, context),
    save: token => { context.__testToken = token; vm.runInContext('saveForumSession(__testToken, "test-refresh")', context); },
  };
}

test('password authentication returns a session without fetching the profile', async () => {
  const app = harness();
  const result = await app.run(`forumRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'member@example.invalid', password: 'only-a-test-password' }) })`);
  assert.equal(result.token, TOKEN);
  assert.equal(result.refreshToken, 'test-refresh');
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 0);
});

test('one successful submission saves the session before exactly one profile query', async () => {
  let app;
  app = harness({ onProfile: () => {
    assert.equal(app.token(), TOKEN, 'Persist authentication before reading the database');
  } });
  await app.submit();
  assert.equal(app.token(), TOKEN);
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 1);
  assert.equal(app.count('feed'), 1);
  assert.match(app.element('forumArea').innerHTML, /welcome/);
});

for (const failure of ['timeout', 'network', 502, 503, 504]) {
  test(`first profile ${failure} is retried within the same login`, async () => {
    const app = harness({ onProfile: attempt => {
      if (attempt > 1) return undefined;
      if (failure === 'network') throw new TypeError('Failed to fetch');
      return failure === 'timeout' ? 'timeout' : response(failure, { message: 'Temporary failure' });
    } });
    await app.submit();
    assert.equal(app.token(), TOKEN);
    assert.equal(app.count('password'), 1, 'Never retry a password POST');
    assert.equal(app.count('profile'), 2);
    assert.equal(app.count('feed'), 1);
    assert.match(app.element('forumArea').innerHTML, /welcome/);
  });
}

test('persistent profile failure retains authentication and offers a bounded retry', async () => {
  const app = harness({ onProfile: () => response(503, { message: 'Database unavailable' }) });
  await app.submit();
  assert.equal(app.token(), TOKEN);
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 2);
  assert.equal(app.count('feed'), 0);
  assert.match(app.element('forumArea').innerHTML, /retry/);
  assert.doesNotMatch(app.element('forumArea').innerHTML, /id="forumAuthForm"/);
});

test('wrong credentials are shown once without saving a session or querying data', async () => {
  const app = harness({ passwordResponse: response(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
  await app.submit();
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 0);
  assert.equal(app.token(), '');
  assert.equal(app.element('forumStatus').textContent, 'invalidLogin');
  assert.equal(app.element('forumAuthSubmit').disabled, false);
});

test('retry after a database outage reuses the saved session without another password submission', async () => {
  const app = harness({ onProfile: attempt => attempt <= 2 ? response(503, { message: 'Unavailable' }) : undefined });
  await app.submit();
  assert.match(app.element('forumArea').innerHTML, /signedInLoadingError/);
  await app.render(true);
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 3);
  assert.equal(app.token(), TOKEN);
  assert.match(app.element('forumArea').innerHTML, /welcome/);
});

test('temporary feed failure retries data without repeating authentication or the profile query', async () => {
  const app = harness({ onFeed: attempt => attempt === 1 ? response(503, { message: 'Unavailable' }) : response(200, []) });
  await app.submit();
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 1);
  assert.equal(app.count('feed'), 2);
  assert.match(app.element('forumArea').innerHTML, /welcome/);
});

test('a data permission error is not treated as an incorrect password or invalid session', async () => {
  const app = harness({ onProfile: () => response(403, { message: 'Forbidden' }) });
  await app.submit();
  assert.equal(app.token(), TOKEN);
  assert.equal(app.count('password'), 1);
  assert.equal(app.count('profile'), 1);
  assert.equal(app.count('feed'), 0);
  assert.match(app.element('forumArea').innerHTML, /signedInLoadingError/);
  assert.doesNotMatch(app.element('forumArea').innerHTML, /id="forumAuthForm"/);
});

test('a suspended member remains blocked before the feed loads', async () => {
  const app = harness({ profile: { forum_status: 'suspended' } });
  await app.submit();
  assert.equal(app.token(), TOKEN);
  assert.equal(app.user().forumStatus, 'suspended');
  assert.equal(app.count('feed'), 0);
  assert.match(app.element('forumArea').innerHTML, /suspendedTitle/);
});

test('a moderator retains the verified role after the first login', async () => {
  const app = harness({ profile: { role: 'moderator' } });
  await app.submit();
  assert.equal(app.user().role, 'moderator');
  assert.match(app.element('forumArea').innerHTML, /href="\/admin"/);
  assert.equal(app.count('profile'), 1);
});

test('late profile completion cannot restore a signed-out member', async () => {
  const pending = deferred();
  const app = harness({ onProfile: () => pending.promise });
  app.save(TOKEN);
  const oldRender = app.render();
  await until(() => app.count('profile') === 1);
  app.run('forumSignOut()');
  await until(() => /id="forumAuthForm"/.test(app.element('forumArea').innerHTML));
  pending.resolve(response(200, [{ id: USER_ID, display_name: 'Old member', role: 'member', forum_status: 'active' }]));
  await oldRender;
  assert.equal(app.token(), '');
  assert.equal(app.user(), null);
  assert.match(app.element('forumArea').innerHTML, /id="forumAuthForm"/);
});

test('an obsolete render cannot clear a newer successful session', async () => {
  const pending = deferred();
  const app = harness({ onProfile: attempt => attempt === 1 ? pending.promise : undefined });
  app.save(tokenFor('Old session'));
  const oldRender = app.render();
  await until(() => app.count('profile') === 1);
  app.save(TOKEN);
  await app.render();
  pending.resolve(response(401, { message: 'Expired old token' }));
  await oldRender;
  assert.equal(app.token(), TOKEN);
  assert.equal(app.user().displayName, 'Member');
  assert.match(app.element('forumArea').innerHTML, /welcome/);
});

test('a newer render takes precedence over an earlier slow render', async () => {
  const pending = deferred();
  const app = harness({ onProfile: attempt => attempt === 1 ? pending.promise : response(200, [
    { id: USER_ID, display_name: 'Current profile', role: 'member', forum_status: 'active' },
  ]) });
  app.save(TOKEN);
  const oldRender = app.render(true);
  await until(() => app.count('profile') === 1);
  await app.render(true);
  pending.resolve(response(200, [{ id: USER_ID, display_name: 'Outdated profile', role: 'member', forum_status: 'active' }]));
  await oldRender;
  assert.equal(app.user().displayName, 'Current profile');
  assert.match(app.element('forumArea').innerHTML, /Current profile/);
  assert.doesNotMatch(app.element('forumArea').innerHTML, /Outdated profile/);
  const cachedUser = await app.run('getForumUser()');
  assert.equal(cachedUser.displayName, 'Current profile');
});

for (const failure of ['timeout', 'network', 408, 502, 503, 504]) {
  test(`first password ${failure} recovers within one sign-in submission`, async () => {
    const app = harness({ onPassword: attempt => {
      if (attempt > 1) return undefined;
      if (failure === 'network') throw new TypeError('Failed to fetch');
      return failure === 'timeout' ? 'timeout' : response(failure, { message: 'Temporary failure' });
    } });
    await app.submit();
    assert.equal(app.count('password'), 2);
    assert.equal(app.token(), TOKEN);
    assert.equal(app.count('profile'), 1);
    assert.equal(app.count('feed'), 1);
    assert.ok(app.messages.includes('retryingSignIn'), 'Explain the automatic recovery while waiting');
    assert.match(app.element('forumArea').innerHTML, /welcome/);
  });
}

test('persistent password timeout stops after two attempts and restores the button', async () => {
  const app = harness({ onPassword: () => 'timeout' });
  await app.submit();
  assert.equal(app.count('password'), 2);
  assert.equal(app.token(), '');
  assert.equal(app.count('profile'), 0);
  assert.equal(app.element('forumStatus').textContent, 'authTimeout');
  assert.equal(app.element('forumAuthSubmit').disabled, false);
});

for (const status of [400, 401, 403, 422, 429]) {
  test(`password HTTP ${status} does not trigger automatic resubmission`, async () => {
    const app = harness({ onPassword: () => response(status, { message: 'Authentication rejected' }) });
    await app.submit();
    assert.equal(app.count('password'), 1);
    assert.equal(app.count('profile'), 0);
    assert.equal(app.token(), '');
    assert.equal(app.element('forumAuthSubmit').disabled, false);
  });
}

for (const action of ['openForumPasswordRecovery()', 'forumSignOut()']) {
  test(`late password success cannot save a session after ${action}`, async () => {
    const pending = deferred();
    const app = harness({ onPassword: () => pending.promise });
    const signIn = app.submit();
    await until(() => app.count('password') === 1);
    app.run(action);
    pending.resolve(response(200, { access_token: TOKEN, refresh_token: 'test-refresh' }));
    await signIn;
    assert.equal(app.token(), '');
    assert.equal(app.count('password'), 1);
    assert.equal(app.count('profile'), 0);
    assert.doesNotMatch(app.element('forumArea').innerHTML, /welcome/);
  });
}

test('a pending second password attempt cannot restore a session after cancellation', async () => {
  const pending = deferred();
  const app = harness({ onPassword: attempt => attempt === 1 ? 'timeout' : pending.promise });
  const signIn = app.submit();
  await until(() => app.count('password') === 2);
  app.run('openForumPasswordRecovery()');
  pending.resolve(response(200, { access_token: TOKEN, refresh_token: 'test-refresh' }));
  await signIn;
  assert.equal(app.token(), '');
  assert.equal(app.count('profile'), 0);
  assert.equal(app.count('password'), 2);
});

test('two clicks while authentication is pending issue only one password request', async () => {
  const pending = deferred();
  const app = harness({ onPassword: () => pending.promise });
  const first = app.submit();
  await until(() => app.count('password') === 1);
  await app.submit();
  assert.equal(app.count('password'), 1);
  pending.resolve(response(200, { access_token: TOKEN, refresh_token: 'test-refresh' }));
  await first;
  assert.equal(app.token(), TOKEN);
  assert.equal(app.count('profile'), 1);
});
