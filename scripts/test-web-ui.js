/* Offline checks for the web redesign. Run with: node scripts/test-web-ui.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'web-ui.css'), 'utf8');
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--[^]*?-->/g, '');

test('all inline scripts compile', () => {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1]));
  }
});
test('static IDs are unique and feature controls are preserved', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate static IDs');
  for (const id of ['appNav', 'mobileNavToggle', 'messageInput', 'imageUpload', 'qrPanel', 'directLinkPanel', 'checkBtn', 'resultArea', 'seniorOneTouch', 'aiLimitWidget', 'aiUsageLabel', 'aiUsagePercent', 'aiUsageBar', 'tab-forum', 'tab-admin', 'simulationArea']) assert.ok(ids.includes(id), id);
  assert.match(markup, /<label for="messageInput"/);
});
test('composer appears before optional guides and AI allowance', () => {
  assert.ok(markup.indexOf('id="messageInput"') < markup.indexOf('id="aiLimitWidget"'));
  assert.ok(markup.indexOf('id="messageInput"') < markup.indexOf('id="seniorOneTouch"'));
});
test('web stylesheet is versioned and included in the offline shell', () => {
  const asset = html.match(/href="(\/web-ui\.css\?v=[^"]+)"/)[1];
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes(asset));
});
test('new interface copy exists in both languages', () => {
  const from = html.indexOf('const UI_TRANSLATIONS =');
  const to = html.indexOf('function getCurrentLanguage()', from);
  const context = vm.createContext({ currentLanguage: 'vi' });
  vm.runInContext(html.slice(from, to) + ';this.copy = UI_TRANSLATIONS;', context);
  for (const lang of ['vi', 'en']) for (const key of ['checkTitle', 'checkIntro', 'inputLabel', 'checkPrivacy', 'checkAiDisclosure', 'sessionAllowance', 'guideTitle', 'guideLowDesc', 'guideNote', 'skipToCheck']) assert.ok(context.copy[lang][key], lang + ':' + key);
  assert.match(context.copy.en.checkAiDisclosure, /AI.*wrong/);
  assert.match(context.copy.en.guideLowDesc, /does not guarantee/);
});
test('mobile, dark mode, focus and reduced-motion styles are present', () => {
  for (const token of ['html.dark', '@media (max-width: 767px)', ':focus-visible', 'prefers-reduced-motion', '.mobile-toolbar > svg', '.simulation-choice-card.scenario-row']) assert.ok(css.includes(token), token);
  assert.match(html, /toggleAttribute\('inert', shouldOpen\)/);
});
test('simulation keeps bounded phone scrolling and multi-step behavior', () => {
  assert.match(html, /simulation-phone-thread[^}]+overflow-y: auto/);
  assert.ok(html.includes('getCurrentSimulationStep(scenario)'));
  assert.ok(html.includes('scrollSimulationThreadToLatest(area)'));
  assert.ok(html.includes('startSimulation('));
});
test('result styles retain risk color classes and distinguish explanatory panels', () => {
  assert.ok(html.includes("data.risk === 'NGUY_HIEM'"));
  assert.ok(html.includes("data.risk === 'NGHI_NGO'"));
  for (const name of ['result-context', 'result-source', 'result-details', 'result-deep']) assert.ok(html.includes(name));
});
