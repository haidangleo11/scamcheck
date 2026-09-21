/** Static regression checks. These do not replace instrumented tests on Android. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = name => readFileSync(join(root, 'app/src/main/java/app/scamcheck/mobile', `${name}.kt`), 'utf8');
const settings = src('GuardSettings');
const listener = src('NotificationGuardService');
const inbox = src('GuardInbox');
const notifier = src('RiskNotifier');
const sms = src('IncomingSmsReceiver');
const activity = src('MainActivity');
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`PASS ${name}`); };

check('SMS, notification protection, and automatic AI default to off', () => {
  for (const key of ['sms_guard_enabled', 'notification_guard_enabled', 'automatic_ai_enabled']) {
    assert.ok(settings.includes(`getBoolean("${key}", false)`));
  }
});
check('Allowlist is empty by default and excludes all ScamCheck flavors', () => {
  assert.ok(settings.includes('getStringSet("selected_packages", emptySet())'));
  assert.ok(settings.includes('!packageName.startsWith("app.scamcheck.mobile") && packageName in selectedPackages'));
});
check('Package gate precedes notification contents', () => {
  const gate = listener.indexOf('if (!guardSettings.allowsPackage(sourcePackage)) return');
  const read = listener.indexOf('val notification = sbn.notification');
  assert.ok(gate >= 0 && read > gate);
  assert.ok(listener.includes('Notification.FLAG_GROUP_SUMMARY or Notification.FLAG_ONGOING_EVENT'));
});
check('Enabling listener never reads existing notification history', () => {
  const code = listener.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\b(?:activeNotifications|getActiveNotifications)\b/);
});
check('Messaging previews use the public native Android SDK and last message only', () => {
  assert.ok(listener.includes('extras.getParcelableArray(Notification.EXTRA_MESSAGES)'));
  assert.ok(listener.includes('Notification.MessagingStyle.Message::getMessagesFromBundleArray'));
  assert.ok(listener.includes('val messages = if (Build.VERSION.SDK_INT >= 30)'));
  assert.ok(listener.includes('messages?.lastOrNull()?.text'));
  assert.doesNotMatch(listener, /extractMessagingStyleFromNotification/);
});
check('Background AI requires separate consent and explicit request preflight', () => {
  assert.ok(listener.includes('if (local.level == RiskLevel.SAFE) return'));
  assert.ok(sms.includes('if (evaluation.level == RiskLevel.SAFE) return'));
  assert.ok(listener.includes('if (guardSettings.automaticAiEnabled)'));
  assert.ok(listener.includes('guardSettings.automaticAiEnabled && guardSettings.allowsPackage(item.packageName)'));
  assert.ok(listener.includes('guardSettings.configurationRevision == item.revision'));
  assert.ok(listener.includes('shouldProceed = { startedGeneration == generation && eligible(item) }'));
});
check('Queue, rate, dedup, and text sizes are bounded', () => {
  for (const code of ['pending.size >= 3', 'aiStarts.size >= 24', 'while (seen.size > 128)',
    'take(4_000)', '20_000L - (now - lastAiAt)', '2 * 60 * 1_000L']) assert.ok(listener.includes(code));
});
check('Destroyed/disconnected service invalidates delayed work', () => {
  for (const method of ['onDestroy', 'onListenerDisconnected']) {
    assert.match(listener, new RegExp(`override fun ${method}\\(\\) \\{\\s*connected = false\\s*invalidateWork\\(\\)`));
  }
  assert.ok(listener.includes('if (startedGeneration != generation) return@analyse'));
  assert.ok(listener.includes('mainHandler.removeCallbacks(drain)'));
});
check('Clearing history prevents an in-flight result from recreating an alert', () => {
  assert.ok(listener.includes('GuardInbox.get(item.alertId) != null'));
  assert.ok(inbox.includes('val current = alerts[id] ?: return null'));
  assert.ok(inbox.includes('fun clear() = alerts.clear()'));
});
check('Alert review is redacted, bounded, and memory-only', () => {
  assert.ok(inbox.includes('SensitiveDataRedactor.redact(redactedText)'));
  assert.ok(inbox.includes('maximumAlerts = 20'));
  assert.ok(inbox.includes('retentionMillis = 60 * 60 * 1_000L'));
  assert.doesNotMatch(inbox, /getSharedPreferences|FileOutputStream|RoomDatabase|SQLiteDatabase/);
});
check('Notifications contain no raw body or model explanation', () => {
  assert.doesNotMatch(notifier, /\.setContent(?:Text|Title)\([^\n]*(?:redactedText|evaluation\.explanation|evaluation\.title)/);
  assert.ok(notifier.includes('.setVisibility(Notification.VISIBILITY_PRIVATE)'));
  assert.ok(notifier.includes('.setPublicVersion(publicVersion)'));
  assert.ok(notifier.includes('PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE'));
  assert.ok(notifier.includes('.putExtra(GuardInbox.EXTRA_ALERT_ID, alert.id)'));
});
check('Denied notification permission or blocked channel is respected', () => {
  assert.ok(notifier.includes('POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false'));
  assert.ok(notifier.includes('manager.areNotificationsEnabled()'));
  assert.ok(notifier.includes('NotificationManager.IMPORTANCE_NONE'));
});
check('Old AI result cannot replace the latest source notification', () => {
  assert.ok(listener.includes('GuardInbox.latest().firstOrNull { it.sourcePackage == item.packageName }?.id == item.alertId'));
  assert.ok(listener.includes('RiskNotifier.showWarning(this, updated, isUpdate = true)'));
});
check('AI failure retains local result and disagreement is disclosed', () => {
  assert.ok(listener.includes('AI chưa khả dụng'));
  assert.ok(listener.includes('ai.level.ordinal < original.evaluation.level.ordinal'));
  assert.ok(listener.includes('Hai kết quả chưa thống nhất'));
});
check('SMS receiver checks opt-in, reads received event only, and never uploads', () => {
  assert.ok(sms.includes('SMS_RECEIVED_ACTION'));
  assert.ok(sms.includes('if (!GuardSettings(context).smsGuardEnabled) return'));
  assert.doesNotMatch(sms, /AiAnalysisClient|HttpURLConnection|contentResolver\.query/);
  assert.ok(sms.includes('SensitiveDataRedactor.redact(body)'));
});
check('Cooldown silences updates rather than discarding distinct risky messages', () => {
  assert.ok(listener.includes('isUpdate = silentUpdate'));
  assert.ok(sms.includes('isUpdate = silentUpdate'));
  assert.doesNotMatch(listener, /now - lastWarning < 20_000\) return/);
  assert.doesNotMatch(sms, /now - lastWarningAt < 20_000\) return false/);
});
check('Turning protection off also revokes automatic AI', () => {
  assert.match(activity, /prefs\.notificationGuardEnabled = false\s*prefs\.automaticAiEnabled = false/);
  assert.ok(activity.includes('val processingNotice = if (prefs.automaticAiEnabled)'));
});
check('Share is review-only and manual queued requests check Activity lifecycle', () => {
  const sharedHandler = activity.slice(activity.indexOf('private fun receiveIntent'), activity.indexOf('private fun confirmManualAi'));
  assert.doesNotMatch(sharedHandler, /AiAnalysisClient|analyseInput\(/);
  assert.ok(activity.includes('shouldProceed = { !isDestroyed && generation == requestGeneration }'));
});
console.log(`\n${passed} guard source-invariant checks passed. Device behavior still requires Android testing.`);
