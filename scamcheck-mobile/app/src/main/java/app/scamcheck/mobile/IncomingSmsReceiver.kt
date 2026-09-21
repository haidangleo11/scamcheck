package app.scamcheck.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.provider.Telephony
import java.security.MessageDigest

/** Only packaged in the internal flavor. SMS content never leaves the device. */
class IncomingSmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (!GuardSettings(context).smsGuardEnabled) return
        val body = runCatching {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
                .joinToString(separator = "") { it.messageBody.orEmpty() }.take(4_000)
        }.getOrNull().orEmpty()
        if (body.isBlank()) return
        val evaluation = RiskEngine.analyse(body)
        if (evaluation.level == RiskLevel.SAFE) return
        val redacted = SensitiveDataRedactor.redact(body)
        if (!accept(redacted)) return
        val now = SystemClock.elapsedRealtime()
        val previous = GuardInbox.latest().firstOrNull { it.sourcePackage == "sms" }
        val escalated = previous != null && evaluation.level.ordinal > previous.evaluation.level.ordinal
        val silentUpdate = lastWarningAt != Long.MIN_VALUE && now - lastWarningAt < 20_000 && !escalated
        if (!silentUpdate) lastWarningAt = now
        val alert = GuardInbox.add("sms", "SMS", redacted, evaluation, "Bộ lọc trên thiết bị · SMS")
        RiskNotifier.showWarning(context, alert, isUpdate = silentUpdate)
    }

    companion object {
        private val seen = LinkedHashMap<String, Long>()
        private var lastWarningAt = Long.MIN_VALUE

        @Synchronized
        private fun accept(text: String): Boolean {
            val now = SystemClock.elapsedRealtime()
            val fingerprint = MessageDigest.getInstance("SHA-256").digest(text.toByteArray())
                .joinToString("") { "%02x".format(it) }
            seen.entries.removeAll { now - it.value > 10 * 60 * 1_000L }
            if (fingerprint in seen) return false
            seen[fingerprint] = now
            while (seen.size > 64) seen.remove(seen.keys.first())
            return true
        }
    }
}
