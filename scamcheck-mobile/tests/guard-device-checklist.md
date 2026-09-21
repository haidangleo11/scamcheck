# Android Guard verification checklist

These are device acceptance tests, not claims of completed testing. Use a dedicated test device/emulator and synthetic messages, never real OTPs or account details.

1. Fresh install: SMS Guard, Notification Guard and automatic AI are off; app selection is empty. No previews are analyzed before opt-in.
2. Grant notification-listener access but leave in-app guard off. Notifications from other apps produce no warning and no AI request.
3. Select one test messaging app, turn guard on, leave automatic AI off. A suspicious new preview gives a local warning; a normal greeting does not. An unselected app does nothing.
4. Disable/deny ScamCheck notification permission or its alert channel. The UI describes that warnings cannot be displayed; receiving content must not crash.
5. Repost/update the same preview repeatedly. The warning is not repeated. Burst distinct previews: at most one new warning per source in 20 seconds, AI jobs limited to three queued.
6. Enable automatic AI only after reading consent. Only locally suspicious candidates from selected apps reach AI. Network failure and malformed AI output leave the local result visible, with AI unavailable shown.
7. Queue an AI check, then switch off automatic AI or guard, unselect the source app, revoke listener access, or clear alert history. Pending jobs are rejected at network preflight; in-flight results cannot add/replace alerts. An already-started request cannot be recalled from the server.
8. While first AI request is slow, send a newer suspicious preview from the same source after 20 seconds. The older result may update its history entry but not replace the newer tray warning.
9. Lock device. System notification shows only a generic safety warning, not message text, sender, OTP, AI explanation, or source-app metadata.
10. Tap a warning: open its redacted review and show analysis source. After process recreation/one-hour expiry/history clear, explain details expired; do not imply a safe result.
11. Disable guard and re-enable it. Do not scan prior active notifications automatically. New events may be inspected only for selected apps.
12. Internal APK: grant RECEIVE_SMS and enable SMS Guard. New suspicious SMS gives local warning. SMS is never uploaded by the receiver; no SMS inbox access is requested. Disabling SMS Guard stops inspection.
13. Android 15/16: respect system redaction of sensitive notifications. Missing preview text must not crash and must not be portrayed as complete coverage.
14. At least one real-phone run is needed for manufacturer background restrictions, heads-up display, notification access restrictions, and SMS delivery behavior.
