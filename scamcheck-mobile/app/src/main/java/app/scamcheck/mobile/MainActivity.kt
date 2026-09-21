package app.scamcheck.mobile

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.text.InputFilter
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.text.DateFormat
import java.util.Date

class MainActivity : Activity() {
    private val prefs by lazy { GuardSettings(this) }
    private lateinit var checkPage: LinearLayout
    private lateinit var protectPage: LinearLayout
    private lateinit var scroll: ScrollView
    private lateinit var checkTab: Button
    private lateinit var protectTab: Button
    private lateinit var messageInput: EditText
    private lateinit var resultCard: TextView
    private lateinit var analyseButton: Button
    private lateinit var localButton: Button
    private lateinit var notificationStatus: TextView
    private lateinit var notificationToggle: Button
    private lateinit var selectedApps: TextView
    private lateinit var aiStatus: TextView
    private lateinit var aiToggle: Button
    private lateinit var smsStatus: TextView
    private lateinit var smsToggle: Button
    private lateinit var recentAlerts: LinearLayout
    @Volatile private var requestGeneration = 0
    private var selectedTab = 0
    private val ink = Color.rgb(15, 40, 72)
    private val muted = Color.rgb(74, 99, 130)
    private val blue = Color.rgb(37, 99, 235)
    private val pale = Color.rgb(244, 248, 255)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(createContent())
        selectTab(savedInstanceState?.getInt("tab") ?: 0)
        receiveIntent(intent)
    }
    override fun onResume() { super.onResume(); refreshProtection() }
    override fun onSaveInstanceState(outState: Bundle) {
        outState.putInt("tab", selectedTab)
        // Never persist message or alert contents to activity saved state.
        super.onSaveInstanceState(outState)
    }
    override fun onDestroy() { requestGeneration++; super.onDestroy() }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent); setIntent(intent); receiveIntent(intent)
    }

    private fun createContent(): View {
        val root = column().apply { setBackgroundColor(pale) }
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            root.setOnApplyWindowInsetsListener { view, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                val keyboard = insets.getInsets(WindowInsets.Type.ime())
                view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
                insets
            }
        }
        val header = column().apply { setPadding(dp(20), dp(18), dp(20), dp(12)) }
        header.addView(label("ScamCheck", 28, ink, true))
        header.addView(label("AN TOÀN KHÔNG GIAN SỐ  /  MOBILE 0.2", 10, muted, true).gap(3))
        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        checkTab = button("Kiểm tra", false) { selectTab(0) }
        protectTab = button("Bảo vệ", false) { selectTab(1) }
        tabs.addView(checkTab, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(6) })
        tabs.addView(protectTab, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginStart = dp(6) })
        header.addView(tabs.gap(16)); root.addView(header)
        scroll = ScrollView(this).apply { isFillViewport = true }
        val pages = column().apply { setPadding(dp(20), dp(4), dp(20), dp(24)) }
        checkPage = checker(); protectPage = protection()
        pages.addView(checkPage); pages.addView(protectPage); scroll.addView(pages)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        return root
    }

    private fun checker(): LinearLayout = column().apply {
        addView(label("Dừng một nhịp. Kiểm tra trước.", 22, ink, true).gap(12))
        addView(label("Dán nội dung hoặc chọn Chia sẻ → ScamCheck trong ứng dụng khác.", 14).gap(8))
        messageInput = EditText(this@MainActivity).apply {
            hint = "Tin nhắn này có đáng ngờ không?"; textSize = 16f
            gravity = Gravity.TOP or Gravity.START; minLines = 6; maxLines = 10
            setTextColor(ink); setHintTextColor(muted); background = rounded(Color.WHITE)
            setPadding(dp(16), dp(16), dp(16), dp(16))
            filters = arrayOf(InputFilter.LengthFilter(maxInputLength))
            isSaveEnabled = false; importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        addView(messageInput.gap(16))
        analyseButton = button("Phân tích với AI") { confirmManualAi() }
        addView(analyseButton.gap(12))
        localButton = button("Kiểm tra nhanh • không cần mạng", false) {
            dismissKeyboard()
            renderEvaluation(RiskEngine.analyse(messageInput.text.toString()), "Bộ lọc trên điện thoại • không phải AI")
        }
        addView(localButton.gap(8))
        addView(label("AI chỉ nhận nội dung sau khi bạn xác nhận. Mã nhạy cảm nhận diện được sẽ được che; bạn vẫn cần kiểm tra lại trước khi gửi.", 12).gap(10))
        resultCard = label("Kết quả sẽ hiện ở đây: dấu hiệu đáng ngờ, lý do và bước xác minh an toàn.", 15).apply {
            setPadding(dp(16), dp(16), dp(16), dp(16)); background = rounded(Color.WHITE)
            setTextIsSelectable(true); accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        addView(resultCard.gap(20))
        addView(button("Thử tin nhắn mẫu", false) {
            invalidateAnalysis()
            messageInput.setText("Tài khoản của bạn sẽ bị khóa trong 10 phút. Bấm https://example.invalid/xac-minh và gửi mã OTP để xác minh ngay.")
            renderInfo("Đây là tin nhắn mẫu, không phải tin nhắn thực. Chọn kiểm tra trên máy hoặc phân tích AI.")
        }.gap(10))
        addView(label("ScamCheck có thể nhận định sai. Không dùng kết quả như bảo đảm an toàn; hãy xác minh qua kênh chính thức.", 12).gap(20))
    }

    private fun protection(): LinearLayout = column().apply {
        addView(label("Bạn chọn phạm vi bảo vệ", 22, ink, true).gap(12))
        addView(label("Hoạt động với thông báo mới từ app bạn chọn. Không đọc toàn bộ màn hình, tin nhắn cũ hay phần nội dung Android đã ẩn.", 14).gap(8))
        val notifications = card()
        notifications.addView(label("01  Bảo vệ thông báo", 18, ink, true))
        notificationStatus = label("", 14); notifications.addView(notificationStatus.gap(8))
        selectedApps = label("", 13); notifications.addView(selectedApps.gap(8))
        notifications.addView(button("Chọn ứng dụng cần bảo vệ", false, ::chooseApps).gap(12))
        notificationToggle = button("Bật bảo vệ thông báo", action = ::toggleNotificationGuard)
        notifications.addView(notificationToggle.gap(8))
        notifications.addView(button("Quyền truy cập thông báo", false) { openNotificationAccess() }.gap(8))
        notifications.addView(button("Cho phép ScamCheck hiện cảnh báo", false) { openAlertSettings() }.gap(8))
        addView(notifications.gap(18))
        val ai = card()
        ai.addView(label("02  AI tự động • tùy chọn", 18, ink, true))
        aiStatus = label("", 14); ai.addView(aiStatus.gap(8))
        ai.addView(label("Chỉ gửi những thông báo có dấu hiệu đáng ngờ do bộ lọc trên máy chọn. Không phải mọi tin nhắn đều được AI kiểm tra.", 13).gap(8))
        aiToggle = button("Bật AI tự động", false, ::toggleAutomaticAi); ai.addView(aiToggle.gap(12))
        addView(ai.gap(14))
        val sms = card()
        sms.addView(label("03  SMS mới nhận", 18, ink, true))
        smsStatus = label("", 14); sms.addView(smsStatus.gap(8))
        smsToggle = button("Bật SMS Guard", false, ::toggleSmsGuard); sms.addView(smsToggle.gap(12))
        smsToggle.visibility = if (BuildConfig.FLAVOR == "internal") View.VISIBLE else View.GONE
        addView(sms.gap(14))
        val history = card()
        history.addView(label("Cảnh báo trong phiên này", 18, ink, true))
        history.addView(label("Chạm để xem lý do. Nội dung được che bớt và chỉ giữ tạm trong bộ nhớ; có thể mất khi Android dừng app.", 12).gap(7))
        recentAlerts = column(); history.addView(recentAlerts.gap(10))
        history.addView(button("Làm mới danh sách", false) { refreshProtection() }.gap(8))
        history.addView(button("Xóa cảnh báo trong phiên", false) {
            GuardInbox.clear(); getSystemService(NotificationManager::class.java).cancelAll(); refreshProtection()
        }.gap(8))
        addView(history.gap(14))
        addView(label("Android có thể ẩn nội dung nhạy cảm hoặc hạn chế app chạy nền. Nếu thông báo không có nội dung, hãy dùng Chia sẻ để kiểm tra. Không cần tắt Play Protect.", 12).gap(18))
    }

    private fun selectTab(index: Int) {
        selectedTab = index.coerceIn(0, 1)
        checkPage.visibility = if (selectedTab == 0) View.VISIBLE else View.GONE
        protectPage.visibility = if (selectedTab == 1) View.VISIBLE else View.GONE
        listOf(checkTab, protectTab).forEachIndexed { i, tab ->
            tab.setTextColor(if (i == selectedTab) Color.WHITE else ink)
            tab.background = rounded(if (i == selectedTab) blue else Color.WHITE); tab.isSelected = i == selectedTab
        }
        scroll.post { scroll.scrollTo(0, 0) }
        if (selectedTab == 1) refreshProtection()
    }

    private fun receiveIntent(incoming: Intent?) {
        if (incoming == null) return
        incoming.getStringExtra(GuardInbox.EXTRA_ALERT_ID)?.let { id ->
            incoming.removeExtra(GuardInbox.EXTRA_ALERT_ID)
            val alert = GuardInbox.get(id)
            if (alert != null) openAlert(alert) else {
                selectTab(0); renderInfo("Chi tiết cảnh báo không còn trong bộ nhớ. Bạn có thể chia sẻ lại tin nhắn để kiểm tra; đây không phải kết luận tin nhắn an toàn.")
            }
            return
        }
        val shared = when (incoming.action) {
            Intent.ACTION_SEND -> if (incoming.type == "text/plain") incoming.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() else null
            Intent.ACTION_PROCESS_TEXT -> incoming.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            else -> null
        }?.trim().orEmpty()
        if (shared.isNotEmpty()) {
            invalidateAnalysis(); selectTab(0); messageInput.setText(shared.take(maxInputLength))
            renderInfo(if (shared.length > maxInputLength) "Đã nhận 5.000 ký tự đầu tiên. Bạn hãy chọn lại đoạn cần kiểm tra. Chưa gửi dữ liệu tới AI." else "Đã nhận nội dung được chia sẻ. Bạn hãy xem lại rồi chọn cách kiểm tra; chưa gửi dữ liệu tới AI.")
            incoming.action = Intent.ACTION_MAIN
            incoming.removeExtra(Intent.EXTRA_TEXT); incoming.removeExtra(Intent.EXTRA_PROCESS_TEXT)
        }
    }

    private fun confirmManualAi() {
        val original = messageInput.text.toString().trim()
        if (original.isBlank()) { renderInfo("Bạn hãy nhập một tin nhắn trước khi kiểm tra."); return }
        dismissKeyboard()
        val redacted = SensitiveDataRedactor.redact(original)
        val preview = ScrollView(this).apply {
            addView(label("Nội dung dưới đây sẽ được gửi qua HTTPS tới máy chủ ScamCheck và nhà cung cấp AI để phân tích. Không gửi nếu còn thông tin riêng tư bạn không muốn chia sẻ.\n\n$redacted", 14).apply { setPadding(dp(22), dp(12), dp(22), dp(12)) })
        }
        AlertDialog.Builder(this).setTitle("Xem lại trước khi gửi AI").setView(preview)
            .setNegativeButton("Hủy / sửa lại", null)
            .setPositiveButton("Gửi phân tích") { _, _ -> analyseInput(original, redacted) }.show()
    }
    private fun analyseInput(original: String, redacted: String) {
        val generation = ++requestGeneration; setAnalysing(true)
        val local = RiskEngine.analyse(original)
        renderInfo("AI đang phân tích nội dung bạn đã xác nhận. Nếu không kết nối được, app sẽ hiển thị rõ kết quả dự phòng trên thiết bị.")
        AiAnalysisClient.analyse(redacted, automatic = false,
            shouldProceed = { !isDestroyed && generation == requestGeneration }) { result ->
            if (isFinishing || isDestroyed || generation != requestGeneration) return@analyse
            setAnalysing(false)
            result.onSuccess { renderEvaluation(it, "ScamCheck AI • phân tích nội dung") }
                .onFailure { renderEvaluation(local, "AI chưa trả về kết quả hợp lệ. Dưới đây là bộ lọc dự phòng trên điện thoại, không phải kết quả AI.") }
        }
    }
    private fun setAnalysing(busy: Boolean) {
        analyseButton.isEnabled = !busy; localButton.isEnabled = !busy; messageInput.isEnabled = !busy
        analyseButton.text = if (busy) "Đang phân tích…" else "Phân tích với AI"
    }
    private fun invalidateAnalysis() { requestGeneration++; setAnalysing(false) }
    private fun renderEvaluation(evaluation: RiskEvaluation, source: String) {
        val (fill, textColor) = when (evaluation.level) {
            RiskLevel.HIGH -> Color.rgb(255, 241, 242) to Color.rgb(159, 18, 57)
            RiskLevel.CAUTION -> Color.rgb(255, 251, 235) to Color.rgb(133, 77, 14)
            RiskLevel.SAFE -> Color.rgb(236, 253, 245) to Color.rgb(6, 95, 70)
        }
        val signals = evaluation.signals.joinToString("\n• ", prefix = "• ").takeIf { evaluation.signals.isNotEmpty() } ?: "Chưa phát hiện dấu hiệu nổi bật; không có nghĩa là chắc chắn an toàn."
        val actions = evaluation.actions.joinToString("\n• ", prefix = "• ").takeIf { evaluation.actions.isNotEmpty() } ?: "Tự xác minh bằng ứng dụng hoặc số liên hệ chính thức."
        resultCard.text = "$source\n\n${evaluation.title}\n\n${evaluation.explanation}\n\nDẤU HIỆU\n$signals\n\nBƯỚC TIẾP THEO\n$actions"
        resultCard.setTextColor(textColor); resultCard.background = rounded(fill)
    }
    private fun renderInfo(value: String) { resultCard.text = value; resultCard.setTextColor(muted); resultCard.background = rounded(Color.WHITE) }
    private fun openAlert(alert: GuardAlert) {
        invalidateAnalysis(); selectTab(0); messageInput.setText(alert.redactedText)
        renderEvaluation(alert.evaluation, "${alert.sourceLabel} • ${alert.analysisSource}")
    }

    private fun refreshProtection() {
        if (!::notificationStatus.isInitialized) return
        val granted = NotificationGuardService.isAccessGranted(this)
        val canNotify = RiskNotifier.canNotify(this)
        val count = prefs.selectedPackages.size
        notificationStatus.text = when {
            !prefs.notificationGuardEnabled -> "Đang tắt. Chưa theo dõi nội dung thông báo."
            !granted -> "Đang chờ quyền truy cập thông báo. Mở phần quyền bên dưới rồi bật ScamCheck."
            count == 0 -> "Chưa có app nào được chọn. Chọn ít nhất một app để bắt đầu."
            !canNotify -> "Đã bật kiểm tra, nhưng cảnh báo đang bị chặn. Hãy kiểm tra quyền và kênh thông báo."
            else -> "Đã bật cho $count ứng dụng. Chỉ kiểm tra thông báo mới có nội dung Android cho phép."
        }
        notificationToggle.text = if (prefs.notificationGuardEnabled) "Tắt bảo vệ thông báo" else "Bật bảo vệ thông báo"
        selectedApps.text = if (count == 0) "Chưa chọn ứng dụng." else prefs.selectedPackages.map { packageLabel(it) }.sorted().joinToString(", ", prefix = "Đã chọn: ")
        aiStatus.text = when {
            !prefs.automaticAiEnabled -> "Đang tắt. Kiểm tra tự động chỉ dùng bộ lọc trên máy."
            !prefs.notificationGuardEnabled || !granted || count == 0 -> "Đã cho phép AI; đang chờ bạn bật và thiết lập bảo vệ thông báo."
            else -> "Đang bật. Thông báo có dấu hiệu rủi ro từ app đã chọn có thể được gửi tới ScamCheck AI sau khi che mã nhạy cảm nhận diện được."
        }
        aiToggle.text = if (prefs.automaticAiEnabled) "Tắt AI tự động" else "Bật AI tự động"
        smsStatus.text = when {
            BuildConfig.FLAVOR != "internal" -> "Bản không quyền SMS. Để kiểm tra tin nhắn, chọn app SMS ở mục thông báo hoặc dùng Chia sẻ."
            !prefs.smsGuardEnabled -> "Đang tắt. Nếu bật, chỉ kiểm tra SMS mới trên máy; không đọc hộp thư cũ và không gửi SMS trực tiếp lên AI."
            !hasSmsPermission() -> "Thiếu quyền nhận SMS. Tắt rồi bật lại để cấp quyền."
            !canNotify -> "SMS Guard đã bật, nhưng cảnh báo đang bị chặn. Kiểm tra quyền hiện thông báo."
            else -> "Đang bật • phân tích SMS mới trên điện thoại, không cần mạng."
        }
        smsToggle.text = if (prefs.smsGuardEnabled) "Tắt SMS Guard" else "Bật SMS Guard"
        recentAlerts.removeAllViews()
        val recent = GuardInbox.latest()
        if (recent.isEmpty()) recentAlerts.addView(label("Chưa có cảnh báo trong phiên này.", 13))
        recent.take(10).forEach { alert ->
            val time = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(alert.createdAtMillis))
            recentAlerts.addView(button("$time • ${alert.sourceLabel}\n${alert.evaluation.title}", false) { openAlert(alert) }.gap(8))
        }
    }

    private fun toggleNotificationGuard() {
        if (prefs.notificationGuardEnabled) {
            prefs.notificationGuardEnabled = false
            prefs.automaticAiEnabled = false
            refreshProtection()
            return
        }
        val processingNotice = if (prefs.automaticAiEnabled)
            "Bạn đã cho phép AI tự động: các thông báo có dấu hiệu đáng ngờ có thể được gửi đến máy chủ ScamCheck và nhà cung cấp AI sau khi che mã nhạy cảm nhận diện được."
        else "Hiện chỉ phân tích trên điện thoại, không tải lên AI."
        AlertDialog.Builder(this).setTitle("Bật bảo vệ thông báo?")
            .setMessage("Android sẽ hỏi quyền truy cập thông báo. ScamCheck chỉ xử lý nội dung từ các ứng dụng bạn chọn, bỏ qua những app khác. $processingNotice Nội dung cảnh báo được giữ tạm trong bộ nhớ. Bạn có thể tắt tại đây hoặc thu hồi quyền trong Cài đặt Android.")
            .setNegativeButton("Để sau", null).setPositiveButton("Đồng ý bật") { _, _ ->
                prefs.notificationGuardEnabled = true; refreshProtection()
                if (!NotificationGuardService.isAccessGranted(this)) openNotificationAccess() else {
                    NotificationListenerService.requestRebind(ComponentName(this, NotificationGuardService::class.java))
                    requestAlertPermission()
                }
            }.show()
    }
    private fun toggleAutomaticAi() {
        if (prefs.automaticAiEnabled) { prefs.automaticAiEnabled = false; refreshProtection(); return }
        AlertDialog.Builder(this).setTitle("Cho phép phân tích AI tự động?")
            .setMessage("Thông báo có dấu hiệu đáng ngờ từ app bạn chọn sẽ được gửi qua HTTPS tới máy chủ ScamCheck và nhà cung cấp AI. App che OTP, mật khẩu và số nhạy cảm mà nó nhận diện, nhưng không đảm bảo loại bỏ mọi thông tin riêng tư. Không bật cho app chứa dữ liệu bạn không muốn chia sẻ.\n\nNếu AI lỗi hoặc hết lượt, cảnh báo trên máy vẫn hoạt động. Bạn có thể tắt tùy chọn này bất cứ lúc nào; dữ liệu đã gửi trước khi tắt không thể thu hồi.")
            .setNegativeButton("Không bật", null).setPositiveButton("Đồng ý bật AI") { _, _ -> prefs.automaticAiEnabled = true; refreshProtection() }.show()
    }
    @Suppress("DEPRECATION")
    private fun chooseApps() {
        val installed = packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
            .map { it.activityInfo.packageName }.filterNot { it.startsWith("app.scamcheck.mobile") }.toSet()
        val packages = (installed + prefs.selectedPackages).sortedBy { packageLabel(it).lowercase() }
        if (packages.isEmpty()) { toast("Chưa tìm thấy app phù hợp trên thiết bị."); return }
        val chosen = prefs.selectedPackages.toMutableSet()
        AlertDialog.Builder(this).setTitle("Chỉ bảo vệ những app bạn chọn")
            .setMultiChoiceItems(packages.map { "${packageLabel(it)}\n$it" }.toTypedArray(), packages.map { it in chosen }.toBooleanArray()) { _, which, checked ->
                if (checked) chosen.add(packages[which]) else chosen.remove(packages[which])
            }.setNegativeButton("Hủy", null).setPositiveButton("Lưu lựa chọn") { _, _ -> prefs.selectedPackages = chosen; refreshProtection() }.show()
    }
    private fun toggleSmsGuard() {
        if (prefs.smsGuardEnabled) { prefs.smsGuardEnabled = false; refreshProtection(); return }
        if (BuildConfig.FLAVOR != "internal") return
        AlertDialog.Builder(this).setTitle("Cho phép kiểm tra SMS mới?")
            .setMessage("ScamCheck nhận nội dung SMS mới để tìm dấu hiệu rủi ro ngay trên điện thoại. Không yêu cầu đọc hộp thư cũ và không tải SMS trực tiếp lên AI. Nếu bạn cũng chọn app SMS trong Bảo vệ thông báo, bản xem trước có thể được phân tích theo lựa chọn AI ở mục đó.")
            .setNegativeButton("Để sau", null).setPositiveButton("Bật SMS Guard") { _, _ ->
                val needed = mutableListOf<String>()
                if (!hasSmsPermission()) needed += Manifest.permission.RECEIVE_SMS
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) needed += Manifest.permission.POST_NOTIFICATIONS
                if (needed.isEmpty()) { prefs.smsGuardEnabled = true; refreshProtection() } else requestPermissions(needed.toTypedArray(), smsPermissionCode)
            }.show()
    }
    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == smsPermissionCode) {
            prefs.smsGuardEnabled = hasSmsPermission()
            if (!hasSmsPermission()) toast("Chưa được cấp quyền SMS. Bạn vẫn có thể kiểm tra thủ công hoặc qua thông báo.")
        }
        refreshProtection()
    }
    private fun hasSmsPermission() = BuildConfig.FLAVOR == "internal" && checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
    private fun requestAlertPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), alertPermissionCode)
    }
    private fun openAlertSettings() = safeStart(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
    private fun openNotificationAccess() {
        AlertDialog.Builder(this).setTitle("Quyền truy cập thông báo")
            .setMessage("Ở màn hình tiếp theo, chọn ScamCheck rồi cấp quyền nếu bạn đồng ý. Bản cài APK có thể bị Android giới hạn quyền nhạy cảm; hãy đọc cảnh báo của hệ thống và chỉ cấp quyền nếu tin cậy nguồn ứng dụng. Không cần tắt Play Protect. Nếu không cấp được, dùng kiểm tra thủ công.")
            .setNegativeButton("Để sau", null).setPositiveButton("Mở cài đặt Android") { _, _ -> safeStart(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }.show()
    }
    private fun safeStart(intent: Intent) {
        try { startActivity(intent) } catch (_: Exception) { toast("Thiết bị không mở được trang này. Vào Cài đặt → Ứng dụng → ScamCheck để kiểm tra quyền.") }
    }
    private fun packageLabel(pkg: String): String = try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() } catch (_: PackageManager.NameNotFoundException) { pkg }
    private fun dismissKeyboard() {
        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(messageInput.windowToken, 0)
        messageInput.clearFocus()
    }
    private fun toast(value: String) = Toast.makeText(this, value, Toast.LENGTH_LONG).show()
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun card() = column().apply { setPadding(dp(16), dp(16), dp(16), dp(16)); background = rounded(Color.WHITE) }
    private fun label(value: String, size: Int, color: Int = muted, bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size.toFloat(); setTextColor(color)
        typeface = Typeface.create(Typeface.DEFAULT, if (bold) Typeface.BOLD else Typeface.NORMAL)
        setLineSpacing(dp(3).toFloat(), 1f)
    }
    private fun button(value: String, primary: Boolean = true, action: () -> Unit) = Button(this).apply {
        text = value; textSize = 14f; isAllCaps = false; setTextColor(if (primary) Color.WHITE else ink)
        background = rounded(if (primary) blue else pale); setPadding(dp(12), dp(10), dp(12), dp(10)); minHeight = dp(48)
        setOnClickListener { action() }
    }
    private fun <T : View> T.gap(top: Int): T {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(top) }
        return this
    }
    private fun rounded(fill: Int) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE; cornerRadius = dp(16).toFloat(); setColor(fill)
        setStroke(dp(1), if (fill == blue) blue else Color.rgb(216, 228, 242))
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private companion object { const val maxInputLength = 5_000; const val smsPermissionCode = 71; const val alertPermissionCode = 72 }
}
