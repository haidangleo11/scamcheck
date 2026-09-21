package app.scamcheck.mobile

fun main() {
    val privateExamples = listOf(
        "OTP: 842913" to "842913",
        "Mã xác thực của bạn là 938271." to "938271",
        "Your verification code is 673412" to "673412",
        "OTP 123 789" to "123 789",
        "OTP: AB34CD" to "AB34CD",
        "OTP ABCDEF" to "ABCDEF",
        "password sunflower" to "sunflower",
        "OTP: AB34CD, không tiết lộ mã này." to "AB34CD",
        "194827 là OTP của bạn" to "194827",
        "Mật khẩu: TestOnly123!" to "TestOnly123!",
        "password is DemoStrongPass" to "DemoStrongPass",
        "PIN 7631" to "7631",
        "STK: 103456789012" to "103456789012",
        "Số tài khoản 1903456789012" to "1903456789012",
        "Card number: 4111 1111 1111 1111" to "4111 1111 1111 1111",
        "CCCD: 012345678901" to "012345678901",
        "passport: B1234567" to "B1234567",
        "Email user.test@example.com để nhận thưởng" to "user.test@example.com",
        "Liên hệ 0912 345 678" to "0912 345 678",
        "Call +1 202 555 0188 now" to "+1 202 555 0188",
        "Gọi +84 912 345 678" to "+84 912 345 678",
        "https://example.test/reset?access_token=fakeSecret123&lang=vi" to "fakeSecret123",
        "https://user:fakePassword@example.test/path" to "fakePassword"
    )
    for ((input, secret) in privateExamples) {
        val output = SensitiveDataRedactor.redact(input)
        check(!output.contains(secret)) { "Secret was not removed in synthetic case: $input" }
        check(output.contains("ĐÃ") && output.contains("ẨN")) { "Expected redaction marker" }
        check(SensitiveDataRedactor.redact(output) == output) { "Redactor is not idempotent for: $output" }
    }
    val safeExamples = listOf(
        "Phí xử lý là 300.000đ, hạn trước 17:00.",
        "Sản phẩm giá 1.500.000 VND, giảm 15%.",
        "Không cung cấp OTP hoặc mật khẩu cho bất cứ ai.",
        "Hãy xác minh tài khoản qua ứng dụng chính thức.",
        "https://example.test/orders/0912345678?price=300000&lang=vi",
        "Hẹn gặp lúc 19:30 ngày 20/09/2026.",
        "www.example.test/help?category=security"
    )
    for (input in safeExamples) check(SensitiveDataRedactor.redact(input) == input) { "Unnecessary masking: $input" }
    println("${privateExamples.size + safeExamples.size} redaction JVM cases passed (including idempotence for private cases).")
}
