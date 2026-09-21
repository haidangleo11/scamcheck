# ScamCheck Mobile — Android 0.2.0

Bản Android thử nghiệm của ScamCheck: kiểm tra tin nhắn bằng AI hoặc bộ lọc trên thiết bị, kèm cảnh báo cho thông báo mới từ những ứng dụng người dùng chủ động chọn. Yêu cầu **Android 8.0 trở lên**.

Đây là APK ký bằng khóa debug để thử nghiệm, chưa phải bản phát hành chính thức hay ứng dụng đã được Google Play phê duyệt. ScamCheck hỗ trợ nhận biết dấu hiệu rủi ro, không xác minh danh tính người gửi và không bảo đảm phát hiện mọi hành vi lừa đảo.

## Chọn một trong hai APK

| Tải từ GitHub Release `mobile-v0.2.0` | Phạm vi sử dụng |
| --- | --- |
| [ScamCheck-Mobile-0.2.0-SMS.apk](https://github.com/haidangleo11/scamcheck/releases/download/mobile-v0.2.0/ScamCheck-Mobile-0.2.0-SMS.apk) | Bản `internalDebug`: có thể xin quyền `RECEIVE_SMS` để kiểm tra SMS mới trên thiết bị. Không yêu cầu `READ_SMS`, không đọc hộp thư cũ. |
| [ScamCheck-Mobile-0.2.0-NoSMS.apk](https://github.com/haidangleo11/scamcheck/releases/download/mobile-v0.2.0/ScamCheck-Mobile-0.2.0-NoSMS.apk) | Bản `playDebug`: không có quyền SMS; vẫn có kiểm tra thủ công, Chia sẻ và bảo vệ thông báo. Tên flavor `play` không đồng nghĩa với việc đã được Google Play duyệt. |

Chỉ cần cài **một bản**. Hai bản có tên hiển thị giống nhau nhưng mã ứng dụng khác nhau:

- SMS: `app.scamcheck.mobile.internal`.
- NoSMS: `app.scamcheck.mobile.play`.

Hai APK đính kèm release này có `versionCode = 2`, giữ mã ứng dụng và khóa ký thử nghiệm cũ để cập nhật cùng flavor. Bản tự build từ mã nguồn có thể dùng khóa debug riêng của người build. Cập nhật đè chỉ thành công khi mã ứng dụng và chứng chỉ ký trùng với bản đã cài. Không gỡ bản cũ ngay nếu Android báo lỗi cài đặt; trước tiên ghi lại thông báo lỗi, dòng máy và phiên bản Android.

Hướng dẫn cho người dùng: [HUONG-DAN.md](releases/0.2.0/HUONG-DAN.md).

## Các chức năng của bản 0.2

- **Kiểm tra thủ công:** dán tối đa 5.000 ký tự; chọn bộ lọc không cần mạng hoặc phân tích AI. Trước mỗi lần gửi AI, app hiện nội dung đã che bớt để người dùng xem lại và xác nhận.
- **Chia sẻ văn bản:** chọn Chia sẻ → ScamCheck hoặc mục xử lý văn bản của Android, nếu ứng dụng nguồn hỗ trợ. Nhận nội dung không tự động tải lên AI.
- **Bảo vệ thông báo:** mặc định tắt. Cần bật trong app, cấp quyền truy cập thông báo của Android và chọn danh sách ứng dụng. Chỉ xử lý thông báo mới có nội dung được hệ thống cung cấp; không quét lịch sử thông báo.
- **AI tự động:** lựa chọn đồng ý riêng, mặc định tắt. Chỉ những bản xem trước có dấu hiệu rủi ro do bộ lọc trên máy chọn mới được gửi để phân tích, không phải mọi tin nhắn. Có giới hạn hàng đợi và tần suất yêu cầu.
- **SMS Guard:** chỉ bản SMS. Xử lý SMS mới ngay trên điện thoại sau khi được bật và cấp quyền; nội dung SMS nhận trực tiếp không được gửi lên AI.
- **Chi tiết cảnh báo:** chạm cảnh báo hoặc mở danh sách trong tab Bảo vệ để xem nội dung đã che bớt, dấu hiệu, hướng dẫn và nguồn phân tích. Thông báo hệ thống không hiển thị nội dung tin nhắn riêng tư.
- **Trạng thái rõ ràng:** có nút bật/tắt, chọn app và kiểm tra quyền. Nếu AI lỗi, hiển thị rõ kết quả dự phòng là bộ lọc trên thiết bị, không gán nhãn đó là kết quả AI.

## Dữ liệu và quyền riêng tư

1. App không dùng Accessibility, quyền vẽ đè, ghi màn hình hoặc đọc toàn bộ nội dung ứng dụng khác. Android có thể ẩn thông báo nhạy cảm; ScamCheck không vượt qua giới hạn đó.
2. Bảo vệ thông báo bỏ qua ứng dụng không được chọn trước khi đọc phần nội dung của thông báo. Quyền truy cập thông báo vẫn là quyền nhạy cảm do Android quản lý; người dùng có thể thu hồi trong Cài đặt.
3. Phân tích AI gửi nội dung qua HTTPS tới máy chủ ScamCheck tại `scamcheck-c3chuyenhvt.vercel.app`, rồi tới nhà cung cấp AI. Khóa API của nhà cung cấp không được đóng gói trong APK. Không khẳng định máy chủ hoặc nhà cung cấp không lưu dữ liệu nếu chưa có chính sách riêng xác nhận điều đó.
4. Bộ che dữ liệu xử lý một số mẫu OTP, mật khẩu, số điện thoại, số tài khoản, giấy tờ và tham số liên kết nhạy cảm. Đây là biện pháp giảm dữ liệu theo mẫu, **không bảo đảm loại bỏ mọi thông tin cá nhân**. Không bật AI tự động cho app chứa nội dung không muốn chia sẻ.
5. SMS nhận trực tiếp luôn xử lý cục bộ. Tuy nhiên, nếu người dùng đồng thời chọn ứng dụng SMS trong Bảo vệ thông báo và bật AI tự động, bản xem trước thông báo của app SMS có thể được gửi tới AI theo lựa chọn đó.
6. Lưu tối đa 20 cảnh báo đã che bớt, tối đa một giờ, trong bộ nhớ tiến trình; không ghi nội dung cảnh báo xuống đĩa. Danh sách có thể mất sớm hơn khi Android dừng app. Cấu hình bật/tắt và danh sách app được lưu trên thiết bị; sao lưu ứng dụng đã tắt.
7. Tắt Bảo vệ thông báo cũng tắt AI tự động. Muốn dùng AI tự động trở lại cần bật và đồng ý lại. Dữ liệu đã gửi trước khi tắt không thể thu hồi bằng nút này.

## Giới hạn cần hiểu đúng

- Đây là công cụ nhận diện dấu hiệu, không phải phần mềm kiểm soát mọi thứ trên điện thoại. Tin nhắn không có bản xem trước có thể không được kiểm tra tự động.
- Bộ lọc cục bộ và AI đều có thể báo nhầm hoặc bỏ sót. Mức “chưa thấy dấu hiệu nổi bật” không có nghĩa là tin nhắn chắc chắn an toàn.
- AI cần mạng và máy chủ khả dụng. Thông báo, quyền nhạy cảm, hạn chế chạy nền và cách nhà sản xuất quản lý pin có thể ảnh hưởng hoạt động.
- Tên “NoSMS” chỉ có nghĩa là không xin quyền nhận/đọc SMS trực tiếp; thông báo của app SMS vẫn nằm trong phạm vi nếu người dùng chủ động chọn.
- Cần kiểm thử thêm trên thiết bị thật và hoàn thiện yêu cầu phát hành/chính sách trước khi phân phối rộng rãi.

## Xây dựng APK

Dự án dùng giao diện Android native, Kotlin 2.0.21, Android Gradle Plugin 8.7.3, `compileSdk/targetSdk = 36`, Build Tools 35.0.0 và mã bytecode Java 17. Gradle Wrapper cố định Gradle 8.13; bản đã kiểm thử dùng JDK 21.

1. Clone repository, mở thư mục `scamcheck-mobile` trong Android Studio hoặc chuyển terminal vào thư mục này.
2. Cài Android SDK Platform 36 và Build Tools 35.0.0. Đặt `JAVA_HOME` trỏ tới JDK và `ANDROID_HOME` trỏ tới Android SDK của máy bạn; Android Studio cũng có thể tạo `local.properties` riêng. Không commit tệp này.
3. Chạy trên Windows:

   ```powershell
   .\gradlew.bat :app:assembleInternalDebug :app:assemblePlayDebug
   .\gradlew.bat :app:lintInternalDebug :app:lintPlayDebug
   ```

   Trên macOS/Linux, dùng `./gradlew` thay cho `.\gradlew.bat`. Lần build đầu cần mạng để tải Gradle và các thư viện. Có thể dùng `build-apk.ps1` để build và lint cả hai flavor trên PowerShell.
4. APK được tạo tại `app/build/outputs/apk/internal/debug/app-internal-debug.apk` và `app/build/outputs/apk/play/debug/app-play-debug.apk`.

Khóa ký cũ không được công bố trong repository. Nếu người duy trì có khóa thử nghiệm tại `tools/android-home/debug.keystore`, hãy giữ nguyên để cập nhật các bản APK cùng flavor đã phát hành. Checkout mới dùng khóa debug cục bộ riêng nếu không có khóa này, nên APK tự build không mặc nhiên cập nhật đè được APK tải từ release. Không đưa keystore hoặc thông tin ký riêng lên GitHub.

Sau khi build để tải đủ thư viện, chạy các kiểm tra không cần điện thoại:

```powershell
.\tests\run-guard-tests.ps1
node .\tests\verify-guard-source.mjs
```

Script kiểm tra Kotlin ưu tiên JDK/cache phát triển cục bộ nếu có, rồi dùng `JAVA_HOME` hoặc `java` trong `PATH` cùng cache tại `GRADLE_USER_HOME` hoặc `.gradle` trong thư mục người dùng. Kiểm tra ràng buộc mã nguồn cần Node.js. Hai script `tests/smoke-ai.ps1` với `-Mode message_analysis` và `-Mode auto_guard` là kiểm tra mạng tùy chọn, chỉ gửi tin nhắn tổng hợp tới máy chủ ScamCheck.

## Kiểm tra đã thực hiện và phần còn lại

- 55 trường hợp kiểm tra lõi và 18 kiểm tra ràng buộc mã nguồn đã đạt sau các sửa lỗi cuối.
- Hai APK đã biên dịch thành công; Android lint hoàn tất với 0 lỗi, còn cảnh báo không chặn build về giao diện/bản địa hóa.
- Đã xác minh chữ ký APK v2, cùng khóa ký cũ, mã ứng dụng tương ứng giữ nguyên, `versionCode = 2` và `minSdk = 26`.
- Bản SMS đã cài thành công trên trình giả lập biệt lập Android 16/API 36.
- Yêu cầu API thử nghiệm với dữ liệu tổng hợp cho cả chế độ thủ công và tự động đã nhận HTTP 200 và phản hồi đúng cấu trúc kiểm tra.
- Các kết quả trên **không phải số đo độ chính xác phát hiện lừa đảo**, không thay thế kiểm thử giao diện, quyền hệ thống hay thiết bị thật.
- Đã mở và kiểm tra trực quan giao diện Kiểm tra, Bảo vệ, nhận văn bản Chia sẻ và hộp thoại đồng ý gửi AI trên trình giả lập. Chưa xác nhận luồng cảnh báo tự động đầu-cuối hay hoạt động nền trên điện thoại thật; đây không phải kết quả đạt toàn bộ bài thử giao diện.
- Danh sách kiểm tra thiết bị: `tests/guard-device-checklist.md`.

Không cần và không hướng dẫn tắt Play Protect để dùng ScamCheck. Nếu thiết bị chặn cài đặt hoặc quyền, ghi lại nguyên văn lỗi và dùng phương án kiểm tra thủ công khi phù hợp; không bỏ qua cảnh báo bảo mật một cách mặc định.
