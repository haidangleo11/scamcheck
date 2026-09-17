/*
 * Small release gate for ScamCheck's static web build and server API.
 * It deliberately has no network dependency, so it can run before every
 * deploy and catch accidental removal of safety-critical wiring.
 */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'index.html');
const chatPath = path.join(projectRoot, 'api', 'chat.js');
const feedbackPath = path.join(projectRoot, 'api', 'feedback.js');
const feedbackMigrationPath = path.join(projectRoot, 'supabase_forum_admin_dashboard_migration.sql');
const vercelPath = path.join(projectRoot, 'vercel.json');
const index = fs.readFileSync(indexPath, 'utf8');
const chat = fs.readFileSync(chatPath, 'utf8');
const feedback = fs.readFileSync(feedbackPath, 'utf8');
const feedbackMigration = fs.readFileSync(feedbackMigrationPath, 'utf8');
const vercel = fs.readFileSync(vercelPath, 'utf8');
const directLinkSection = index.slice(
  index.indexOf('function toggleDirectLinkCheck'),
  index.indexOf('const OFFICIAL_HOTLINES_DATA'),
);
const results = [];

function expect(name, condition) {
  results.push({ name, passed: Boolean(condition) });
}

expect('Forum uses a longer timeout for Auth requests',
  /FORUM_AUTH_REQUEST_TIMEOUT_MS\s*=\s*45000/.test(index)
  && /path\.startsWith\('\/auth\/v1\/'\)\s*\?\s*FORUM_AUTH_REQUEST_TIMEOUT_MS/.test(index));
expect('Forum keeps normal request timeout separate', /FORUM_REQUEST_TIMEOUT_MS\s*=\s*12000/.test(index));
expect('Forum loads OCR and QR libraries only when a person opens those tools',
  !/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js/.test(index)
  && /function loadOptionalClientLibrary\(name\)/.test(index)
  && /loadOptionalClientLibrary\('tesseract'\)/.test(index)
  && /loadOptionalClientLibrary\('jsqr'\)/.test(index)
  && /loadOptionalClientLibrary\('qrcode'\)/.test(index));
expect('Forum uses short-lived feed and reply caches for local interactions',
  /FORUM_FEED_CACHE_MS\s*=\s*15_000/.test(index)
  && /FORUM_REPLIES_CACHE_MS\s*=\s*15_000/.test(index)
  && /function renderForumFromCache\(\)/.test(index)
  && /function invalidateForumRepliesCache\(/.test(index));
expect('Forum refresh always bypasses the local feed cache',
  /onclick="renderForum\(true\)"/.test(index)
  && /async function renderForum\(force = false\)/.test(index));
expect('QR scan never auto-opens content', /ScamCheck chỉ đọc nội dung mã QR trên thiết bị và không tự mở liên kết/.test(index));
expect('Sensitive payment QR payloads are redacted before analysis',
  /type:\s*'payment',\s*raw:\s*content,\s*sensitive:\s*true/.test(index)
  && /scan\.sensitive/.test(index)
  && /currentQrScan\.sensitive/.test(index));
expect('A first-class local link checker is present',
  /id="directLinkPanel"/.test(index)
  && /function runDirectLinkCheck\(\)/.test(index)
  && /function runDirectLinkAiCheck\(\)/.test(index));
expect('Direct link checks never resolve or open the target',
  directLinkSection.includes('aiCheckUrl(entry.local.originalUrl')
  && !/\bfetch\s*\(/.test(directLinkSection));
expect('Unsupported URL schemes are rejected locally',
  /\^\[a-z\]\[a-z\\d\+\.\-\]\*:\/i/.test(index)
  && /\['http:', 'https:'\]\.includes\(parsed\.protocol\)/.test(index));
expect('Shortened www domains are flagged', index.includes("host.replace(/^www\\./, '')"));
expect('Official HTTP domains cannot be trusted automatically', /isLegitimate && isHttps/.test(index));
expect('AI API enforces a bounded server-side rate limit',
  /RATE_LIMIT_POLICIES/.test(chat)
  && /takeRateLimit\(request, isAutoGuard \? 'autoGuard' : 'analysis'\)/.test(chat)
  && /Retry-After/.test(chat));
expect('AI API key remains server-side only', /process\.env\.OPENAI_API_KEY/.test(chat));
expect('Moderator dashboard migration is packaged', fs.existsSync(feedbackMigrationPath));
expect('Admin is a standalone rewritten route',
  /"source": "\/admin"/.test(vercel)
  && /id="adminStandalonePage"/.test(index)
  && /function isAdminStandaloneRoute\(\)/.test(index));
const adminRender = index.slice(index.indexOf('async function renderForumAdmin'), index.indexOf('function renderForumAuthView'));
expect('Admin checks moderator role before loading moderation data',
  adminRender.indexOf("forumUser?.role !== 'moderator'") !== -1
  && adminRender.indexOf("forumUser?.role !== 'moderator'") < adminRender.indexOf('await loadForumModeration()'));
expect('Admin member directory uses a moderator-only RPC',
  /rpc\/get_forum_admin_members/.test(index)
  && /function public\.get_forum_admin_members\(\)/.test(feedbackMigration));
expect('Feedback accepts only anonymous fixed-enum data',
  /keys\.length !== 2/.test(feedback)
  && /ALLOWED_CATEGORIES\.has\(body\.category\)/.test(feedback)
  && /ALLOWED_RISKS\.has\(body\.risk\)/.test(feedback));
expect('Feedback storage is server-only and optional',
  /SUPABASE_SERVICE_ROLE_KEY/.test(feedback)
  && /source: FEEDBACK_SOURCE/.test(feedback)
  && !/req(?:uest)?\.body\.message/.test(feedback));

const failures = results.filter(result => !result.passed);
for (const result of results) {
  console.log(`${result.passed ? '✓' : '✗'} ${result.name}`);
}
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${results.length} smoke checks passed.`);
}
