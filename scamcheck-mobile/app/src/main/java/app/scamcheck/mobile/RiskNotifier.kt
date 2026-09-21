package app.scamcheck.mobile

import android.app.NotificationChannel
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

object RiskNotifier {
    private const val channelId = "scamcheck_sms_guard"
    fun canNotify(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val manager = context.getSystemService(NotificationManager::class.java)
        return manager.areNotificationsEnabled() && manager.getNotificationChannel(channelId)?.importance != NotificationManager.IMPORTANCE_NONE
    }

    fun showWarning(context: Context, alert: GuardAlert, isUpdate: Boolean = false) {
        if (alert.evaluation.level == RiskLevel.SAFE || !canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(channelId, "Cảnh báo ScamCheck", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Nhắc xác minh khi tin nhắn hoặc thông báo có dấu hiệu rủi ro"
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        }
        manager.createNotificationChannel(channel)

        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(GuardInbox.EXTRA_ALERT_ID, alert.id)
            .setAction("app.scamcheck.mobile.REVIEW.${alert.id}")
        val openApp = PendingIntent.getActivity(
            context, alert.id.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = if (alert.evaluation.level == RiskLevel.HIGH) "ScamCheck: Có dấu hiệu rủi ro cao" else "ScamCheck: Có điểm cần xác minh"
        val publicVersion = Notification.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification_shield)
            .setContentTitle("ScamCheck có cảnh báo mới")
            .setContentText("Mở khóa và chạm để xem hướng dẫn.")
            .setContentIntent(openApp).build()
        val notification = Notification.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification_shield)
            .setContentTitle(title)
            .setContentText("Đừng vội bấm liên kết hoặc gửi tiền. Chạm để xem chi tiết.")
            .setStyle(Notification.BigTextStyle().bigText("Một nội dung vừa nhận có dấu hiệu cần kiểm tra. Hãy xác minh qua kênh chính thức trước khi làm theo. Đây không phải kết luận chắc chắn về người gửi."))
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setCategory(Notification.CATEGORY_RECOMMENDATION)
            .setOnlyAlertOnce(isUpdate)
            .setAutoCancel(true)
            .setTimeoutAfter(60 * 60 * 1_000L)
            .setContentIntent(openApp)
            .build()
        // At most one warning per source app; no private text appears in the system tray.
        runCatching { manager.notify("scamcheck:${alert.sourcePackage}", 2048, notification) }
    }

    fun showHighRiskWarning(context: Context, evaluation: RiskEvaluation) {
        val alert = GuardInbox.add("sms", "SMS", "", evaluation, "Bộ lọc trên thiết bị")
        showWarning(context, alert)
    }
}
