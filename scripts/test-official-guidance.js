const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const guide = require('../official-guidance');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return html.slice(a, b);
}
function context(language = 'vi', available = true) {
  const nodes = {};
  const storage = new Map();
  const ctx = vm.createContext({
    currentLanguage: language, window: { ScamCheckGuidance: available ? guide : undefined },
    escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    safeText: s => String(s ?? ''), t: s => s, td: s => s,
    highlightQuotes: s => s, closeSafeSharePanel() {}, closeReportPanel() {}, closeFeedbackPanel() {}, scrollToResultSection() {},
    document: { getElementById(id) { return nodes[id] ||= { innerHTML: '', dataset: {}, classList: { remove() {}, add() {}, toggle() {} }, focus() {} }; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, v) => storage.set(key, v), removeItem: key => storage.delete(key) },
    fetch: () => { throw Error('Guidance must not call the network'); }
  });
  vm.runInContext(section('        function getOfficialGuidance(', '        function redactSensitiveForShare('), ctx);
  vm.runInContext(section('        function normalizeResult(', '        async function getDeepAiAnalysis('), ctx);
  vm.runInContext(section('        function renderResult(', '        function showResultLanguageNotice('), ctx);
  vm.runInContext(section('        function getPublicRiskClasses(', '        function renderInvalidPublicShare('), ctx);
  return { ctx, nodes };
}
test('all six playbooks have matching VI/EN step IDs and valid official citations', () => {
  assert.equal(guide.scenarioIds.length, 6);
  for (const id of guide.scenarioIds) {
    const vi = guide.getPlaybook(id, 'vi'), en = guide.getPlaybook(id, 'en');
    assert.deepEqual(vi.steps.map(s => s.id), en.steps.map(s => s.id));
    for (const book of [vi, en]) for (const step of book.steps) {
      assert.ok(step.text && step.sources.length);
      for (const sourceId of step.sources) {
        const source = guide.getSource(sourceId, book.language);
        assert.ok(source.published && source.reviewedOn && source.scope);
        const url = new URL(source.url);
        assert.equal(url.protocol, 'https:');
        assert.ok(['www.bocongan.gov.vn', 'cdcsnd1.bocongan.gov.vn', 'www.vietcombank.com.vn', 'consumer.ftc.gov'].includes(url.hostname));
      }
    }
  }
});
test('same scenario and language always produce the same text/order', () => {
  for (const id of guide.scenarioIds) for (const lang of ['vi','en']) {
    const expected = guide.getPlaybook(id, lang);
    for (let i = 0; i < 100; i++) assert.deepEqual(guide.getPlaybook(id, lang), expected);
  }
});
test('unknown or prototype scenario/source names cannot inject data', () => {
  for (const id of ['unknown', '__proto__', 'constructor', '<script>']) assert.equal(guide.getPlaybook(id).id, 'prevention');
  assert.equal(guide.getSource('__proto__'), null);
  const book = guide.getPlaybook(); book.steps[0].sources.push('evil'); book.steps[0].text = 'evil';
  assert.notEqual(guide.getPlaybook().steps[0].text, 'evil');
  assert.ok(!guide.getPlaybook().steps[0].sources.includes('evil'));
});
test('browser module works without require or a server', () => {
  const sandbox = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../official-guidance.js'), 'utf8'), sandbox);
  assert.equal(sandbox.ScamCheckGuidance.VERSION, guide.VERSION);
});
for (const lang of ['vi', 'en']) {
  test(`${lang}: AI and historical actions are replaced at normalisation and display`, () => {
    const { ctx, nodes } = context(lang);
    const malicious = { risk: 'NGUY_HIEM', title: 'Test', actions: ['MODEL_INVENTED_STEP'], safeActions: ['MODEL_INVENTED_STEP'] };
    assert.deepEqual(Array.from(ctx.normalizeResult(malicious).actions), guide.getPlaybook('prevention', lang).steps.map(s => s.text));
    assert.ok(!ctx.normalizeDeepAnalysis(malicious).safeActions.includes('MODEL_INVENTED_STEP'));
    ctx.renderResult({ ...malicious, deepAnalysis: { safeActions: malicious.safeActions } }, 'Quoted scam: I sent money.');
    assert.ok(!nodes.resultArea.innerHTML.includes('MODEL_INVENTED_STEP'));
    assert.ok(nodes.resultArea.innerHTML.includes('data-guidance-version'));
    assert.ok(!ctx.currentShareResult.actions.includes('MODEL_INVENTED_STEP'));
  });
  test(`${lang}: all rescue scenarios display source links and a review version`, () => {
    const { ctx, nodes } = context(lang);
    for (const id of guide.scenarioIds) {
      ctx.renderQuickRescuePlan(id);
      const markup = nodes.quickRescueArea.innerHTML;
      assert.ok(markup.includes(guide.VERSION));
      assert.ok(markup.includes('rel="noopener noreferrer"'));
      for (const step of guide.getPlaybook(id, lang).steps) assert.ok(markup.includes(ctx.escapeHtml(step.text)));
    }
  });
  test(`${lang}: quiz/rescue never call AI or infer exposure from a quoted message`, async () => {
    const { ctx } = context(lang);
    const first = await ctx.getRescuePlan('I paid the scammer and sent an OTP');
    assert.deepEqual(first, await ctx.getRescuePlan('Hello'));
    const quiz = await ctx.getSituationalQuiz('Send money now', {});
    assert.equal(quiz.options.filter(o => o.isCorrect).length, 1);
    assert.equal(quiz.options[0].text, guide.getPlaybook('prevention', lang).steps.find(s => s.id === 'verify').text);
  });
}
test('missing catalog fails closed, without AI-generated fallback actions', async () => {
  const { ctx, nodes } = context('en', false);
  assert.equal(ctx.normalizeResult({ actions: ['UNREVIEWED'] }).actions.length, 0);
  assert.match(ctx.officialGuidanceMarkup(), /could not load/);
  assert.equal(await ctx.getSituationalQuiz('message'), null);
  ctx.renderRescuePlan('message');
  assert.match(nodes.rescueArea.innerHTML, /could not load/);
  ctx.renderQuickRescuePlan('transferred');
  assert.match(nodes.quickRescueArea.innerHTML, /could not load/);
});
test('checklist persistence is versioned and source links are outside labels', () => {
  const { ctx } = context();
  assert.ok(ctx.rescueChecklistStorageKey('otp').includes(guide.VERSION));
  assert.match(html, /<\/label>\s*<small class="guidance-sources">/);
  assert.match(section('        function openQuickRescue()', '        function closeQuickRescue()'), /quickRescuePrompt.*remove\('hidden'\)/);
});
test('catalog is versioned, loaded before app, and cached for offline use', () => {
  const asset = '/official-guidance.js?v=20260922-1';
  assert.ok(html.indexOf(asset) < html.indexOf('const API_BASE_URL'));
  assert.ok(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8').includes(asset));
});
test('public share links cannot substitute their own safety instructions', () => {
  for (const language of ['vi', 'en']) {
    const { ctx, nodes } = context(language);
    ctx.renderPublicSharedResult({ risk: 'NGHI_NGO', title: 'Test', desc: '', signs: [], actions: ['PAY_AN_ATTACKER'], message: '', psychology: '' });
    assert.ok(!nodes.resultArea.innerHTML.includes('PAY_AN_ATTACKER'));
    assert.ok(nodes.resultArea.innerHTML.includes(guide.VERSION));
    assert.ok(nodes.resultArea.innerHTML.includes(ctx.escapeHtml(guide.getPlaybook('prevention', language).steps[0].text)));
  }
});
test('language switch preserves selected rescue and refreshes quiz, rescue and shared guidance', () => {
  const refresh = section('        function refreshLocalizedDynamicContent()', '        function fillSample(');
  assert.ok(refresh.indexOf('const selectedRescueScenario') < refresh.indexOf('renderResult('));
  assert.match(refresh, /if \(quickRescueOpen\)[\s\S]*openQuickRescue\(\);[\s\S]*renderQuickRescuePlan\(selectedRescueScenario\)/);
  assert.match(refresh, /if \(quizOpen\) renderSituationalQuiz\(createFallbackSituationalQuiz/);
  assert.match(refresh, /if \(recoveryOpen\) void renderRescuePlan/);
  assert.match(refresh, /window.location.pathname === '\/share'[\s\S]*renderPublicSharedResultFromUrl/);
});
test('active analysis prompts no longer ask AI to invent safety actions', () => {
  const prompts = section('        const RELIABLE_SYSTEM_PROMPT', '        function normalizeSituationalQuiz(');
  assert.match(prompts, /"actions":\[\]/);
  assert.match(prompts, /"safeActions":\[\]/);
  assert.ok(!prompts.includes('3-5 bước an toàn'));
  assert.ok(!prompts.includes('suggest one calm next step'));
  assert.ok(!prompts.includes('gợi ý một bước an toàn'));
  assert.match(prompts, /do not prescribe actions/);
});
