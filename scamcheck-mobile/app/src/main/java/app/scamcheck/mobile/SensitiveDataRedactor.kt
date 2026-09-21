package app.scamcheck.mobile

/**
 * Best-effort minimisation before upload/review, not a guarantee that all personal data is removed.
 * Deliberately preserves ordinary prices, risk language, and URL hosts for useful analysis.
 */
object SensitiveDataRedactor {
    private const val hiddenCode = "[MÃ ĐÃ ẨN]"
    private const val hiddenPassword = "[MẬT KHẨU ĐÃ ẨN]"
    private const val hiddenAccount = "[TÀI KHOẢN ĐÃ ẨN]"
    private const val hiddenIdentity = "[DANH TÍNH ĐÃ ẨN]"
    private const val hiddenPhone = "[SỐ ĐIỆN THOẠI ĐÃ ẨN]"
    private const val hiddenEmail = "[EMAIL ĐÃ ẨN]"
    private const val hiddenLinkSecret = "[GIÁ_TRỊ_ĐÃ_ẨN]"

    private val urlPattern = Regex("""(?i)\b(?:https?://|www\.)[^\s<>\"']+""")
    private val urlSecret = Regex("""(?i)([?&#](?:access_token|refresh_token|id_token|token|password|passwd|pwd|secret|api_key|apikey|otp|pin|code|account|card|email|phone)=)([^&#\s]*)""")
    private val urlUserInfo = Regex("""(?i)(https?://)([^/@\s]+)@""")
    private val email = Regex("""(?i)(?<![a-z0-9._%+-])[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}(?![a-z0-9-])""")

    private const val codeLabel = "(?:otp|mã[ ]+(?:xác[ ]+thực|xác[ ]+nhận|bảo[ ]+mật)|ma[ ]+(?:xac[ ]+thuc|xac[ ]+nhan|bao[ ]+mat)|verification[ ]+code|security[ ]+code|authentication[ ]+code|one[- ]time[ ]+(?:code|password))"
    private const val identityLabel = "(?:cccd|cmnd|căn[ ]+cước(?:[ ]+công[ ]+dân)?|can[ ]+cuoc(?:[ ]+cong[ ]+dan)?|số[ ]+định[ ]+danh|so[ ]+dinh[ ]+danh|national[ ]+id|id[ ]+number|passport(?:[ ]+number)?|hộ[ ]+chiếu|ho[ ]+chieu)"
    private const val accountLabel = "(?:số[ ]+(?:tài[ ]+khoản|thẻ)|so[ ]+(?:tai[ ]+khoan|the)|tài[ ]+khoản(?:[ ]+ngân[ ]+hàng)?|tai[ ]+khoan(?:[ ]+ngan[ ]+hang)?|stk|account[ ]*(?:number|no\\.?)?|card[ ]*(?:number|no\\.?)|iban)"
    private const val connector = "[ ]*(?:(?:của[ ]+bạn|cua[ ]+ban|của[ ]+quý[ ]+khách|your)[ ]*)?(?:(?:là|la|is)[ ]*)?[:=]?[ ]*"
    private val code = Regex("(?iu)(\\b$codeLabel$connector)([a-z0-9]{4,12})(?![a-z0-9])")
    private val numericCode = Regex("(?iu)(\\b$codeLabel$connector)((?:[0-9][ -]?){4,8})(?![a-z0-9])")
    private val reverseCode = Regex("(?iu)(?<![0-9])([0-9]{4,8})([ ]+(?:là|la|is)[ ]+(?:your[ ]+)?$codeLabel\\b)")
    private val password = Regex("""(?iu)(\b(?:password|passwd|mật[ ]+khẩu|mat[ ]+khau|passcode|mã[ ]+pin|ma[ ]+pin|pin)[ ]*(?:(?:của[ ]+bạn|cua[ ]+ban|your)[ ]*)?(?::|=|là\b|la\b|is\b)[ ]*)["']?([^\s<>"'\[\]]{3,128})["']?""")
    private val barePassword = Regex("""(?iu)(\b(?:password|mật[ ]+khẩu|mat[ ]+khau|passcode|mã[ ]+pin|ma[ ]+pin|pin)[ ]+)([a-z0-9!@#$%^&*()_+=.?/-]{4,128})(?![a-z0-9])""")
    private val identity = Regex("(?iu)(\\b$identityLabel$connector)([a-z]?[0-9](?:[0-9 .-]{4,22})[0-9])(?![a-z0-9])")
    private val account = Regex("(?iu)(\\b$accountLabel$connector)((?:[0-9][ .-]?){6,24})(?![a-z0-9])")
    private val iban = Regex("""(?iu)(\biban[ ]*[:=]?[ ]*)([a-z]{2}[0-9]{2}(?:[ ]?[a-z0-9]){10,30})(?![a-z0-9])""")
    private val phone = Regex("""(?i)(?<![a-z0-9])(?:\+[0-9](?:[ ().-]?[0-9]){7,14}|0084[ .-]?(?:[0-9][ .-]?){8,9}[0-9]|0[ .-]?(?:[0-9][ .-]?){8,9}[0-9])(?![a-z0-9])""")

    fun redact(message: String): String {
        if (message.isEmpty()) return message
        // Transform non-URL spans separately: phone/card heuristics must not destroy URL evidence.
        val output = StringBuilder(message.length)
        var cursor = 0
        for (match in urlPattern.findAll(message)) {
            output.append(redactText(message.substring(cursor, match.range.first)))
            var url = urlSecret.replace(match.value) { it.groupValues[1] + hiddenLinkSecret }
            url = urlUserInfo.replace(url) { it.groupValues[1] + hiddenLinkSecret + "@" }
            output.append(url)
            cursor = match.range.last + 1
        }
        output.append(redactText(message.substring(cursor)))
        return output.toString()
    }

    private fun redactText(text: String): String {
        var value = password.replace(text) { it.groupValues[1] + hiddenPassword }
        value = barePassword.replace(value) {
            val secret = it.groupValues[2]
            if (secret.length >= 4) it.groupValues[1] + hiddenPassword else it.value
        }
        value = numericCode.replace(value) { it.groupValues[1] + hiddenCode }
        value = code.replace(value) {
            val candidate = it.groupValues[2].replace(" ", "").replace("-", "")
            if (candidate.length in 4..12) it.groupValues[1] + hiddenCode else it.value
        }
        value = reverseCode.replace(value) { hiddenCode + it.groupValues[2] }
        value = identity.replace(value) { it.groupValues[1] + hiddenIdentity }
        value = iban.replace(value) { it.groupValues[1] + hiddenAccount }
        value = account.replace(value) { it.groupValues[1] + hiddenAccount }
        value = email.replace(value, hiddenEmail)
        return phone.replace(value, hiddenPhone)
    }
}
