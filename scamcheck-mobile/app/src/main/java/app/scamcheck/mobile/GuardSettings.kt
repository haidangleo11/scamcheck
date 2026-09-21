package app.scamcheck.mobile

import android.content.Context

/** Protection is opt-in. Only preferences, never message content, are persisted. */
class GuardSettings(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences("scamcheck_guard", Context.MODE_PRIVATE)

    var smsGuardEnabled: Boolean
        get() = preferences.getBoolean("sms_guard_enabled", false)
        set(value) = setBoolean("sms_guard_enabled", value)

    var notificationGuardEnabled: Boolean
        get() = preferences.getBoolean("notification_guard_enabled", false)
        set(value) = setBoolean("notification_guard_enabled", value)

    var automaticAiEnabled: Boolean
        get() = preferences.getBoolean("automatic_ai_enabled", false)
        set(value) = setBoolean("automatic_ai_enabled", value)

    var selectedPackages: Set<String>
        get() = preferences.getStringSet("selected_packages", emptySet()).orEmpty().toSet()
        set(value) {
            val filtered = value.filter { it.isNotBlank() && !it.startsWith("app.scamcheck.mobile") }.toSet()
            if (filtered == selectedPackages) return
            preferences.edit().putStringSet("selected_packages", filtered)
                .putLong("configuration_revision", configurationRevision + 1).apply()
        }

    /** A privacy-setting change invalidates queued/in-flight background results. */
    val configurationRevision: Long
        get() = preferences.getLong("configuration_revision", 0)

    fun allowsPackage(packageName: String): Boolean = notificationGuardEnabled &&
        !packageName.startsWith("app.scamcheck.mobile") && packageName in selectedPackages

    private fun setBoolean(key: String, value: Boolean) {
        if (preferences.getBoolean(key, false) == value) return
        preferences.edit().putBoolean(key, value)
            .putLong("configuration_revision", configurationRevision + 1).apply()
    }
}
