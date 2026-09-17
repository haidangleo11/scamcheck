from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader


ROOT = Path(r"D:\prototype")
OUT = ROOT / "ScamCheck_NextGen_Bilingual_HVT_ShieldSpark_Updated.pdf"
ASSETS = {
    "icon": ROOT / "icon.png",
    "web": ROOT / "store-assets" / "website-background.png",
    "extension": ROOT / "Screenshot (232).png",
    "popup": ROOT / "store-assets" / "scamcheck-extension-screenshot-1.png",
}

PAGE_W, PAGE_H = A4
M = 42
CONTENT_W = PAGE_W - 2 * M

NAVY = HexColor("#071A3D")
INK = HexColor("#17233A")
BLUE = HexColor("#2563EB")
CYAN = HexColor("#E8F1FF")
PALE = HexColor("#F7FAFF")
GREEN = HexColor("#0F9B55")
PALE_GREEN = HexColor("#EAFBF1")
RED = HexColor("#C62828")
PALE_RED = HexColor("#FFF0F0")
GOLD = HexColor("#E8A20B")
PALE_GOLD = HexColor("#FFF8DD")
MUTED = HexColor("#54627A")
LINE = HexColor("#D9E3F2")
WHITE = colors.white


pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Italic", r"C:\Windows\Fonts\ariali.ttf"))


def styl(name, size=10, leading=None, color=INK, font="Arial", align=TA_LEFT, **kw):
    return ParagraphStyle(
        name,
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.35,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        spaceBefore=0,
        **kw,
    )


ST_BODY = styl("body", 10.0, 14.0)
ST_SMALL = styl("small", 8.3, 11.1, MUTED)
ST_H1 = styl("h1", 26, 31, WHITE, "Arial-Bold", TA_CENTER)
ST_H2 = styl("h2", 18, 23, NAVY, "Arial-Bold")
ST_H3 = styl("h3", 11.6, 15, NAVY, "Arial-Bold")
ST_CARD = styl("card", 9.5, 13.2)
ST_CARD_SMALL = styl("cardSmall", 8.6, 11.5)
ST_CENTER = styl("center", 10, 14, INK, "Arial", TA_CENTER)
ST_CENTER_SMALL = styl("centerSmall", 8.7, 11.5, MUTED, "Arial", TA_CENTER)
ST_LINK = styl("link", 8.7, 12.2, BLUE)


def para(c, text, x, y_top, width, style=ST_BODY, height_limit=None):
    p = Paragraph(escape(text).replace("\n", "<br/>"), style)
    w, h = p.wrap(width, height_limit or 1000)
    p.drawOn(c, x, y_top - h)
    return h


def rich(c, markup, x, y_top, width, style=ST_BODY, height_limit=None):
    p = Paragraph(markup, style)
    w, h = p.wrap(width, height_limit or 1000)
    p.drawOn(c, x, y_top - h)
    return h


def rounded(c, x, y, w, h, fill=WHITE, stroke=LINE, radius=10, line=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(line)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def header(c, num, title_en, title_vi):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 32, PAGE_W, 32, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Arial-Bold", 9.2)
    c.drawString(M, PAGE_H - 20, "SCAMCHECK  •  HVT.SHIELDSPARK")
    c.setFont("Arial", 8.2)
    c.drawRightString(PAGE_W - M, PAGE_H - 20, f"NEXTGEN INNOVATOR 2026  |  {num}/9")
    c.setFillColor(NAVY)
    c.setFont("Arial-Bold", 18)
    c.drawString(M, PAGE_H - 64, title_en)
    c.setFont("Arial", 9.1)
    c.setFillColor(MUTED)
    c.drawString(M, PAGE_H - 79, title_vi)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(M, PAGE_H - 89, PAGE_W - M, PAGE_H - 89)


def footer(c, num):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(M, 33, PAGE_W - M, 33)
    c.setFont("Arial", 7.6)
    c.setFillColor(MUTED)
    c.drawString(M, 20, "ScamCheck is an educational tool; it does not replace official warnings from banks or authorities.")
    c.drawRightString(PAGE_W - M, 20, f"HVT.ShieldSpark • Updated August 2026 • {num}")


def add_image(c, path, x, y, w, h, contain=True, radius=None):
    if not path.exists():
        return
    with Image.open(path) as img:
        iw, ih = img.size
    ratio = min(w / iw, h / ih) if contain else max(w / iw, h / ih)
    dw, dh = iw * ratio, ih * ratio
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    if radius:
        c.saveState()
        p = c.beginPath()
        p.roundRect(x, y, w, h, radius)
        c.clipPath(p, stroke=0, fill=0)
        c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
        c.restoreState()
    else:
        c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")


def card(c, x, y_top, w, h, title, body, fill=WHITE, accent=BLUE, body_style=ST_CARD):
    rounded(c, x, y_top - h, w, h, fill, LINE, 12)
    c.setFillColor(accent)
    c.roundRect(x, y_top - 29, 5, 29, 2, stroke=0, fill=1)
    para(c, title, x + 15, y_top - 12, w - 28, ST_H3)
    rich(c, body, x + 15, y_top - 35, w - 28, body_style, h - 42)


def bullet_list(c, items, x, y_top, width, font_size=9.3, leading=13.1, bullet_color=BLUE):
    y = y_top
    style = styl("bullet" + str(y_top), font_size, leading)
    for item in items:
        c.setFillColor(bullet_color)
        c.circle(x + 3, y - 6, 2, stroke=0, fill=1)
        h = rich(c, item, x + 13, y, width - 13, style)
        y -= h + 5
    return y


def page_cover(c):
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(HexColor("#0D2A5F"))
    c.circle(PAGE_W - 50, PAGE_H - 90, 165, stroke=0, fill=1)
    c.setFillColor(HexColor("#0B2450"))
    c.circle(20, 125, 170, stroke=0, fill=1)
    add_image(c, ASSETS["icon"], M, PAGE_H - 112, 52, 52)
    c.setFillColor(WHITE)
    c.setFont("Arial-Bold", 24)
    c.drawString(M + 64, PAGE_H - 84, "ScamCheck")
    c.setFillColor(HexColor("#BBD3FF"))
    c.setFont("Arial-Bold", 8.2)
    c.drawString(M + 66, PAGE_H - 99, "SAFER DIGITAL LIFE • AN TOÀN KHÔNG GIAN SỐ")
    para(c, "NEXTGEN INNOVATOR 2026", M, PAGE_H - 184, CONTENT_W, ST_H1)
    c.setFillColor(HexColor("#BBD3FF"))
    c.setFont("Arial-Bold", 12.2)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 219, "UPDATED BILINGUAL PROJECT REFERENCE")
    c.setFont("Arial", 11)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 239, "Hồ sơ dự án song ngữ • Bản cập nhật website và Chrome Extension")
    rounded(c, M + 60, PAGE_H - 380, CONTENT_W - 120, 84, HexColor("#F0F6FF"), HexColor("#79A9FF"), 16)
    para(c, "A practical, explainable digital-safety companion that helps students and families recognise suspicious content, take safer next steps, and build stronger habits.", M + 83, PAGE_H - 321, CONTENT_W - 166, ST_CENTER)
    para(c, "Công cụ giáo dục giúp nhận diện dấu hiệu rủi ro, đưa ra bước xử lý an toàn và rèn kỹ năng phòng tránh lừa đảo.", M + 83, PAGE_H - 352, CONTENT_W - 166, ST_CENTER_SMALL)
    # visual strip
    rounded(c, M, 120, CONTENT_W, 117, HexColor("#102A5A"), HexColor("#345C9F"), 16)
    add_image(c, ASSETS["web"], M + 14, 132, 220, 92, radius=8)
    add_image(c, ASSETS["extension"], M + 250, 132, 188, 92, radius=8)
    c.setFillColor(WHITE)
    c.setFont("Arial-Bold", 10.5)
    c.drawString(M + 14, 91, "Team: HVT.ShieldSpark")
    c.setFont("Arial", 9.4)
    c.setFillColor(HexColor("#BBD3FF"))
    c.drawString(M + 14, 74, "Theme: Cybersecurity & Digital Safety • Chủ đề: An toàn số")
    c.drawString(M + 14, 57, "Prototype: Web application + Chrome Extension + AI-assisted analysis")


def page_problem(c):
    header(c, 2, "1. The problem we solve", "Vấn đề cốt lõi: lừa đảo số ngày càng đa dạng và thuyết phục")
    y = PAGE_H - 113
    card(c, M, y, CONTENT_W, 94, "The core problem | Hiện trạng", "Students and families can encounter scam signals in SMS, social media, email, calls, QR codes and fake websites. Attackers exploit urgency, authority, rewards and fear so that people act before checking.", PALE_RED, RED)
    y -= 112
    card_w = (CONTENT_W - 14) / 2
    card(c, M, y, card_w, 150, "Why existing awareness is not enough", "<b>1.</b> Rules are often remembered only after a harmful click.\n<b>2.</b> A single message can combine fake identity, urgent pressure and a suspicious link.\n<b>3.</b> People need a calm explanation and a concrete next step—not just a red label.", PALE_GOLD, GOLD)
    card(c, M + card_w + 14, y, card_w, 150, "Design opportunity | Cơ hội", "Turn unfamiliar content into an understandable learning moment: show the warning signs, avoid opening the link, suggest official verification channels and let learners practise the decision safely.", PALE_GREEN, GREEN)
    y -= 173
    rounded(c, M, y - 182, CONTENT_W, 182, PALE, LINE, 12)
    para(c, "Our design principle | Nguyên tắc thiết kế", M + 16, y - 16, CONTENT_W - 32, ST_H3)
    y2 = y - 43
    bullet_list(c, [
        "<b>Recognise:</b> identify pressure tactics, impersonation, payment/OTP requests, abnormal rewards, gambling and phishing clues.",
        "<b>Respond:</b> stop interacting, do not transfer money or disclose credentials, and contact the organisation through an official channel.",
        "<b>Learn:</b> reinforce safer digital habits with a short practice mode and explainable feedback.",
        "<b>Respect uncertainty:</b> ScamCheck labels risk signals; it does not claim legal proof or replace banks and authorities.",
    ], M + 18, y2, CONTENT_W - 36)
    footer(c, 2)


def page_web(c):
    header(c, 3, "2. ScamCheck web application", "Ứng dụng web: kiểm tra nội dung, giải thích rủi ro và hướng dẫn an toàn")
    y = PAGE_H - 112
    add_image(c, ASSETS["web"], M, y - 215, 270, 210, radius=12)
    card(c, M + 288, y, CONTENT_W - 288, 96, "Input options | Nhiều cách nhập", "Paste a message, use speech-to-text when supported by the browser, upload a message image for OCR, or scan a QR code before opening it.", PALE, BLUE)
    card(c, M + 288, y - 110, CONTENT_W - 288, 98, "Safety-first analysis", "The app highlights suspicious wording and links, explains why the message may be persuasive, and recommends safer actions. It is designed not to open the submitted link.", PALE_GREEN, GREEN)
    y -= 239
    col = (CONTENT_W - 24) / 3
    card(c, M, y, col, 141, "Analyse", "• Risk level and category\n• Warning signs\n• Link/QR assessment\n• Redacted sensitive fields", WHITE, BLUE, ST_CARD_SMALL)
    card(c, M + col + 12, y, col, 141, "Act safely", "• Official hotline/library\n• Fast report guidance\n• Safe-share result image\n• Clear disclaimer", WHITE, GREEN, ST_CARD_SMALL)
    card(c, M + (col + 12) * 2, y, col, 141, "Build habits", "• Scenario practice\n• Correct/unsafe decision explanations\n• History & learning logs\n• Vietnamese / English UI", WHITE, GOLD, ST_CARD_SMALL)
    y -= 170
    rounded(c, M, y - 147, CONTENT_W, 147, PALE_GOLD, HexColor("#FFD666"), 12)
    para(c, "User flow | Luồng sử dụng", M + 16, y - 15, CONTENT_W - 32, ST_H3)
    flow = [("1", "Capture", "Nhập / OCR / QR"), ("2", "Analyse", "RAG + AI assistance"), ("3", "Explain", "Dấu hiệu và ngữ cảnh"), ("4", "Act", "Bước xử lý an toàn"), ("5", "Learn", "Luyện tập")]
    start_x = M + 20
    yy = y - 79
    for idx, (n, en, vi) in enumerate(flow):
        x = start_x + idx * 104
        c.setFillColor(BLUE)
        c.circle(x + 17, yy, 17, stroke=0, fill=1)
        c.setFont("Arial-Bold", 11)
        c.setFillColor(WHITE)
        c.drawCentredString(x + 17, yy - 4, n)
        c.setFillColor(NAVY)
        c.setFont("Arial-Bold", 8.6)
        c.drawCentredString(x + 53, yy + 10, en)
        c.setFont("Arial", 7.5)
        c.setFillColor(MUTED)
        c.drawCentredString(x + 53, yy - 5, vi)
        if idx < len(flow) - 1:
            c.setStrokeColor(HexColor("#94B9FF"))
            c.setLineWidth(2)
            c.line(x + 83, yy, x + 99, yy)
    footer(c, 3)


def page_extension(c):
    header(c, 4, "3. Chrome Extension: protection in context", "Chrome Extension: hỗ trợ nhận biết dấu hiệu bất thường ngay khi đang duyệt web")
    y = PAGE_H - 112
    card(c, M, y, CONTENT_W, 83, "One companion, two modes | Một trợ lý, hai chế độ", "<b>Manual Scan:</b> the user selects text, pastes content or performs local OCR. <b>AI Auto Guard (optional):</b> the extension checks visible page signals and can show an in-page warning when risk indicators are found.", PALE_GREEN, GREEN)
    y -= 104
    add_image(c, ASSETS["extension"], M, y - 214, CONTENT_W * 0.58, 209, radius=12)
    x = M + CONTENT_W * 0.60
    right_w = PAGE_W - M - x
    card(c, x, y, right_w, 100, "Manual Scan | Kiểm tra chủ động", "• Read selected text\n• Paste text for analysis\n• OCR image locally in the browser\n• User confirms before AI analysis", PALE, BLUE, ST_CARD_SMALL)
    card(c, x, y - 114, right_w, 100, "AI Auto Guard | Bảo vệ tự động", "• Starts only after the user turns it on\n• Reviews visible text and links, including an opened email body\n• Shows a concise overlay warning for suspicious patterns", PALE_RED, RED, ST_CARD_SMALL)
    y -= 237
    rounded(c, M, y - 163, CONTENT_W, 163, PALE_GOLD, HexColor("#FFD666"), 12)
    para(c, "Boundaries are part of the product | Ranh giới bảo vệ người dùng", M + 16, y - 16, CONTENT_W - 32, ST_H3)
    bullet_list(c, [
        "Auto Guard is <b>opt-in</b>; the user can turn it off per extension and temporarily mute a website.",
        "It does not run on Chrome internal pages, Chrome Web Store pages or sites where Chrome blocks extensions.",
        "It excludes password/form fields, attachments and the ScamCheck interface itself; it does not auto-open links.",
        "If AI is unavailable, the extension reports that clearly and may provide a labelled local-reference warning instead of pretending to have an AI result.",
    ], M + 18, y - 43, CONTENT_W - 36)
    footer(c, 4)


def page_tech(c):
    header(c, 5, "4. How it works", "Cơ chế hoạt động: HTML/CSS/JavaScript, QR/OCR cục bộ, RAG và AI qua backend")
    y = PAGE_H - 112
    # Architecture lanes
    boxes = [
        ("1. Interface", "Web: HTML/CSS/JavaScript\nExtension: Manifest V3", CYAN, BLUE),
        ("2. Capture", "Text • selected text\nSpeech • OCR • QR\nvisible content (opt-in)", PALE_GOLD, GOLD),
        ("3. Safeguard", "Redaction • input limits\nDo not open links\nClient-side OCR", PALE_GREEN, GREEN),
        ("4. Analyse", "Vercel API\nRAG scam catalogue\nGroq-hosted AI model", PALE_RED, RED),
        ("5. Explain", "Risk + evidence\nRecommended action\nPractice feedback", PALE, BLUE),
    ]
    bw = (CONTENT_W - 4 * 9) / 5
    for i, (title, body, fill, accent) in enumerate(boxes):
        x = M + i * (bw + 9)
        rounded(c, x, y - 126, bw, 126, fill, LINE, 10)
        c.setFillColor(accent)
        c.circle(x + 16, y - 18, 8, stroke=0, fill=1)
        para(c, title, x + 10, y - 36, bw - 20, styl("arch" + str(i), 8.1, 10.4, NAVY, "Arial-Bold", TA_CENTER))
        para(c, body, x + 10, y - 66, bw - 20, styl("archbody" + str(i), 7.4, 9.8, INK, "Arial", TA_CENTER))
        if i < len(boxes) - 1:
            c.setStrokeColor(HexColor("#9BB9EF"))
            c.setLineWidth(1.5)
            c.line(x + bw + 1, y - 63, x + bw + 7, y - 63)
    y -= 150
    card(c, M, y, CONTENT_W, 101, "Reference-guided AI, not an oracle | AI có dữ liệu tham chiếu, không phải “phán quyết”", "The backend combines a maintained catalogue of scam patterns—such as impersonation, urgent payment, OTP/credential theft, fake rewards, investment/gambling and charity donation fraud—with the submitted text. The model is instructed to return structured, explainable risk signals in the selected Vietnamese or English language.", PALE, BLUE)
    y -= 120
    card(c, M, y, (CONTENT_W - 12) / 2, 130, "Why QR and OCR matter", "QR codes can hide destinations behind an image. ScamCheck decodes the value for inspection before the user visits it. Image OCR is run locally first, so recognised text is shown for user review.", PALE_GOLD, GOLD)
    card(c, M + (CONTENT_W + 12) / 2, y, (CONTENT_W - 12) / 2, 130, "Why a backend is used", "The API key remains server-side. Vercel exposes a narrow analysis endpoint; the client receives an explanation rather than a secret key. Content limits and fallbacks reduce failure impact.", PALE_GREEN, GREEN)
    footer(c, 5)


def page_privacy(c):
    header(c, 6, "5. Privacy, safety and responsible AI", "Quyền riêng tư, an toàn và sử dụng AI có trách nhiệm")
    y = PAGE_H - 112
    add_image(c, ASSETS["popup"], M, y - 230, 208, 222, radius=12)
    x = M + 225
    w = PAGE_W - M - x
    card(c, x, y, w, 87, "Minimise collection | Giảm thiểu dữ liệu", "The app redacts sensitive identifiers in shareable results. For extension auto scanning, only bounded visible content is processed after the user enables the setting.", PALE_GREEN, GREEN)
    card(c, x, y - 101, w, 88, "No unsafe automation", "ScamCheck does not click, visit or validate submitted links. It never asks users to provide passwords, OTPs, bank account credentials or personal identity documents.", PALE_RED, RED)
    card(c, x, y - 203, w, 88, "Transparent uncertainty", "A risk score is an educational assessment. The interface shows supporting clues, a labelled local fallback when necessary, and clear safe next steps—not a claim of certainty.", PALE_GOLD, GOLD)
    y -= 250
    rounded(c, M, y - 180, CONTENT_W, 180, PALE, LINE, 12)
    para(c, "Responsible-use commitments | Cam kết sử dụng có trách nhiệm", M + 16, y - 17, CONTENT_W - 32, ST_H3)
    bullet_list(c, [
        "<b>Consent:</b> Auto Guard is off by default and user-controlled; manual scans are initiated by the user.",
        "<b>Language consistency:</b> Vietnamese mode requests Vietnamese responses; English mode requests English responses.",
        "<b>Escalation:</b> users are directed to the official bank, platform or competent authority—not to rely solely on the app.",
        "<b>Age-appropriate education:</b> explanations favour plain language, actions and practice rather than fear-based messaging.",
    ], M + 18, y - 45, CONTENT_W - 36)
    footer(c, 6)


def page_impact(c):
    header(c, 7, "6. Expected impact and evaluation", "Tác động kỳ vọng và cách đo lường")
    y = PAGE_H - 112
    card(c, M, y, CONTENT_W, 81, "Target users | Người dùng hướng tới", "Students, parents and teachers who encounter suspicious messages or online content and need an accessible second look before they click, pay, reply or share information.", PALE, BLUE)
    y -= 102
    col = (CONTENT_W - 24) / 3
    card(c, M, y, col, 145, "1. Safer decisions", "Learners can identify concrete signs: urgency, impersonation, suspicious domains, requests for payment/OTP, unrealistic rewards, charity or investment pressure.", WHITE, RED, ST_CARD_SMALL)
    card(c, M + col + 12, y, col, 145, "2. Faster help", "A concise action list helps users pause, preserve evidence and contact the right official source rather than the message sender.", WHITE, GREEN, ST_CARD_SMALL)
    card(c, M + (col + 12) * 2, y, col, 145, "3. Stronger habits", "Practice scenarios and explanations reinforce a repeatable pause–check–verify routine instead of one-time awareness.", WHITE, GOLD, ST_CARD_SMALL)
    y -= 170
    rounded(c, M, y - 166, CONTENT_W, 166, PALE_GREEN, HexColor("#B5EACB"), 12)
    para(c, "MVP evaluation plan | Kế hoạch đánh giá MVP", M + 16, y - 16, CONTENT_W - 32, ST_H3)
    bullet_list(c, [
        "<b>Usability:</b> can a student complete a message/QR check and understand the action advice without help?",
        "<b>Learning:</b> compare correct decisions in short scam/safe scenarios before and after practice.",
        "<b>Quality:</b> record false-warning and missed-signal feedback; refine the reference catalogue and language prompts.",
        "<b>Trust:</b> ask whether users understand the privacy boundary and the need to verify through official channels.",
    ], M + 18, y - 44, CONTENT_W - 36)
    y -= 190
    card(c, M, y, CONTENT_W, 82, "Success is not “AI catches everything”", "Success means users can pause earlier, recognise patterns, and choose a safer real-world response. The product is deliberately positioned as a digital-safety learning companion.", PALE_GOLD, GOLD)
    footer(c, 7)


def page_roadmap(c):
    header(c, 8, "7. Development roadmap", "Lộ trình phát triển: củng cố trải nghiệm, dữ liệu tham chiếu và khả năng tiếp cận")
    y = PAGE_H - 112
    milestones = [
        ("Now | Hiện có", "Web analysis, OCR, QR inspection, library, practice mode, safe share export; Manifest V3 extension with manual scan and optional Auto Guard.", BLUE),
        ("Next | Bước tiếp", "Improve local pre-screening and cached results, refine category-specific RAG retrieval, expand bilingual content, add clearer status/error feedback.", GREEN),
        ("Pilot | Thử nghiệm", "Test with students, teachers and families; measure comprehension, warning quality and user confidence; collect feedback without collecting unnecessary personal data.", GOLD),
        ("Scale responsibly | Mở rộng", "Create curated updates with verified public sources, add accessibility/PWA improvements, and establish human review for new scam pattern proposals.", RED),
    ]
    row_h = 103
    for i, (title, body, accent) in enumerate(milestones):
        top = y - i * (row_h + 12)
        rounded(c, M, top - row_h, CONTENT_W, row_h, WHITE, LINE, 12)
        c.setFillColor(accent)
        c.roundRect(M, top - row_h, 9, row_h, 4, stroke=0, fill=1)
        c.setFillColor(accent)
        c.circle(M + 30, top - 30, 14, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Arial-Bold", 10)
        c.drawCentredString(M + 30, top - 34, str(i + 1))
        para(c, title, M + 57, top - 16, CONTENT_W - 75, ST_H3)
        para(c, body, M + 57, top - 40, CONTENT_W - 75, ST_CARD)
    footer(c, 8)


def page_links(c):
    header(c, 9, "8. Demo, links and declaration", "Demo, liên kết và tuyên bố dự án")
    y = PAGE_H - 112
    card(c, M, y, CONTENT_W, 91, "Demo and product access | Bản demo và truy cập sản phẩm", "<b>Web demo:</b> scamcheck-c3chuyenhvt.vercel.app\n<b>Chrome Extension:</b> Chrome Web Store listing / development package for testing\n<b>Team:</b> HVT.ShieldSpark  •  <b>Focus:</b> Cybersecurity & Digital Safety", PALE, BLUE)
    y -= 112
    rounded(c, M, y - 154, CONTENT_W, 154, WHITE, LINE, 12)
    para(c, "Official programme links provided by the organisers", M + 16, y - 17, CONTENT_W - 32, ST_H3)
    links = [
        "Programme information: https://vicee.vn/israelhackthon2026",
        "Application form: https://bit.ly/4wKbxGN",
        "Competition rules: https://bit.ly/4fOaakA",
        "Online registration: https://bit.ly/45W70oR",
        "ScamCheck Chrome Web Store: chromewebstore.google.com/detail/scamcheck-quét-tin-nhắn/bejijikaahllpmhiihpadlinmkacdieb",
    ]
    y2 = y - 47
    for line in links:
        y2 -= para(c, line, M + 20, y2, CONTENT_W - 40, ST_LINK) + 4
    y -= 177
    rounded(c, M, y - 168, CONTENT_W, 168, PALE_GOLD, HexColor("#FFD666"), 12)
    para(c, "Declaration | Tuyên bố", M + 16, y - 17, CONTENT_W - 32, ST_H3)
    rich(c, "ScamCheck is a student-developed educational prototype. Its assessments identify <b>risk indicators</b> and recommend safer verification steps; they do not determine criminal liability, guarantee that a link is safe, or replace official warnings from banks, platforms or competent authorities.<br/><br/>ScamCheck là sản phẩm giáo dục do nhóm học sinh phát triển. Kết quả chỉ nêu <b>dấu hiệu rủi ro</b> và gợi ý cách xác minh an toàn; không thay thế cảnh báo chính thức hoặc kết luận của ngân hàng, nền tảng và cơ quan chức năng.", M + 18, y - 46, CONTENT_W - 36, ST_CARD)
    y -= 195
    rounded(c, M, y - 82, CONTENT_W, 82, PALE_GREEN, HexColor("#B5EACB"), 12)
    para(c, "Submission note | Ghi chú nộp hồ sơ", M + 16, y - 16, CONTENT_W - 32, ST_H3)
    para(c, "This refreshed bilingual reference is designed for team planning and demonstration. For any official Round 1 submission, adapt the final language, format and page count to the organiser's latest requirements.", M + 16, y - 42, CONTENT_W - 32, ST_CARD_SMALL)
    footer(c, 9)


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("ScamCheck – HVT.ShieldSpark – Updated Bilingual Project Reference")
    c.setAuthor("HVT.ShieldSpark")
    c.setSubject("NextGen Innovator 2026 project reference: ScamCheck website and Chrome Extension")
    for fn in [page_cover, page_problem, page_web, page_extension, page_tech, page_privacy, page_impact, page_roadmap, page_links]:
        fn(c)
        c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
