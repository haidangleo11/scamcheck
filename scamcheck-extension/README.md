# ScamCheck Chrome Extension

Extension là phiên bản ScamCheck thu nhỏ trong Chrome: giao diện Việt–Anh, dark mode, quét phần chữ đã bôi đen, OCR vùng ảnh và phân tích AI dùng cùng endpoint RAG với website. Ảnh chụp vùng chọn không được gửi tới API.

## Bảo vệ tự động trên mọi trang

Mặc định, extension chạy trên mọi website mà Chrome cho phép (không chạy được trên Chrome internal pages, Chrome Web Store và các trang mà trình duyệt chặn extension). Nó chỉ quét **nội dung đang hiển thị** và đường link trên trang ngay trên thiết bị, không đọc giá trị trong ô mật khẩu/form và không tự gửi nội dung trang sang AI.

Khi nhiều dấu hiệu mạnh cùng xuất hiện, ScamCheck hiện cảnh báo tại chỗ. Bạn có thể:

- xem hướng dẫn an toàn cục bộ;
- tắt cảnh báo cho riêng website hiện tại;
- tắt/bật **Bảo vệ tự động** trong popup.

Chrome sẽ hiển thị quyền đọc/chỉnh sửa dữ liệu trên các trang web khi cài hoặc cập nhật bản này. Quyền đó chỉ được dùng để hiển thị lớp cảnh báo và quét cục bộ; phân tích AI vẫn cần bạn bấm nút chủ động.

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

1. Mở trang có tin nhắn nghi ngờ và **bôi đen đúng đoạn cần kiểm tra**.
2. Bấm icon ScamCheck → **Đọc phần đã bôi đen**. Extension chỉ lấy phần người dùng đã chọn, không tự quét toàn bộ trang.
3. Hoặc chọn **Quét ảnh trên trang** rồi kéo chuột quanh nội dung; OCR chạy cục bộ.
4. Kiểm tra/sửa phần chữ trong popup, chọn ngôn ngữ nếu cần, rồi bấm **Phân tích với ScamCheck**.
5. Kết quả hiện trong popup và một thẻ nhỏ trên trang. Khi AI tạm lỗi, extension chuyển sang đối chiếu mẫu cục bộ và ghi rõ giới hạn đó.

## RAG và chế độ dự phòng

- Khi trực tuyến, phần chữ được gửi đến endpoint chung của ScamCheck. Backend truy xuất các mẫu lừa đảo tham chiếu trước khi yêu cầu AI kết luận.
- Khi không kết nối được AI, extension vẫn đối chiếu một bộ mẫu rút gọn ngay trên thiết bị. Đây chỉ là hướng dẫn an toàn, không phải xác minh chính thức.

Mô hình nhận dạng tiếng Việt và tiếng Anh được đóng gói sẵn trong extension, nên OCR không phụ thuộc vào máy chủ mô hình bên ngoài. Extension không hoạt động trên các trang nội bộ của Chrome như chrome://.
