# ScamCheck Chrome Extension

Extension là phiên bản ScamCheck thu nhỏ trong Chrome: giao diện Việt–Anh, dark mode, quét phần chữ đã bôi đen, OCR vùng ảnh và phân tích AI dùng cùng endpoint RAG với website. Ảnh chụp vùng chọn không được gửi tới API.

## AI Auto Guard trên mọi trang

Extension có thể chạy trên mọi website mà Chrome cho phép (không chạy được trên Chrome internal pages, Chrome Web Store và các trang mà trình duyệt chặn extension). **AI Auto Guard tắt mặc định** và chỉ hoạt động sau khi người dùng chủ động bật công tắc trong popup.

Khi bật, extension lấy tối đa 6.000 ký tự **đang hiển thị** cùng các liên kết có trên trang, bỏ qua toàn bộ ô nhập liệu, biểu mẫu, mật khẩu và giao diện ScamCheck. Ảnh chụp chữ này được gửi qua HTTPS tới endpoint ScamCheck để Groq AI đánh giá dựa trên danh mục lừa đảo của ScamCheck. Extension chỉ gửi lại khi nội dung trang thay đổi và cách mỗi lần ít nhất 15 giây; khi AI không sẵn sàng, nó không tự hiện cảnh báo.

Khi AI nhận thấy dấu hiệu đủ rõ ràng, ScamCheck hiện cảnh báo tại chỗ. Bạn có thể xem lý do, tắt cảnh báo cho riêng website hiện tại, hoặc tắt AI Auto Guard bất cứ lúc nào. Chrome hiển thị quyền đọc/chỉnh sửa dữ liệu trên website để extension có thể lấy chữ đang hiển thị và đặt lớp cảnh báo.

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

Ảnh vùng chọn chỉ được OCR trên thiết bị. Khi bấm **Phân tích bằng AI**, phần văn bản OCR hoặc văn bản đã dán và các liên kết được tìm thấy được gửi qua HTTPS để phân tích. Khi người dùng bật **AI Auto Guard**, phần chữ đang hiển thị theo giới hạn và loại trừ ở trên cũng được gửi để phát hiện tự động. Xem chính sách đầy đủ tại https://scamcheck-c3chuyenhvt.vercel.app/privacy.html.

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
