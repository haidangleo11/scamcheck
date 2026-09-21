package app.scamcheck.mobile

import java.util.UUID

data class GuardAlert(
    val id: String,
    val sourcePackage: String,
    val sourceLabel: String,
    val redactedText: String,
    val evaluation: RiskEvaluation,
    val analysisSource: String,
    val createdAtMillis: Long
)

/** Ephemeral, redacted review data. Nothing here is written to disk or backed up. */
object GuardInbox {
    const val EXTRA_ALERT_ID = "app.scamcheck.mobile.ALERT_ID"
    private const val maximumAlerts = 20
    private const val retentionMillis = 60 * 60 * 1_000L
    private val alerts = LinkedHashMap<String, GuardAlert>()

    @Synchronized
    fun add(sourcePackage: String, sourceLabel: String, redactedText: String,
        evaluation: RiskEvaluation, analysisSource: String): GuardAlert {
        prune()
        val alert = GuardAlert(UUID.randomUUID().toString(), sourcePackage, sourceLabel.take(80),
            SensitiveDataRedactor.redact(redactedText).take(4_000), sanitise(evaluation),
            analysisSource.take(100), System.currentTimeMillis())
        alerts[alert.id] = alert
        while (alerts.size > maximumAlerts) alerts.remove(alerts.keys.first())
        return alert
    }

    @Synchronized
    fun update(id: String, evaluation: RiskEvaluation, analysisSource: String): GuardAlert? {
        prune()
        val current = alerts[id] ?: return null
        val updated = current.copy(evaluation = sanitise(evaluation), analysisSource = analysisSource.take(100))
        alerts[id] = updated
        return updated
    }

    @Synchronized
    fun get(id: String): GuardAlert? { prune(); return alerts[id] }

    @Synchronized
    fun latest(): List<GuardAlert> { prune(); return alerts.values.toList().asReversed() }

    @Synchronized
    fun clear() = alerts.clear()

    private fun prune() {
        val cutoff = System.currentTimeMillis() - retentionMillis
        alerts.entries.removeAll { it.value.createdAtMillis < cutoff }
    }

    private fun sanitise(evaluation: RiskEvaluation) = evaluation.copy(
        title = SensitiveDataRedactor.redact(evaluation.title).take(120),
        explanation = SensitiveDataRedactor.redact(evaluation.explanation).take(1_400),
        signals = evaluation.signals.take(8).map { SensitiveDataRedactor.redact(it).take(300) },
        actions = evaluation.actions.take(8).map { SensitiveDataRedactor.redact(it).take(300) })
}
