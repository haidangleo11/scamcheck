# ScamCheck Chrome Extension

Extension này cho phép khoanh vùng một đoạn tin nhắn trên trang web, OCR ngay trong Chrome và sau đó gửi **phần văn bản đã nhận dạng cùng các URL tìm được** đến ScamCheck để AI đánh giá. Ảnh chụp vùng chọn không được gửi tới API.

## Cài vào Chrome

1. Mở chrome://extensions.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn chính thư mục D:\prototype\scamcheck-extension.

Chrome phải hiển thị mã extension là koiifpehmdcljfimgjfinmnggmdjihod. Mã này được cố định để backend chỉ nhận yêu cầu từ extension này.

## Cấu hình Vercel trước khi dùng AI

Triển khai các tệp backend trong C:\Users\leoha\OneDrive\Documents\GitHub\togithub lên Vercel, sau đó đặt các Environment Variables sau:

GROQ_API_KEY=<khóa Groq của bạn>
ALLOWED_ORIGINS=https://thptchuyenhvt.github.io
ALLOWED_EXTENSION_ORIGIN=chrome-extension://koiifpehmdcljfimgjfinmnggmdjihod

Sau khi redeploy, endpoint cần hoạt động là:

https://scamcheck-tlov.vercel.app/api/chat

Nếu Vercel có URL khác, thay hằng số API_BASE_URL ở đầu background.js và hằng số API_BASE_URL trong D:\prototype\index.html.

## Cách dùng

1. Mở trang có tin nhắn nghi ngờ.
2. Bấm icon ScamCheck → **Khoanh vùng tin nhắn trên trang**.
3. Kéo chuột quanh phần cần đọc; OCR chạy cục bộ.
4. Bấm lại icon ScamCheck, kiểm tra/sửa phần chữ OCR rồi chọn **Phân tích bằng AI**.

Lần OCR đầu tiên Chrome sẽ tải mô hình nhận dạng tiếng Việt công khai; mô hình này không chứa nội dung ảnh của bạn. Extension không hoạt động trên các trang nội bộ của Chrome như chrome://.
