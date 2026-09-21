# ScamCheck Mobile 0.2.0 — Android test release

Download **one** APK below. Requires Android 8.0 or newer.

- **SMS.apk**: optional on-device checking of newly received SMS, plus all notification/manual features.
- **NoSMS.apk**: no SMS permission; supports shared/pasted text and selected-app notification protection.

## What's new

- Separate Check and Protection screens.
- Opt-in notification protection for applications you choose; no screen scraping or Accessibility service.
- Optional automatic AI analysis of locally flagged notification previews, with separate consent.
- Best-effort masking of sensitive codes and identifiers before upload; manual AI sends require a preview/confirmation.
- Generic system alerts without copying private message text; redacted details retained temporarily in app memory.
- Clear local fallback when AI is unavailable, warning deduplication and bounded background requests.
- Turning notification protection off also turns off automatic AI.

Open **Bảo vệ → Chọn ứng dụng cần bảo vệ → Bật bảo vệ thông báo**, then grant the permissions you agree to. AI is off by default. Direct SMS analysis stays on-device; selected SMS-app notification previews follow the separate automatic-AI preference.

## Verification and limitations

- Both variants compile; Android lint completed with zero errors (six non-blocking warnings).
- 55 JVM checks and 18 source-invariant checks passed.
- Synthetic manual and automatic AI API requests returned HTTP 200 and the expected schema.
- The SMS APK installed and opened in an Android 16/API 36 emulator; home/protection/share/consent screens were inspected.
- Full automatic-warning end-to-end behavior and real-phone background reliability are **not yet verified**.

These are **debug-signed test APKs**, not Google Play-approved or production-certified releases. Detection and redaction can miss content or produce false alarms. Android can hide notification content or restrict access/background behavior. Do not disable Play Protect to install.

The application IDs and original test signing certificate are retained for updates from the matching prior variant. Building from source with your own debug key does not produce an in-place compatible update to these APKs. Private signing keys are not published.

See `HUONG-DAN.md` for Vietnamese setup instructions and `SHA256SUMS.txt` for asset checksums.
