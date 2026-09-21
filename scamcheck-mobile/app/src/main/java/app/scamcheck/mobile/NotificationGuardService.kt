package app.scamcheck.mobile

import android.app.Notification
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import java.util.ArrayDeque

/** New previews only, after Android permission AND in-app opt-in. No screen/inbox capture. */
class NotificationGuardService : NotificationListenerService() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var guardSettings: GuardSettings
    @Volatile private var connected = false
    @Volatile private var generation = 0L
    private var aiInFlight = false
    private var lastAiAt = Long.MIN_VALUE
    private val seen = LinkedHashMap<String, Long>()
    private val warnedAt = LinkedHashMap<String, Long>()
    private val aiStarts = ArrayDeque<Long>()
    private val pending = ArrayDeque<PendingAnalysis>()
    private val drain = Runnable { drainQueue() }

    private data class PendingAnalysis(val alertId: String, val packageName: String,
        val text: String, val revision: Long, val queuedAt: Long)

    override fun onCreate() { super.onCreate(); guardSettings = GuardSettings(this) }

    override fun onListenerConnected() {
        super.onListenerConnected()
        connected = true
        // Do not inspect activeNotifications: enabling access is not permission to scan history.
    }

    override fun onListenerDisconnected() {
        connected = false
        invalidateWork()
        super.onListenerDisconnected()
    }

    override fun onDestroy() {
        connected = false
        invalidateWork()
        seen.clear()
        warnedAt.clear()
        super.onDestroy()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (!connected || sbn == null) return
        val sourcePackage = sbn.packageName
        // Check before accessing extras: ignore unselected applications entirely.
        if (!guardSettings.allowsPackage(sourcePackage)) return
        val notification = sbn.notification
        if (notification.flags and (Notification.FLAG_GROUP_SUMMARY or Notification.FLAG_ONGOING_EVENT) != 0) return
        if (notification.category in setOf(Notification.CATEGORY_CALL, Notification.CATEGORY_TRANSPORT,
                Notification.CATEGORY_PROGRESS, Notification.CATEGORY_SERVICE)) return
        val text = runCatching { notificationText(notification) }.getOrNull().orEmpty()
        if (text.length < 8) return
        val redacted = SensitiveDataRedactor.redact(text).take(4_000)
        if (!acceptFresh(sourcePackage, redacted)) return
        val local = RiskEngine.analyse(text)
        if (local.level == RiskLevel.SAFE) return
        val now = SystemClock.elapsedRealtime()
        val lastWarning = warnedAt[sourcePackage]
        val previous = GuardInbox.latest().firstOrNull { it.sourcePackage == sourcePackage }
        val isEscalation = previous != null && local.level.ordinal > previous.evaluation.level.ordinal
        val silentUpdate = lastWarning != null && now - lastWarning < 20_000 && !isEscalation
        // Rate-limit interruption, not analysis: a new risky message must not disappear.
        if (!silentUpdate) warnedAt[sourcePackage] = now
        while (warnedAt.size > 64) warnedAt.remove(warnedAt.keys.first())
        val label = runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(sourcePackage, 0)).toString() }
            .getOrDefault("Ứng dụng đã chọn")
        val alert = GuardInbox.add(sourcePackage, label, redacted, local, "Bộ lọc trên thiết bị · Thông báo")
        RiskNotifier.showWarning(this, alert, isUpdate = silentUpdate)
        if (guardSettings.automaticAiEnabled) {
            // Bound private text retained while waiting for the network.
            if (pending.size >= 3) pending.removeFirst()
            pending.addLast(PendingAnalysis(alert.id, sourcePackage, redacted, guardSettings.configurationRevision, now))
            drainQueue()
        }
    }

    private fun notificationText(notification: Notification): String {
        val extras = notification.extras ?: return ""
        @Suppress("DEPRECATION")
        val messageBundles = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
        val messages = if (Build.VERSION.SDK_INT >= 30) {
            messageBundles?.let(Notification.MessagingStyle.Message::getMessagesFromBundleArray)
        } else null
        messages?.lastOrNull()?.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let { return it.take(4_000) }
        val expanded = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val basic = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.lastOrNull()?.toString().orEmpty()
        // No title/sender metadata is sent to AI; only the message preview.
        return sequenceOf(expanded, basic, lines).firstOrNull { it.isNotBlank() }.orEmpty().trim().take(4_000)
    }

    private fun acceptFresh(packageName: String, text: String): Boolean {
        val now = SystemClock.elapsedRealtime()
        seen.entries.removeAll { now - it.value > 10 * 60 * 1_000L }
        val fingerprint = MessageDigest.getInstance("SHA-256").digest("$packageName\n$text".toByteArray())
            .joinToString("") { "%02x".format(it) }
        if (fingerprint in seen) return false
        seen[fingerprint] = now
        while (seen.size > 128) seen.remove(seen.keys.first())
        return true
    }

    private fun eligible(item: PendingAnalysis): Boolean = connected &&
        guardSettings.automaticAiEnabled && guardSettings.allowsPackage(item.packageName) &&
        guardSettings.configurationRevision == item.revision &&
        SystemClock.elapsedRealtime() - item.queuedAt <= 2 * 60 * 1_000L &&
        GuardInbox.get(item.alertId) != null && isAccessGranted(this)

    private fun drainQueue() {
        mainHandler.removeCallbacks(drain)
        if (aiInFlight || !connected) return
        while (pending.isNotEmpty() && !eligible(pending.first())) pending.removeFirst()
        if (pending.isEmpty()) return
        val now = SystemClock.elapsedRealtime()
        while (aiStarts.isNotEmpty() && now - aiStarts.first() >= 60 * 60 * 1_000L) aiStarts.removeFirst()
        // At most 24 background requests per hour, at least 20 seconds apart.
        if (aiStarts.size >= 24) { pending.clear(); return }
        val waitMillis = if (lastAiAt == Long.MIN_VALUE) 0L else 20_000L - (now - lastAiAt)
        if (waitMillis > 0) { mainHandler.postDelayed(drain, waitMillis); return }
        val item = pending.removeFirst()
        if (!eligible(item)) return drainQueue()
        aiInFlight = true
        lastAiAt = now
        aiStarts.addLast(now)
        val startedGeneration = generation
        AiAnalysisClient.analyse(item.text, automatic = true,
            shouldProceed = { startedGeneration == generation && eligible(item) }) { result ->
            if (startedGeneration != generation) return@analyse
            aiInFlight = false
            if (eligible(item)) {
                val original = GuardInbox.get(item.alertId)
                if (original != null) {
                    result.fold(onSuccess = { ai ->
                        // Disclose disagreement, rather than silently turning a local warning green.
                        val lowerRisk = ai.level.ordinal < original.evaluation.level.ordinal
                        val evaluation = if (lowerRisk) original.evaluation.copy(
                            explanation = original.evaluation.explanation + "\n\nAI đánh giá mức rủi ro thấp hơn bộ lọc. Hai kết quả chưa thống nhất; hãy tự xác minh qua kênh chính thức."
                        ) else ai
                        val source = if (lowerRisk) "Bộ lọc + AI · Cần xác minh thêm" else "AI · Kiểm tra thông báo tự động"
                        GuardInbox.update(item.alertId, evaluation, source)?.let { updated ->
                            // A slow result must not replace a newer warning from the same app.
                            if (GuardInbox.latest().firstOrNull { it.sourcePackage == item.packageName }?.id == item.alertId) {
                                RiskNotifier.showWarning(this, updated, isUpdate = true)
                            }
                        }
                    }, onFailure = {
                        // Failure is not a safe verdict and must not erase the local result.
                        GuardInbox.update(item.alertId, original.evaluation, "Bộ lọc trên thiết bị · AI chưa khả dụng")
                    })
                }
            }
            drainQueue()
        }
    }

    private fun invalidateWork() {
        generation++
        aiInFlight = false
        pending.clear()
        mainHandler.removeCallbacks(drain)
    }

    companion object {
        fun isAccessGranted(context: Context): Boolean {
            val component = ComponentName(context, NotificationGuardService::class.java)
            return runCatching { if (Build.VERSION.SDK_INT >= 27) {
                context.getSystemService(NotificationManager::class.java).isNotificationListenerAccessGranted(component)
            } else {
                Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
                    .orEmpty().split(':').mapNotNull(ComponentName::unflattenFromString).any { it == component }
            } }.getOrDefault(false)
        }
    }
}
