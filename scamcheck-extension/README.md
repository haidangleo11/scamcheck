# ScamCheck Chrome Extension

Extension này cho phép khoanh vùng một đoạn tin nhắn trên trang web, OCR ngay trong Chrome và sau đó gửi **phần văn bản đã nhận dạng cùng các URL tìm được** đến ScamCheck để AI đánh giá. Ảnh chụp vùng chọn không được gửi tới API.

## Cài vào Chrome

1. Mở chrome://extensions.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn chính thư mục D:\prototype\scamcheck-extension.

## Cấu hình Vercel trước khi dùng AI

Backend của dự án ScamCheck đã được triển khai trên Vercel. Khóa Groq được lưu dưới dạng biến môi trường nhạy cảm ở phía máy chủ và không có trong extension.

Endpoint AI:

https://scamcheck-c3chuyenhvt.vercel.app/api/chat

Nếu đổi tên miền Vercel, hãy thay hằng số `API_BASE_URL` ở đầu `background.js`.

## Quyền riêng tư

Ảnh vùng chọn chỉ được OCR trên thiết bị. Chỉ khi bấm **Phân tích bằng AI**, phần văn bản OCR hoặc văn bản đã dán và các liên kết được tìm thấy mới được gửi qua HTTPS để phân tích. Xem chính sách đầy đủ tại https://scamcheck-c3chuyenhvt.vercel.app/privacy.html.

## Cách dùng

1. Mở trang có tin nhắn nghi ngờ.
2. Bấm icon ScamCheck → **Khoanh vùng tin nhắn trên trang**.
3. Kéo chuột quanh phần cần đọc; OCR chạy cục bộ.
4. Bấm lại icon ScamCheck, kiểm tra/sửa phần chữ OCR rồi chọn **Phân tích bằng AI**.

Lần OCR đầu tiên Chrome sẽ tải mô hình nhận dạng tiếng Việt công khai; mô hình này không chứa nội dung ảnh của bạn. Extension không hoạt động trên các trang nội bộ của Chrome như chrome://.
