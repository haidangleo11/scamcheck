# ScamCheck Mobile 0.2 — Hướng dẫn cài và sử dụng

**Yêu cầu:** điện thoại Android 8.0 trở lên. Đây là bản APK thử nghiệm ký debug, chưa phải ứng dụng đã được Google Play phê duyệt.

## 1. Chọn một bản để cài

- **[ScamCheck-Mobile-0.2.0-SMS.apk](https://github.com/haidangleo11/scamcheck/releases/download/mobile-v0.2.0/ScamCheck-Mobile-0.2.0-SMS.apk)**: phù hợp nếu bạn muốn thử cả SMS Guard. App có thể xin quyền nhận SMS mới; không xin quyền đọc hộp thư SMS cũ.
- **[ScamCheck-Mobile-0.2.0-NoSMS.apk](https://github.com/haidangleo11/scamcheck/releases/download/mobile-v0.2.0/ScamCheck-Mobile-0.2.0-NoSMS.apk)**: không xin quyền SMS. Vẫn kiểm tra được văn bản bạn dán/chia sẻ và thông báo từ các app được bạn chọn.

Chỉ cần cài **một bản**. Bản NoSMS không có nghĩa là “bản được Google Play duyệt”. Hai bản có cùng tên hiển thị **ScamCheck Mobile** nhưng là hai mã ứng dụng khác nhau.

## 2. Cài đặt hoặc cập nhật

1. Chuyển APK đã chọn sang điện thoại. Mở ứng dụng quản lý tệp, tìm tệp trong **Bộ nhớ trong → Download**; nếu nhận qua Zalo, kiểm tra thêm thư mục **Download → Zalo**. Vị trí thực tế tùy máy và cách tải.
2. Chỉ mở APK từ nguồn bạn tin cậy. Nếu Android yêu cầu quyền cài ứng dụng từ nguồn này, đọc kỹ thông báo và chỉ đồng ý khi đã xác minh tệp.
3. Nếu đang dùng bản cũ, chọn cùng bản SMS hoặc NoSMS để cập nhật. Hai APK tải từ release 0.2 giữ mã ứng dụng và khóa ký thử nghiệm cũ; việc cập nhật đè yêu cầu bản đang cài có cùng mã ứng dụng và chứng chỉ ký. APK tự build từ mã nguồn có thể dùng khóa riêng và không cập nhật đè được bản release.
4. Mở **ScamCheck Mobile** sau khi cài xong.

**Không tắt Play Protect.** Nếu xuất hiện “Chưa cài đặt được ứng dụng này”, “Ứng dụng không tương thích” hoặc cảnh báo khác, đừng gỡ app cũ ngay. Gửi lại nguyên văn/ảnh lỗi, tên dòng điện thoại, phiên bản Android, tệp APK vừa dùng và bản cũ đang cài để xác định nguyên nhân.

## 3. Kiểm tra một tin nhắn

1. Mở tab **Kiểm tra**, dán nội dung; hoặc chọn **Chia sẻ → ScamCheck** từ ứng dụng khác nếu ứng dụng đó hỗ trợ.
2. Chọn **Kiểm tra nhanh • không cần mạng** để dùng bộ lọc trên điện thoại, hoặc **Phân tích với AI**.
3. Nếu chọn AI, app sẽ cho xem lại nội dung đã che bớt. Xóa/sửa mọi dữ liệu riêng tư còn sót trước khi nhấn **Gửi phân tích**.
4. Đọc dấu hiệu và bước xác minh; không coi kết quả là bảo đảm an toàn.

Chia sẻ sang ScamCheck **không tự động gửi dữ liệu tới AI**. Giới hạn nội dung nhập là 5.000 ký tự. Nếu mạng hoặc AI lỗi, app hiển thị rõ kết quả bộ lọc dự phòng, không giả thành kết quả AI.

## 4. Bật cảnh báo cho các ứng dụng bạn chọn

Tất cả lựa chọn theo dõi đều mặc định tắt.

1. Vào tab **Bảo vệ** → **Chọn ứng dụng cần bảo vệ**. Chỉ chọn các app bạn muốn kiểm tra thông báo, chẳng hạn app nhắn tin đang dùng.
2. Nhấn **Bật bảo vệ thông báo**, đọc phần giải thích và đồng ý nếu phù hợp.
3. Mở **Quyền truy cập thông báo**, chọn ScamCheck và cấp quyền trong Cài đặt Android nếu bạn đồng ý.
4. Quay lại app. Nếu báo cảnh báo đang bị chặn, dùng **Cho phép ScamCheck hiện cảnh báo** và kiểm tra quyền/kênh thông báo của ScamCheck.
5. Xem dòng trạng thái để biết còn thiếu quyền hay chưa chọn app.

ScamCheck chỉ xử lý **thông báo mới có nội dung Android cho phép đọc** từ app được chọn. Không đọc toàn bộ màn hình, lịch sử trò chuyện hoặc phần nội dung Android đã ẩn. App không dùng Accessibility hay cửa sổ nổi để lấy nội dung.

Android có thể giới hạn quyền nhạy cảm cho APK cài ngoài. Hãy đọc cảnh báo hệ thống; nếu không cấp được hoặc không muốn cấp, bạn vẫn có thể dùng cách dán/chia sẻ thủ công.

## 5. AI tự động là một lựa chọn riêng

Trong tab **Bảo vệ**, chọn **Bật AI tự động** và đọc phần xin đồng ý. Khi bật:

- Chỉ thông báo có dấu hiệu đáng ngờ do bộ lọc trên máy chọn mới có thể được gửi tới máy chủ ScamCheck và nhà cung cấp AI qua HTTPS.
- Không phải mọi tin nhắn đều được AI phân tích. App có giới hạn hàng đợi và tần suất gửi.
- App cố gắng che một số mẫu OTP, mật khẩu và số nhạy cảm, nhưng **không thể bảo đảm che hết dữ liệu riêng tư**. Không bật cho app có nội dung bạn không muốn chia sẻ.
- Nếu AI không khả dụng, kết quả bộ lọc trên máy vẫn được phân biệt rõ.

Bạn có thể tắt AI riêng. Tắt Bảo vệ thông báo cũng tắt AI tự động; lần sau muốn dùng AI tự động phải bật và đồng ý lại. Nút tắt không thu hồi dữ liệu đã gửi trước đó.

## 6. SMS Guard trên bản SMS

Trong tab **Bảo vệ**, chọn **Bật SMS Guard**, đọc phần giải thích và cấp quyền nhận SMS nếu đồng ý.

- Chỉ kiểm tra SMS mới, không đọc lại hộp thư cũ.
- Phân tích SMS nhận trực tiếp bằng bộ lọc trên điện thoại, không tự gửi SMS trực tiếp tới AI.
- Có thể tắt bằng **Tắt SMS Guard**.

**Lưu ý:** nếu bạn đồng thời chọn ứng dụng SMS trong Bảo vệ thông báo và bật AI tự động, bản xem trước thông báo của ứng dụng SMS có thể được gửi tới AI. Đó là luồng thông báo riêng với SMS Guard.

## 7. Xem và xóa cảnh báo

Chạm thông báo cảnh báo để mở chi tiết, hoặc vào **Bảo vệ → Cảnh báo trong phiên này**. Thông báo hệ thống chỉ hiện lời nhắc chung, không sao chép nội dung tin nhắn riêng tư.

App giữ tối đa **20 cảnh báo trong một giờ**, trong bộ nhớ tạm; không ghi nội dung cảnh báo xuống đĩa. Android dừng app có thể khiến danh sách mất sớm hơn. Dùng **Làm mới danh sách** để cập nhật hoặc **Xóa cảnh báo trong phiên** để xóa. Chi tiết hết hạn không có nghĩa là tin nhắn an toàn.

## 8. Nếu chưa hoạt động như mong muốn

- **Không có cảnh báo:** kiểm tra nút bật, danh sách app, quyền truy cập thông báo và quyền hiển thị cảnh báo. Tin nhắn phải tạo thông báo mới có nội dung được Android cung cấp; app không kiểm tra mọi tin trong cuộc trò chuyện đang mở.
- **Không có kết quả AI:** kiểm tra mạng; thử nội dung mẫu không chứa dữ liệu riêng tư. Đọc nhãn kết quả để phân biệt AI và bộ lọc dự phòng.
- **Android ẩn thông báo/không cấp quyền:** dùng dán hoặc Chia sẻ. Không cần tắt Play Protect.
- **Cảnh báo biến mất sau khi mở lại:** dữ liệu cảnh báo chỉ giữ trong bộ nhớ phiên, không phải lịch sử lưu lâu dài.
- **Báo nhầm hoặc bỏ sót:** ghi lại tình huống bằng dữ liệu đã ẩn danh để phản hồi. Không gửi OTP, mật khẩu hay ảnh chứa thông tin cá nhân thật khi báo lỗi.

## Trạng thái kiểm thử của bản phát triển

- 55 trường hợp kiểm tra lõi và 18 kiểm tra ràng buộc mã nguồn đã đạt sau các sửa lỗi cuối.
- Hai APK đã build thành công; lint hoàn tất với 0 lỗi và còn cảnh báo không chặn build. Chữ ký APK v2 đã được xác minh cùng khóa cũ; mã ứng dụng giữ nguyên, phiên bản tăng lên `versionCode = 2`.
- Bản SMS đã cài thành công trên trình giả lập biệt lập Android 16/API 36.
- Đã mở và kiểm tra trực quan màn hình Kiểm tra, Bảo vệ, nhận văn bản Chia sẻ và hộp thoại đồng ý gửi AI trên trình giả lập.
- Hai yêu cầu API bằng dữ liệu tổng hợp, cho chế độ thủ công và tự động, đã nhận HTTP 200 và đáp ứng cấu trúc kiểm tra.

Đây không phải số đo độ chính xác ngoài thực tế hay xác nhận mọi bài thử giao diện đã đạt. Chưa kiểm chứng đầy đủ luồng cảnh báo tự động đầu-cuối và chưa thử trên điện thoại thật. Cần tiếp tục kiểm tra quyền, thông báo và hoạt động nền trên từng dòng máy trước khi dùng rộng rãi.

**ScamCheck là công cụ hỗ trợ.** Dù kết quả nào, đừng chia sẻ OTP/mật khẩu và hãy xác minh yêu cầu quan trọng qua kênh chính thức.
