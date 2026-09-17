from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader


ROOT = Path(r"D:\prototype")
ASSETS = {
    "icon": ROOT / "icon.png",
    "web": ROOT / "store-assets" / "website-background.png",
    "extension": ROOT / "Screenshot (232).png",
    "popup": ROOT / "store-assets" / "scamcheck-extension-screenshot-1.png",
}
OUT = {
    "en": ROOT / "ScamCheck_NextGen_English_HVT_ShieldSpark.pdf",
    "vi": ROOT / "ScamCheck_NextGen_Vietnamese_HVT_ShieldSpark.pdf",
}

PAGE_W, PAGE_H = A4
M = 42
CW = PAGE_W - 2 * M
NAVY = HexColor("#071A3D")
BLUE = HexColor("#2563EB")
INK = HexColor("#17233A")
MUTED = HexColor("#536177")
LINE = HexColor("#D7E1F0")
PALE = HexColor("#F7FAFF")
PALE_BLUE = HexColor("#EAF2FF")
PALE_GREEN = HexColor("#EAFBF1")
PALE_RED = HexColor("#FFF0F0")
PALE_GOLD = HexColor("#FFF8DD")
GREEN = HexColor("#0F9B55")
RED = HexColor("#C62828")
GOLD = HexColor("#E8A20B")

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", r"C:\Windows\Fonts\ariali.ttf"))


def style(name, size=10, leading=None, color=INK, bold=False, align=TA_LEFT):
    return ParagraphStyle(name, fontName="Arial-Bold" if bold else "Arial", fontSize=size,
                          leading=leading or size * 1.35, textColor=color, alignment=align,
                          spaceBefore=0, spaceAfter=0)


BODY = style("body", 9.7, 13.5)
CARD = style("card", 9.0, 12.3)
SMALL = style("small", 8.3, 11.2, MUTED)
H2 = style("h2", 18, 22, NAVY, True)
H3 = style("h3", 11.4, 14.4, NAVY, True)
CENTER = style("center", 10.1, 14, INK, False, TA_CENTER)
CENTER_SMALL = style("csmall", 8.7, 11.7, MUTED, False, TA_CENTER)


TEXT = {
    "en": {
        "cover_top": "UPDATED PROJECT REFERENCE",
        "cover_sub": "A student-built digital-safety companion for recognising suspicious content and choosing safer next steps.",
        "cover_note": "Website + Chrome Extension + AI-assisted analysis",
        "header": "SCAMCHECK  •  HVT.SHIELDSPARK",
        "footer": "ScamCheck is an educational tool; it does not replace official warnings from banks or authorities.",
        "date": "Updated August 2026",
        "p2": ("1. The problem we solve", "Online scams are increasingly persuasive", "Students and families encounter suspicious content in SMS, social media, email, calls, QR codes and fake websites. Attackers exploit urgency, authority, fear and reward so people act before checking.",
               ["<b>Recognition gap.</b> Rules are often remembered only after a harmful click.", "<b>Complex signals.</b> One message can combine impersonation, urgent pressure, a payment request and a suspicious link.", "<b>Action gap.</b> Users need a calm explanation and a concrete next step, not only a red warning label."],
               "Our design principle", ["<b>Recognise:</b> identify pressure tactics, impersonation, payment or OTP requests, abnormal rewards, gambling and phishing clues.", "<b>Respond:</b> stop interacting, avoid sharing money or credentials, and use an official verification channel.", "<b>Learn:</b> strengthen the pause-check-verify habit with short practice scenarios.", "<b>Respect uncertainty:</b> report risk signals, not legal proof or a guarantee that a link is safe."]),
        "p3": ("2. ScamCheck web application", "A practical safety check before a risky action", "Paste a message, use browser-supported speech-to-text, upload a message image for OCR, or inspect a QR code before opening it.",
               [("Analyse", "Risk level and category; warning signs; link/QR assessment; redacted sensitive fields."), ("Act safely", "Official hotline and library; report guidance; safe-share image; visible disclaimer."), ("Build habits", "Decision-practice scenarios, feedback, history and a Vietnamese/English interface.")],
               "Safety-first output", "ScamCheck explains why a message may be persuasive, highlights suspicious wording and suggests safer actions. It is designed not to open submitted links."),
        "p4": ("3. Chrome Extension: protection in context", "One companion, two ways to check", "<b>Manual Scan:</b> users select text, paste content or run local OCR. <b>AI Auto Guard:</b> an optional setting that reviews bounded visible page content and can show an in-page warning when risk indicators are found.",
               "Manual Scan", ["Read selected text", "Paste text for analysis", "Run OCR locally in the browser", "User chooses when analysis begins"],
               "AI Auto Guard", ["Disabled until the user enables it", "Checks visible text and links, including an opened email body", "Shows a concise warning overlay for suspicious signals"],
               "Product boundaries", ["Auto Guard is opt-in and can be turned off or muted for a website.", "It cannot run on Chrome internal pages, Chrome Web Store pages or sites where Chrome blocks extensions.", "Password/form fields, attachments and ScamCheck's own interface are excluded; it never auto-opens links.", "If AI is unavailable, the extension states this clearly and may show a labelled local-reference warning."]),
        "p5": ("4. How it works", "A transparent pipeline built with web technologies", [
            ("1. Interface", "HTML/CSS/JavaScript\nManifest V3 extension"), ("2. Capture", "Text, selected text\nSpeech, OCR, QR\nvisible content when opted in"), ("3. Safeguard", "Redaction and input limits\nNo link opening\nClient-side OCR"), ("4. Analyse", "Vercel API\nRAG scam catalogue\nGroq-hosted AI model"), ("5. Explain", "Risk and evidence\nSafer next step\nPractice feedback")],
               "Reference-guided AI, not an oracle", "The backend pairs a maintained catalogue of scam patterns with submitted text. It covers impersonation, urgent payment, OTP or credential theft, fake rewards, gambling, investment and charity-donation fraud. The model is instructed to return structured, explainable risk signals in the selected language.",
               "Why QR and OCR matter", "QR codes can hide a destination inside an image. ScamCheck decodes the value for inspection before a visit. Image OCR is run locally first, so recognised text can be reviewed.",
               "Why a backend is used", "The API key remains server-side. The client receives an explanation rather than a secret key, while bounded input and fallbacks reduce failure impact."),
        "p6": ("5. Privacy, safety and responsible AI", "Safety includes data minimisation and clear limits", [
            ("Minimise collection", "Shareable results redact sensitive identifiers. Auto Guard only processes bounded visible content after the user turns it on."),
            ("No unsafe automation", "ScamCheck does not click, visit or validate submitted links. It never asks for a password, OTP, bank credential or identity document."),
            ("Transparent uncertainty", "A risk score is an educational assessment. The interface shows supporting clues and labelled fallbacks, not a claim of certainty.")],
            "Responsible-use commitments", ["<b>Consent:</b> Auto Guard is off by default; manual checks are started by the user.", "<b>Language consistency:</b> Vietnamese mode requests Vietnamese responses and English mode requests English responses.", "<b>Escalation:</b> users are directed to an official bank, platform or competent authority.", "<b>Plain language:</b> explanations focus on practical actions rather than fear-based messaging."]),
        "p7": ("6. Expected impact and evaluation", "Designed to build safer habits, not false confidence", "Students, parents and teachers who encounter suspicious messages or online content and need an accessible second look before they click, pay, reply or share information.",
               [("Safer decisions", "Recognise urgency, impersonation, suspicious domains, payment/OTP requests and unrealistic rewards."), ("Faster help", "Pause, preserve evidence and contact the relevant official source instead of the sender."), ("Stronger habits", "Use practice scenarios and explanations to reinforce a repeatable pause-check-verify routine.")],
               "MVP evaluation plan", ["<b>Usability:</b> Can a learner complete a message or QR check and understand the recommended action?", "<b>Learning:</b> Do correct decisions improve after short practice scenarios?", "<b>Quality:</b> Which warning categories create false alerts or miss relevant signals?", "<b>Trust:</b> Do users understand the privacy boundary and the need for official verification?"],
               "Success is not 'AI catches everything'", "Success means users pause earlier, recognise patterns and choose a safer real-world response."),
        "p8": ("7. Roadmap, demo and declaration", [
            ("Now", "Web analysis, OCR, QR inspection, library, practice mode and safe-share export; a Manifest V3 extension with Manual Scan and optional AI Auto Guard."),
            ("Next", "Refine local pre-screening and result caching, improve category-specific RAG retrieval, expand bilingual content and add clearer status feedback."),
            ("Pilot", "Test with students, teachers and families; measure comprehension, warning quality and confidence while avoiding unnecessary data collection."),
            ("Scale responsibly", "Curate verified public-source updates, improve accessibility/PWA support, and establish review for new scam-pattern proposals.")],
            "Demo and official links", ["Web demo: scamcheck-c3chuyenhvt.vercel.app", "Programme information: vicee.vn/israelhackthon2026", "Application form: bit.ly/4wKbxGN", "Competition rules: bit.ly/4fOaakA", "Chrome Extension: Chrome Web Store listing / development package for testing"],
            "Declaration", "ScamCheck is a student-developed educational prototype. Its assessments identify risk indicators and recommend safer verification steps; they do not determine criminal liability, guarantee that a link is safe, or replace official warnings from banks, platforms or competent authorities."),
    },
    "vi": {
        "cover_top": "HỒ SƠ DỰ ÁN CẬP NHẬT",
        "cover_sub": "Trợ lý an toàn số do học sinh phát triển, hỗ trợ nhận diện nội dung đáng ngờ và lựa chọn bước xử lý an toàn hơn.",
        "cover_note": "Trang web + tiện ích Chrome + phân tích có hỗ trợ AI",
        "header": "SCAMCHECK  •  HVT.SHIELDSPARK",
        "footer": "ScamCheck là công cụ giáo dục, không thay thế cảnh báo chính thức từ ngân hàng hoặc cơ quan chức năng.",
        "date": "Cập nhật tháng 8 năm 2026",
        "p2": ("1. Vấn đề cốt lõi", "Lừa đảo trực tuyến ngày càng thuyết phục", "Học sinh và gia đình gặp nội dung đáng ngờ qua SMS, mạng xã hội, email, cuộc gọi, mã QR và website giả mạo. Kẻ lừa đảo khai thác sự cấp bách, quyền lực, nỗi sợ và phần thưởng để người dùng hành động trước khi kiểm tra.",
               ["<b>Khoảng trống nhận biết.</b> Nhiều quy tắc chỉ được nhớ đến sau khi đã bấm vào liên kết nguy hiểm.", "<b>Tín hiệu phức tạp.</b> Một tin nhắn có thể đồng thời giả mạo, tạo áp lực thời gian, đòi chuyển tiền và đính kèm liên kết đáng ngờ.", "<b>Khoảng trống hành động.</b> Người dùng cần lời giải thích bình tĩnh cùng bước xử lý cụ thể, không chỉ một nhãn cảnh báo màu đỏ."],
               "Nguyên tắc thiết kế", ["<b>Nhận diện:</b> tìm dấu hiệu gây áp lực, giả mạo, yêu cầu thanh toán hoặc OTP, phần thưởng bất thường, cờ bạc và lừa đảo đánh cắp thông tin.", "<b>Phản hồi:</b> dừng tương tác, không cung cấp tiền hay thông tin đăng nhập và xác minh qua kênh chính thức.", "<b>Rèn luyện:</b> hình thành thói quen dừng lại - kiểm tra - xác minh bằng các tình huống ngắn.", "<b>Tôn trọng sự không chắc chắn:</b> nêu dấu hiệu rủi ro, không đưa ra kết luận pháp lý hay bảo đảm liên kết an toàn."]),
        "p3": ("2. Ứng dụng web ScamCheck", "Kiểm tra an toàn trước khi thực hiện hành động rủi ro", "Dán tin nhắn, nhập bằng giọng nói khi trình duyệt hỗ trợ, tải ảnh tin nhắn để OCR hoặc quét mã QR trước khi mở.",
               [("Phân tích", "Mức và loại rủi ro; dấu hiệu cảnh báo; đánh giá liên kết/mã QR; che dữ liệu nhạy cảm."), ("Hành động an toàn", "Thư viện hotline chính thức; hướng dẫn báo cáo; ảnh chia sẻ an toàn; tuyên bố giới hạn."), ("Rèn thói quen", "Tình huống luyện tập, giải thích đáp án, lịch sử và giao diện tiếng Việt/tiếng Anh.")],
               "Đầu ra ưu tiên an toàn", "ScamCheck giải thích vì sao tin nhắn có thể thuyết phục, làm nổi bật câu chữ đáng ngờ và gợi ý bước xử lý an toàn. Ứng dụng được thiết kế để không tự mở liên kết được gửi vào."),
        "p4": ("3. Tiện ích Chrome: bảo vệ ngay trong ngữ cảnh", "Một trợ lý, hai cách kiểm tra", "<b>Kiểm tra chủ động:</b> người dùng chọn văn bản, dán nội dung hoặc chạy OCR cục bộ. <b>Bảo vệ tự động bằng AI:</b> cài đặt tùy chọn có thể xem phần nội dung hiển thị trong giới hạn và hiện cảnh báo trên trang khi phát hiện dấu hiệu rủi ro.",
               "Kiểm tra chủ động", ["Đọc văn bản được chọn", "Dán nội dung để phân tích", "Chạy OCR cục bộ trong trình duyệt", "Người dùng quyết định thời điểm phân tích"],
               "Bảo vệ tự động bằng AI", ["Chỉ hoạt động sau khi người dùng bật", "Kiểm tra chữ và liên kết hiển thị, kể cả nội dung email đang mở", "Hiện lớp cảnh báo ngắn gọn khi có tín hiệu đáng ngờ"],
               "Ranh giới sản phẩm", ["Chế độ tự động là tùy chọn; người dùng có thể tắt hoặc tạm dừng theo từng website.", "Không hoạt động trên trang nội bộ Chrome, Chrome Web Store hoặc nơi Chrome chặn extension.", "Loại trừ ô mật khẩu, biểu mẫu, tệp đính kèm và giao diện ScamCheck; extension không tự mở liên kết.", "Khi AI không khả dụng, extension thông báo rõ và chỉ có thể hiển thị cảnh báo đối chiếu cục bộ đã được gắn nhãn."]),
        "p5": ("4. Cơ chế hoạt động", "Quy trình minh bạch xây dựng bằng công nghệ web", [
            ("1. Giao diện", "HTML/CSS/JavaScript\nExtension Manifest V3"), ("2. Thu thập", "Văn bản, đoạn được chọn\nGiọng nói, OCR, QR\nnội dung hiển thị khi đã bật"), ("3. Bảo vệ", "Che bớt dữ liệu và giới hạn đầu vào\nKhông mở liên kết\nOCR phía trình duyệt"), ("4. Phân tích", "Vercel API\nDanh mục RAG về lừa đảo\nMô hình AI qua Groq"), ("5. Giải thích", "Mức rủi ro và bằng chứng\nBước xử lý an toàn\nPhản hồi luyện tập")],
               "AI có dữ liệu tham chiếu, không phải công cụ “phán quyết”", "Backend kết hợp danh mục các mẫu lừa đảo được duy trì với nội dung người dùng gửi. Danh mục gồm giả mạo, yêu cầu thanh toán khẩn cấp, đánh cắp OTP hoặc thông tin đăng nhập, phần thưởng giả, cờ bạc, đầu tư và lừa đảo quyên góp. Mô hình được yêu cầu trả về tín hiệu rủi ro có cấu trúc và giải thích được bằng ngôn ngữ đã chọn.",
               "Vì sao mã QR và OCR quan trọng", "Mã QR có thể ẩn đích đến bên trong ảnh. ScamCheck giải mã giá trị để kiểm tra trước khi truy cập. OCR ảnh chạy cục bộ trước để người dùng xem lại chữ đã nhận dạng.",
               "Vì sao cần backend", "Khóa API được giữ ở phía máy chủ. Người dùng nhận lời giải thích thay vì khóa bí mật; giới hạn đầu vào và cơ chế dự phòng giúp giảm ảnh hưởng khi dịch vụ gặp lỗi."),
        "p6": ("5. Quyền riêng tư, an toàn và AI có trách nhiệm", "An toàn bao gồm giảm thiểu dữ liệu và nêu rõ giới hạn", [
            ("Giảm thiểu dữ liệu", "Kết quả có thể chia sẻ sẽ che các định danh nhạy cảm. Chế độ tự động chỉ xử lý phần nội dung hiển thị trong giới hạn sau khi người dùng bật."),
            ("Không tự động hóa nguy hiểm", "ScamCheck không bấm, truy cập hoặc xác minh liên kết được gửi vào. Ứng dụng không yêu cầu mật khẩu, OTP, thông tin ngân hàng hay giấy tờ định danh."),
            ("Minh bạch về độ không chắc chắn", "Mức rủi ro là đánh giá giáo dục. Giao diện hiển thị dấu hiệu hỗ trợ và cơ chế dự phòng có nhãn, không khẳng định chắc chắn.")],
            "Cam kết sử dụng có trách nhiệm", ["<b>Sự đồng ý:</b> chế độ tự động tắt mặc định; kiểm tra chủ động do người dùng khởi tạo.", "<b>Nhất quán ngôn ngữ:</b> chế độ tiếng Việt yêu cầu phản hồi tiếng Việt và chế độ tiếng Anh yêu cầu phản hồi tiếng Anh.", "<b>Chuyển hướng phù hợp:</b> người dùng được hướng dẫn liên hệ ngân hàng, nền tảng hoặc cơ quan chức năng qua kênh chính thức.", "<b>Ngôn ngữ dễ hiểu:</b> lời giải thích tập trung vào hành động thực tế, không dùng thông điệp gây sợ hãi."]),
        "p7": ("6. Tác động kỳ vọng và đánh giá", "Xây dựng thói quen an toàn, không tạo cảm giác an tâm sai lệch", "Học sinh, phụ huynh và giáo viên gặp tin nhắn hoặc nội dung trực tuyến đáng ngờ cần một góc nhìn dễ hiểu trước khi bấm, chuyển tiền, trả lời hay chia sẻ thông tin.",
               [("Quyết định an toàn hơn", "Nhận ra sự cấp bách, giả mạo, tên miền bất thường, yêu cầu tiền/OTP và phần thưởng phi thực tế."), ("Tìm hỗ trợ nhanh hơn", "Dừng lại, lưu bằng chứng và liên hệ nguồn chính thức thay vì người gửi."), ("Thói quen bền vững hơn", "Dùng tình huống luyện tập và giải thích để lặp lại quy trình dừng - kiểm tra - xác minh.")],
               "Kế hoạch đánh giá MVP", ["<b>Dễ sử dụng:</b> Học sinh có thể kiểm tra tin nhắn hoặc mã QR và hiểu khuyến nghị không?", "<b>Học tập:</b> Quyết định đúng có cải thiện sau các tình huống luyện tập ngắn không?", "<b>Chất lượng:</b> Loại cảnh báo nào gây báo nhầm hoặc bỏ sót tín hiệu liên quan?", "<b>Niềm tin:</b> Người dùng có hiểu ranh giới quyền riêng tư và nhu cầu xác minh chính thức không?"],
               "Thành công không phải là “AI phát hiện mọi thứ”", "Thành công là người dùng dừng lại sớm hơn, nhận diện được mẫu lừa đảo và chọn phản hồi thực tế an toàn hơn."),
        "p8": ("7. Lộ trình, giới thiệu sản phẩm và tuyên bố", [
            ("Hiện có", "Phân tích web, OCR, kiểm tra QR, thư viện, luyện tập và xuất ảnh chia sẻ an toàn; extension Manifest V3 với kiểm tra chủ động và bảo vệ tự động bằng AI tùy chọn."),
            ("Bước tiếp", "Cải thiện sàng lọc cục bộ và bộ nhớ đệm kết quả, tăng chất lượng truy xuất RAG theo từng loại lừa đảo, mở rộng nội dung song ngữ và phản hồi trạng thái rõ ràng hơn."),
            ("Thử nghiệm", "Thử với học sinh, giáo viên và gia đình; đo mức hiểu, chất lượng cảnh báo và sự tự tin, đồng thời tránh thu thập dữ liệu không cần thiết."),
            ("Mở rộng có trách nhiệm", "Cập nhật theo nguồn công khai đã được kiểm chứng, tăng khả năng tiếp cận/PWA và xây dựng quy trình rà soát đề xuất mẫu lừa đảo mới.")],
            "Bản giới thiệu và liên kết chính thức", ["Bản giới thiệu web: scamcheck-c3chuyenhvt.vercel.app", "Thông tin chương trình: vicee.vn/israelhackthon2026", "Mẫu hồ sơ: bit.ly/4wKbxGN", "Thể lệ cuộc thi: bit.ly/4fOaakA", "Tiện ích Chrome: trang Chrome Web Store / gói phát triển để thử nghiệm"],
            "Tuyên bố", "ScamCheck là sản phẩm giáo dục do học sinh phát triển. Kết quả chỉ nêu dấu hiệu rủi ro và gợi ý bước xác minh an toàn; không xác định trách nhiệm hình sự, không bảo đảm liên kết an toàn và không thay thế cảnh báo chính thức từ ngân hàng, nền tảng hay cơ quan chức năng."),
    },
}


def draw_para(c, text, x, y_top, width, st=BODY, markup=False):
    value = text if markup else escape(text).replace("\n", "<br/>")
    p = Paragraph(value, st)
    _, h = p.wrap(width, 1000)
    p.drawOn(c, x, y_top - h)
    return h


def box(c, x, y, w, h, fill=colors.white, stroke=LINE, radius=11):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(.85)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def card(c, x, top, w, h, title, body, fill=colors.white, accent=BLUE, body_st=CARD):
    box(c, x, top - h, w, h, fill)
    c.setFillColor(accent); c.roundRect(x, top - 30, 5, 30, 2, stroke=0, fill=1)
    draw_para(c, title, x + 15, top - 11, w - 28, H3)
    draw_para(c, body, x + 15, top - 35, w - 28, body_st, markup=True)


def bullets(c, items, x, y_top, width, size=9.1, leading=12.3, color=BLUE):
    y = y_top
    st = style("bullet" + str(x) + str(y_top), size, leading)
    for item in items:
        c.setFillColor(color); c.circle(x + 3, y - 6.5, 2, stroke=0, fill=1)
        y -= draw_para(c, item, x + 13, y, width - 13, st, markup=True) + 5
    return y


def image(c, path, x, y, w, h, radius=0):
    if not path.exists(): return
    with Image.open(path) as im: iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    if radius:
        c.saveState(); p = c.beginPath(); p.roundRect(x, y, w, h, radius); c.clipPath(p, stroke=0, fill=0)
        c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto"); c.restoreState()
    else: c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")


def english_web_mock(c, x, y, w, h):
    """English-only interface illustration so the English PDF has no Vietnamese UI text."""
    box(c, x, y, w, h, HexColor("#F8FBFF"), HexColor("#A8C5FA"), 10)
    c.setFillColor(NAVY); c.roundRect(x, y + h - 28, w, 28, 10, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 8.5); c.drawString(x + 10, y + h - 18, "ScamCheck  |  Home")
    c.setFillColor(NAVY); c.setFont("Arial-Bold", 9.2); c.drawString(x + 12, y + h - 48, "Paste a suspicious message")
    box(c, x + 12, y + 59, w - 24, h - 120, colors.white, LINE, 6)
    c.setFillColor(MUTED); c.setFont("Arial", 7.3); c.drawString(x + 21, y + h - 77, "Enter text or use the microphone...")
    c.setFillColor(HexColor("#EFF5FF")); c.roundRect(x + 12, y + 36, 82, 17, 5, stroke=0, fill=1)
    c.setFillColor(BLUE); c.setFont("Arial-Bold", 6.8); c.drawCentredString(x + 53, y + 41, "Upload image")
    c.setFillColor(BLUE); c.roundRect(x + 102, y + 32, w - 114, 25, 6, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 7.8); c.drawCentredString(x + 102 + (w-114)/2, y + 41, "Analyse now")


def english_extension_mock(c, x, y, w, h):
    box(c, x, y, w, h, HexColor("#F8FBFF"), HexColor("#A8C5FA"), 10)
    c.setFillColor(NAVY); c.roundRect(x, y + h - 30, w, 30, 10, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 9.5); c.drawString(x + 12, y + h - 19, "ScamCheck")
    c.setFillColor(PALE_GREEN); c.setStrokeColor(HexColor("#A5E5C3")); c.roundRect(x + 12, y + h - 66, w - 24, 23, 7, stroke=1, fill=1)
    c.setFillColor(GREEN); c.setFont("Arial-Bold", 7.5); c.drawString(x + 20, y + h - 57, "AI Auto Guard: ON")
    box(c, x + 12, y + 58, w - 24, h - 138, colors.white, LINE, 6)
    c.setFillColor(NAVY); c.setFont("Arial-Bold", 8.6); c.drawString(x + 20, y + h - 92, "Check suspicious content")
    c.setFillColor(MUTED); c.setFont("Arial", 7.0); c.drawString(x + 20, y + h - 109, "Selected text or visible page signals")
    c.setFillColor(PALE_RED); c.setStrokeColor(HexColor("#FFB8B8")); c.roundRect(x + 12, y + 30, w - 24, 21, 6, stroke=1, fill=1)
    c.setFillColor(RED); c.setFont("Arial-Bold", 7.2); c.drawString(x + 20, y + 38, "Risk signal found - review safely")


def english_popup_mock(c, x, y, w, h):
    box(c, x, y, w, h, HexColor("#F8FBFF"), HexColor("#A8C5FA"), 10)
    c.setFillColor(NAVY); c.roundRect(x, y + h - 29, w, 29, 10, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 8.7); c.drawString(x + 10, y + h - 19, "ScamCheck  •  HIGH RISK")
    c.setFillColor(PALE_RED); c.setStrokeColor(HexColor("#FFB8B8")); c.roundRect(x + 10, y + h - 78, w - 20, 38, 7, stroke=1, fill=1)
    c.setFillColor(RED); c.setFont("Arial-Bold", 7.2); c.drawString(x + 18, y + h - 57, "Possible impersonation and urgent payment request")
    c.setFillColor(NAVY); c.setFont("Arial-Bold", 7.6); c.drawString(x + 12, y + h - 101, "Warning signs")
    c.setFont("Arial", 7); c.drawString(x + 15, y + h - 117, "• Pressure to act immediately")
    c.drawString(x + 15, y + h - 131, "• Unofficial link or sender")
    c.setFillColor(BLUE); c.roundRect(x + 12, y + 18, w - 24, 20, 6, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 7.2); c.drawCentredString(x + w/2, y + 25, "View safe guidance")


def header(c, lang, no, title, subtitle):
    tx = TEXT[lang]
    c.setFillColor(NAVY); c.rect(0, PAGE_H - 32, PAGE_W, 32, stroke=0, fill=1)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 9); c.drawString(M, PAGE_H - 20, tx["header"])
    c.setFont("Arial", 8); c.drawRightString(PAGE_W - M, PAGE_H - 20, f"NEXTGEN INNOVATOR 2026  |  {no}/8")
    c.setFillColor(NAVY); c.setFont("Arial-Bold", 17.5); c.drawString(M, PAGE_H - 64, title)
    c.setFillColor(MUTED); c.setFont("Arial", 8.8); c.drawString(M, PAGE_H - 79, subtitle)
    c.setStrokeColor(LINE); c.line(M, PAGE_H - 89, PAGE_W - M, PAGE_H - 89)


def footer(c, lang, no):
    tx = TEXT[lang]
    c.setStrokeColor(LINE); c.line(M, 33, PAGE_W - M, 33)
    c.setFont("Arial", 7.4); c.setFillColor(MUTED); c.drawString(M, 20, tx["footer"])
    c.drawRightString(PAGE_W - M, 20, f"HVT.ShieldSpark • {tx['date']} • {no}")


def cover(c, lang):
    tx = TEXT[lang]
    c.setFillColor(NAVY); c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(HexColor("#0D2A5F")); c.circle(PAGE_W - 35, PAGE_H - 70, 158, stroke=0, fill=1)
    c.setFillColor(HexColor("#0B2450")); c.circle(-35, 88, 170, stroke=0, fill=1)
    # Separate vertical zones prevent cover overlap.
    image(c, ASSETS["icon"], M, PAGE_H - 104, 42, 42)
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 22); c.drawString(M + 54, PAGE_H - 82, "ScamCheck")
    c.setFillColor(HexColor("#BDD5FF")); c.setFont("Arial-Bold", 7.7); c.drawString(M + 55, PAGE_H - 96, tx["cover_note"])
    c.setFillColor(colors.white); c.setFont("Arial-Bold", 25); c.drawCentredString(PAGE_W/2, PAGE_H - 173, "NEXTGEN INNOVATOR 2026")
    c.setFillColor(HexColor("#BDD5FF")); c.setFont("Arial-Bold", 11.5); c.drawCentredString(PAGE_W/2, PAGE_H - 207, tx["cover_top"])
    box(c, M + 45, PAGE_H - 358, CW - 90, 100, HexColor("#F2F7FF"), HexColor("#72A5FF"), 16)
    draw_para(c, tx["cover_sub"], M + 68, PAGE_H - 286, CW - 136, CENTER)
    c.setFillColor(HexColor("#BDD5FF")); c.setFont("Arial-Bold", 9.7); c.drawCentredString(PAGE_W/2, PAGE_H - 389, "TEAM: HVT.SHIELDSPARK" if lang == "en" else "NHÓM: HVT.SHIELDSPARK")
    c.setFont("Arial", 8.9); c.drawCentredString(PAGE_W/2, PAGE_H - 406, "CYBERSECURITY & DIGITAL SAFETY" if lang == "en" else "AN NINH MẠNG VÀ AN TOÀN SỐ")
    box(c, M, 95, CW, 122, HexColor("#102A5A"), HexColor("#355D9C"), 16)
    # Authentic product captures: website on the left, extension running in Chrome on the right.
    image(c, ASSETS["web"], M + 14, 109, 236, 95, 8)
    image(c, ASSETS["extension"], M + 266, 109, 196, 95, 8)
    c.setFillColor(HexColor("#BDD5FF")); c.setFont("Arial", 8.1); c.drawCentredString(PAGE_W/2, 69, tx["date"])


def page_problem(c, lang):
    t = TEXT[lang]["p2"]; header(c, lang, 2, t[0], t[1]); y = PAGE_H - 112
    card(c, M, y, CW, 94, t[1], t[2], PALE_RED, RED); y -= 115
    w = (CW - 12) / 2
    card(c, M, y, w, 163, "Why it matters" if lang == "en" else "Vì sao vấn đề quan trọng", "<br/>".join(t[3]), PALE_GOLD, GOLD)
    card(c, M + w + 12, y, w, 163, t[4], "<br/>".join(t[5]), PALE_GREEN, GREEN)
    y -= 185
    box(c, M, y - 154, CW, 154, PALE, LINE); bullets(c, t[5], M + 18, y - 18, CW - 36)
    footer(c, lang, 2)


def page_web(c, lang):
    t = TEXT[lang]["p3"]; header(c, lang, 3, t[0], t[1]); y = PAGE_H - 112
    image(c, ASSETS["web"], M, y - 220, 266, 214, 12)
    card(c, M + 282, y, CW - 282, 98, "Input options" if lang == "en" else "Các cách nhập", t[2], PALE_BLUE, BLUE)
    card(c, M + 282, y - 112, CW - 282, 108, t[4], t[5], PALE_GREEN, GREEN)
    y -= 243; col = (CW - 24)/3
    for i, (title, body) in enumerate(t[3]): card(c, M + i*(col+12), y, col, 144, title, body, colors.white, [BLUE,GREEN,GOLD][i])
    y -= 168; box(c, M, y - 133, CW, 133, PALE_GOLD, HexColor("#FFD666"))
    title = "A safer user flow" if lang == "en" else "Luồng sử dụng an toàn hơn"; draw_para(c, title, M+16, y-16, CW-32, H3)
    stages = ["Capture", "Analyse", "Explain", "Act", "Learn"] if lang == "en" else ["Nhập", "Phân tích", "Giải thích", "Xử lý", "Rèn luyện"]
    for i, label in enumerate(stages):
        x=M+25+i*103; c.setFillColor(BLUE); c.circle(x+15,y-77,15,stroke=0,fill=1); c.setFillColor(colors.white); c.setFont("Arial-Bold",9); c.drawCentredString(x+15,y-80,str(i+1)); c.setFillColor(NAVY); c.setFont("Arial-Bold",8); c.drawCentredString(x+55,y-68,label)
        if i<4: c.setStrokeColor(HexColor("#9BB9EF")); c.setLineWidth(1.5); c.line(x+79,y-77,x+98,y-77)
    footer(c, lang, 3)


def page_extension(c, lang):
    t=TEXT[lang]["p4"]; header(c,lang,4,t[0],t[1]); y=PAGE_H-112
    card(c,M,y,CW,84,t[1],t[2],PALE_GREEN,GREEN); y-=106
    image(c,ASSETS["extension"],M,y-220,CW*.57,214,12)
    x=M+CW*.59; rw=PAGE_W-M-x
    card(c,x,y,rw,102,t[3],"<br/>".join("• "+a for a in t[4]),PALE_BLUE,BLUE,SMALL)
    card(c,x,y-116,rw,102,t[5],"<br/>".join("• "+a for a in t[6]),PALE_RED,RED,SMALL)
    y-=244; box(c,M,y-160,CW,160,PALE_GOLD,HexColor("#FFD666")); draw_para(c,t[7],M+16,y-16,CW-32,H3); bullets(c,t[8],M+18,y-43,CW-36,8.5,11.3)
    footer(c,lang,4)


def page_tech(c,lang):
    t=TEXT[lang]["p5"]; header(c,lang,5,t[0],t[1]); y=PAGE_H-112; bw=(CW-36)/5
    for i,(title,body) in enumerate(t[2]):
        x=M+i*(bw+9); box(c,x,y-127,bw,127,[PALE_BLUE,PALE_GOLD,PALE_GREEN,PALE_RED,PALE][i],LINE,10); c.setFillColor([BLUE,GOLD,GREEN,RED,BLUE][i]); c.circle(x+15,y-18,7,stroke=0,fill=1); draw_para(c,title,x+8,y-36,bw-16,style("a"+str(i),7.8,10.0,NAVY,True,TA_CENTER)); draw_para(c,body,x+8,y-65,bw-16,style("b"+str(i),7.1,9.5,INK,False,TA_CENTER))
    y-=150; card(c,M,y,CW,112,t[3],t[4],PALE,BLUE); y-=132; half=(CW-12)/2
    card(c,M,y,half,126,t[5],t[6],PALE_GOLD,GOLD); card(c,M+half+12,y,half,126,t[7],t[8],PALE_GREEN,GREEN)
    footer(c,lang,5)


def page_privacy(c,lang):
    t=TEXT[lang]["p6"]; header(c,lang,6,t[0],t[1]); y=PAGE_H-112
    image(c,ASSETS["popup"],M,y-229,208,221,12)
    x=M+225; w=PAGE_W-M-x
    for i,(title,body) in enumerate(t[2]): card(c,x,y-i*101,w,87,title,body,[PALE_GREEN,PALE_RED,PALE_GOLD][i],[GREEN,RED,GOLD][i])
    y-=250; box(c,M,y-178,CW,178,PALE,LINE); draw_para(c,t[3],M+16,y-16,CW-32,H3); bullets(c,t[4],M+18,y-44,CW-36,8.8,11.8)
    footer(c,lang,6)


def page_impact(c,lang):
    t=TEXT[lang]["p7"]; header(c,lang,7,t[0],t[1]); y=PAGE_H-112; card(c,M,y,CW,84,t[1],t[2],PALE_BLUE,BLUE); y-=106; col=(CW-24)/3
    for i,(title,body) in enumerate(t[3]): card(c,M+i*(col+12),y,col,138,title,body,colors.white,[RED,GREEN,GOLD][i],SMALL)
    y-=162; box(c,M,y-158,CW,158,PALE_GREEN,HexColor("#B5EACB")); draw_para(c,t[4],M+16,y-16,CW-32,H3); bullets(c,t[5],M+18,y-44,CW-36,8.7,11.5,GREEN)
    y-=179; card(c,M,y,CW,77,t[6],t[7],PALE_GOLD,GOLD)
    footer(c,lang,7)


def page_roadmap(c,lang):
    t=TEXT[lang]["p8"]; header(c,lang,8,t[0],""); y=PAGE_H-112
    for i,(title,body) in enumerate(t[1]):
        top=y-i*94; box(c,M,top-82,CW,82,colors.white,LINE); accent=[BLUE,GREEN,GOLD,RED][i]; c.setFillColor(accent); c.roundRect(M,top-82,8,82,4,stroke=0,fill=1); c.setFillColor(accent); c.circle(M+29,top-28,13,stroke=0,fill=1); c.setFillColor(colors.white); c.setFont("Arial-Bold",9); c.drawCentredString(M+29,top-31,str(i+1)); draw_para(c,title,M+54,top-15,CW-70,H3); draw_para(c,body,M+54,top-38,CW-70,SMALL)
    y-=395; box(c,M,y-142,CW,142,PALE_BLUE,LINE); draw_para(c,t[2],M+16,y-16,CW-32,H3); yy=y-43
    for line in t[3]: yy-=draw_para(c,line,M+18,yy,CW-36,style("link"+str(yy),8.4,11.3,BLUE))+4
    y-=164; card(c,M,y,CW,94,t[4],t[5],PALE_GOLD,GOLD)
    footer(c,lang,8)


def build(lang):
    out=OUT[lang]; c=canvas.Canvas(str(out),pagesize=A4,pageCompression=1)
    c.setTitle("ScamCheck - HVT.ShieldSpark - " + ("English Project Reference" if lang=="en" else "Hồ sơ dự án tiếng Việt")); c.setAuthor("HVT.ShieldSpark")
    for fn in [cover,page_problem,page_web,page_extension,page_tech,page_privacy,page_impact,page_roadmap]:
        if fn is cover: fn(c,lang)
        else: fn(c,lang)
        c.showPage()
    c.save(); print(out)


if __name__ == "__main__":
    build("en"); build("vi")
