# ScamCheck Desktop for Windows

Ứng dụng Windows độc lập của ScamCheck. Giao diện chính kế thừa từ web app và dùng backend AI đã triển khai trên Vercel; khóa API không được đóng gói trong ứng dụng.

## Cơ chế desktop

- **Quét thủ công:** dán tin nhắn, tải ảnh, OCR, quét QR, microphone và toàn bộ chức năng web hiện có.
- **Quét clipboard:** khi người dùng bật, app chỉ xử lý đoạn chữ mới được sao chép, tối đa 5.000 ký tự.
- **Quét màn hình:** khi người dùng bấm quét hoặc bật theo dõi, app chụp phần màn hình đang hiển thị và OCR cục bộ trước. Chế độ theo dõi kiểm tra tối đa mỗi 60 giây.
- **AI tự động:** mặc định tắt. Nếu người dùng bật, chỉ nội dung có tín hiệu rủi ro cục bộ rõ ràng mới được gửi tới API ScamCheck để đánh giá.
- **Bảo mật:** OTP và giá trị ngay sau nhãn mật khẩu/mã xác minh được che trước khi tự động xử lý. App không mở link, không quét các trang/ứng dụng Windows chặn capture và không thể đọc nội dung không hiển thị.

Khi đóng cửa sổ, ScamCheck sẽ thu nhỏ vào khay hệ thống. Nhấn chuột vào icon khay để mở lại; chọn **Thoát** để dừng hoàn toàn. Phím tắt `Ctrl + Shift + S` đưa clipboard hiện tại vào ScamCheck để kiểm tra.

## Phát triển và đóng gói

```powershell
cd D:\prototype\scamcheck-desktop
npm install
npm run dev
npm run dist:win
```

File cài đặt NSIS được tạo tại `release\ScamCheck-Setup-1.0.0.exe`. Installer tạo shortcut Desktop/Start Menu, cho chọn thư mục cài đặt và có trình gỡ cài đặt chuẩn Windows.
