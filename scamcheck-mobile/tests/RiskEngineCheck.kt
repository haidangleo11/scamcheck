package app.scamcheck.mobile

fun runRiskEngineChecks() {
    var checks = 0
    fun expect(label: String, condition: Boolean) { check(condition) { label }; checks++; println("PASS $label") }
    expect("empty input", RiskEngine.analyse("").score == 0)
    expect("ordinary conversation", RiskEngine.analyse("Mai đi học lúc 7 giờ nhé").level == RiskLevel.SAFE)
    expect("bank name alone is not impersonation", RiskEngine.analyse("Vietcombank xin thông báo chúc quý khách một ngày tốt lành").level == RiskLevel.SAFE)
    expect("routine OTP safety reminder", RiskEngine.analyse("Ngân hàng: Mã OTP của bạn là 123456. Không cung cấp OTP cho bất kỳ ai.").level == RiskLevel.SAFE)
    expect("English OTP safety reminder", RiskEngine.analyse("Your verification code is 123456. Do not share this OTP with anyone.").level == RiskLevel.SAFE)
    expect("urgent credential phishing", RiskEngine.analyse("Ngân hàng: tài khoản bị khóa. Gửi mã OTP ngay lập tức vào https://example.invalid").level == RiskLevel.HIGH)
    expect("diacritic-free phishing", RiskEngine.analyse("Tai khoan bi khoa. Gui OTP ngay lap tuc vao https://example.invalid").level == RiskLevel.HIGH)
    expect("police money pressure", RiskEngine.analyse("Công an yêu cầu chuyển tiền ngay lập tức để xác minh").level == RiskLevel.HIGH)
    expect("shortened link regex", RiskEngine.analyse("Xem tại bit.ly/test").signals.size == 2)
    expect("www link regex", RiskEngine.analyse("Xem tại www.example.invalid/test").signals.any { it.contains("liên kết") })
    expect("no false wildcard link", RiskEngine.analyse("bitXly/test").signals.isEmpty())
    expect("unverified link not automatically high", RiskEngine.analyse("Xem bài tập https://example.invalid/bai-tap").level != RiskLevel.HIGH)
    expect("unfamiliar AI risk fails closed", runCatching { AiRiskParser.parse("UNKNOWN") }.isFailure)
    expect("missing AI risk fails closed", runCatching { AiRiskParser.parse("") }.isFailure)
    expect("recognized safe", AiRiskParser.parse("AN_TOAN") == RiskLevel.SAFE)
    expect("recognized caution", AiRiskParser.parse(" medium ") == RiskLevel.CAUTION)
    expect("recognized high", AiRiskParser.parse("NGUY_HIEM") == RiskLevel.HIGH)
    println("Risk engine: $checks checks passed")
}
