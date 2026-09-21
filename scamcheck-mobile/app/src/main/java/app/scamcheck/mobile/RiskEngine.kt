package app.scamcheck.mobile

import java.text.Normalizer
import java.util.Locale

enum class RiskLevel { SAFE, CAUTION, HIGH }

/** score is an internal heuristic, NOT a probability or accuracy percentage. */
data class RiskEvaluation(val score: Int, val level: RiskLevel, val title: String,
    val explanation: String, val signals: List<String>, val actions: List<String>)

/** Small, explainable offline filter. No reputation lookup or sender verification. */
object RiskEngine {
    private val link = Regex("""(?i)(https?://|www\.|\b(?:bit\.ly|tinyurl\.com|t\.me|rb\.gy)/)""")
    private val shortLink = Regex("""(?i)\b(?:bit\.ly|tinyurl\.com|rb\.gy|t\.co)/""")
    private val sensitiveRequest = Regex("""\b(gui|cung cap|doc|nhap|chia se|xác nhận|send|provide|share|enter|reply with)\b.{0,55}?\b(otp|ma xac (?:thuc|nhan|minh)|mat khau|ma pin|cccd|can cuoc|thong tin the|so the|password|verification code|card number|pin)\b""")
    private val negative = Regex("""\b(khong|dung|never|do not|don't)\s+(?:\S+\s+){0,2}$""")
    private val payment = Regex("""\b(chuyen tien|nop phi|dong phi|phi xu ly|transfer money|processing fee|pay a fee|send money)\b""")

    fun analyse(message: String): RiskEvaluation {
        val text = normalise(message.take(5_000))
        if (text.isBlank()) return RiskEvaluation(0, RiskLevel.SAFE, "Chưa có nội dung để kiểm tra",
            "Dán hoặc chia sẻ một tin nhắn để kiểm tra các dấu hiệu có thể quan sát được.", emptyList(), emptyList())
        val signals = mutableListOf<String>()
        var score = 0
        fun add(points: Int, signal: String) { score += points; signals += signal }
        val urgency = contains(text, "khan cap", "ngay hom nay", "ngay lap tuc", "bi khoa", "tam khoa", "trong 10 phut", "urgent", "immediately", "suspended", "locked", "han chot")
        val requestedSecret = sensitiveRequest.findAll(text).any { !negative.containsMatchIn(text.substring(maxOf(0, it.range.first - 30), it.range.first)) }
        val money = payment.findAll(text).any { !negative.containsMatchIn(text.substring(maxOf(0, it.range.first - 30), it.range.first)) }
        val hasLink = link.containsMatchIn(text)
        val shortened = shortLink.containsMatchIn(text)
        val prize = contains(text, "trung thuong", "nhan thuong", "loi nhuan dam bao", "cam ket loi nhuan", "guaranteed returns", "inheritance", "won a prize")
        val authority = contains(text, "ngan hang", "cong an", "toa an", "vietcombank", "bidv", "police", "bank", "government")
        val install = contains(text, "cai app", "cai ung dung", "tai apk", "install this app", "remote access", "dieu khien tu xa")
        if (urgency) add(22, "Có lời thúc giục hoặc đe dọa hạn chế tài khoản; cần kiểm tra độc lập.")
        if (requestedSecret) add(35, "Có lời yêu cầu nhập, gửi hoặc cung cấp mã/dữ liệu nhạy cảm.")
        if (money) add(15, "Có nội dung về chuyển tiền hoặc trả phí; chưa xác minh được người nhận.")
        if (hasLink) add(14, "Có liên kết trong nội dung; app chưa xác minh độ tin cậy của địa chỉ đích.")
        if (shortened) add(10, "Liên kết rút gọn che địa chỉ đích.")
        if (prize) add(15, "Có lời hứa phần thưởng hoặc lợi nhuận cần xác minh.")
        if (authority && (requestedSecret || money || urgency || hasLink)) add(8, "Nội dung nhắc tên cơ quan/ngân hàng; tên này không chứng minh danh tính người gửi.")
        if (install) add(20, "Có đề cập cài ứng dụng hoặc truy cập từ xa; hãy kiểm tra nguồn trước khi làm theo.")
        // Strong combinations matter more than a standalone bank name or ordinary OTP notice.
        if ((money && urgency) || (money && prize)) score += 10
        val level = when { score >= 45 -> RiskLevel.HIGH; score >= 20 -> RiskLevel.CAUTION; else -> RiskLevel.SAFE }
        val title = when (level) {
            RiskLevel.HIGH -> "Có dấu hiệu rủi ro cao"
            RiskLevel.CAUTION -> "Có điểm cần xác minh"
            RiskLevel.SAFE -> "Chưa thấy dấu hiệu rủi ro nổi bật"
        }
        val explanation = when (level) {
            RiskLevel.HIGH -> "Bộ lọc trên máy tìm thấy dấu hiệu cần thận trọng. Dừng lại trước khi bấm liên kết, cung cấp mã hoặc chuyển tiền. Đây không phải kết luận chắc chắn về người gửi."
            RiskLevel.CAUTION -> "Một số chi tiết cần kiểm tra qua kênh chính thức. Bộ lọc từ khóa không hiểu đầy đủ ngữ cảnh; có thể báo nhầm hoặc bỏ sót."
            RiskLevel.SAFE -> "Bộ lọc trên máy chưa tìm thấy mẫu rủi ro nổi bật. Đây không phải bảo đảm an toàn; app chưa xác minh người gửi hay địa chỉ liên kết."
        }
        return RiskEvaluation(score.coerceAtMost(100), level, title, explanation, signals,
            listOf("Không chia sẻ OTP, mật khẩu hoặc mã PIN với người khác.",
                "Tự mở ứng dụng hoặc liên hệ số chính thức để xác minh yêu cầu quan trọng.",
                "Nếu còn nghi ngờ, tạm dừng và nhờ người tin cậy kiểm tra cùng."))
    }
    private fun normalise(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "").replace('đ', 'd')
    private fun contains(text: String, vararg values: String) = values.any { Regex("(?<![a-z])${Regex.escape(it)}(?![a-z])").containsMatchIn(text) }
}

/** Unknown or missing output must never silently become a green result. */
object AiRiskParser {
    fun parse(value: String): RiskLevel = when (value.trim().uppercase(Locale.ROOT)) {
        "CRITICAL", "HIGH", "DANGEROUS", "NGUY_HIEM" -> RiskLevel.HIGH
        "MEDIUM", "CAUTION", "SUSPICIOUS", "NGHI_NGO" -> RiskLevel.CAUTION
        "LOW", "SAFE", "AN_TOAN" -> RiskLevel.SAFE
        else -> throw IllegalArgumentException("AI chưa trả về mức rủi ro hợp lệ.")
    }
}
