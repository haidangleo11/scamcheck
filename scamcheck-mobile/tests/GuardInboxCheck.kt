package app.scamcheck.mobile

/** Dependency-free JVM checks for the real GuardInbox implementation. */
fun main() {
    var count = 0
    fun test(name: String, body: () -> Unit) {
        GuardInbox.clear()
        body()
        count++
        println("PASS $name")
    }
    val evaluation = RiskEvaluation(70, RiskLevel.HIGH, "Cần xác minh", "Không gửi OTP cho người lạ.",
        listOf("Yêu cầu cung cấp OTP"), listOf("Dùng kênh chính thức để kiểm tra"))

    test("empty inbox and missing id") {
        check(GuardInbox.latest().isEmpty())
        check(GuardInbox.get("not-found") == null)
    }
    test("entry identity and source metadata are stable") {
        val before = System.currentTimeMillis()
        val alert = GuardInbox.add("test.chat", "Test Chat", "Tin nhắn thử nghiệm", evaluation, "Bộ lọc")
        check(alert.id.isNotBlank())
        check(alert.sourcePackage == "test.chat")
        check(alert.sourceLabel == "Test Chat")
        check(alert.createdAtMillis in before..System.currentTimeMillis())
        check(GuardInbox.get(alert.id) == alert)
    }
    test("newest first with distinct ids") {
        val first = GuardInbox.add("a", "A", "First", evaluation, "Local")
        val second = GuardInbox.add("a", "A", "Second", evaluation, "Local")
        check(first.id != second.id)
        check(GuardInbox.latest().map { it.id } == listOf(second.id, first.id))
    }
    test("retains only the newest 20 entries") {
        val ids = (1..25).map { GuardInbox.add("a", "A", "Text $it", evaluation, "Local").id }
        check(GuardInbox.latest().size == 20)
        check(ids.take(5).all { GuardInbox.get(it) == null })
        check(GuardInbox.latest().map { it.id } == ids.takeLast(20).reversed())
    }
    test("message, evaluation and evidence are length bounded") {
        val huge = evaluation.copy(title = "X".repeat(500), explanation = "E".repeat(3_000),
            signals = List(20) { "S".repeat(600) }, actions = List(20) { "A".repeat(600) })
        val alert = GuardInbox.add("a", "L".repeat(200), "M".repeat(8_000), huge, "I".repeat(200))
        check(alert.redactedText.length <= 4_000)
        check(alert.sourceLabel.length <= 80)
        check(alert.analysisSource.length <= 100)
        check(alert.evaluation.title.length <= 120)
        check(alert.evaluation.explanation.length <= 1_400)
        check(alert.evaluation.signals.size <= 8 && alert.evaluation.signals.all { it.length <= 300 })
        check(alert.evaluation.actions.size <= 8 && alert.evaluation.actions.all { it.length <= 300 })
    }
    test("redacts before memory retention and when updating AI evidence") {
        val sensitive = "OTP: 842913"
        val alert = GuardInbox.add("a", "A", sensitive, evaluation.copy(explanation = sensitive), "Local")
        check(!alert.redactedText.contains("842913"))
        check(!alert.evaluation.explanation.contains("842913"))
        val updated = GuardInbox.update(alert.id, evaluation.copy(signals = listOf(sensitive)), "AI")!!
        check(updated.evaluation.signals.none { it.contains("842913") })
    }
    test("update preserves message time and identity") {
        val alert = GuardInbox.add("a", "A", "Text", evaluation, "Local")
        val updated = GuardInbox.update(alert.id, evaluation.copy(title = "AI result"), "AI")!!
        check(updated.id == alert.id && updated.createdAtMillis == alert.createdAtMillis)
        check(updated.redactedText == alert.redactedText && updated.sourcePackage == alert.sourcePackage)
        check(updated.evaluation.title == "AI result" && updated.analysisSource == "AI")
    }
    test("clear invalidates stale callbacks; update never resurrects deleted entry") {
        val alert = GuardInbox.add("a", "A", "Text", evaluation, "Local")
        GuardInbox.clear()
        check(GuardInbox.latest().isEmpty())
        check(GuardInbox.get(alert.id) == null)
        check(GuardInbox.update(alert.id, evaluation, "AI") == null)
        check(GuardInbox.latest().isEmpty())
    }
    println("$count GuardInbox JVM checks passed.")
    runRiskEngineChecks()
}
