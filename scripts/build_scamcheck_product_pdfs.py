from __future__ import annotations

from pathlib import Path
from html import escape

from PIL import Image
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(r"D:\prototype")
OUT = ROOT / "output" / "pdf"
ASSETS = {
    "logo": ROOT / "icon.png",
    "web": ROOT / "store-assets" / "website-background.png",
    "extension": ROOT / "Screenshot (232).png",
    "popup": ROOT / "store-assets" / "scamcheck-extension-screenshot-1.png",
}

PAGE_W, PAGE_H = A4
M = 42
CONTENT_W = PAGE_W - 2 * M

NAVY = HexColor("#0B1F46")
BLUE = HexColor("#2463EB")
LIGHT_BLUE = HexColor("#EAF2FF")
INK = HexColor("#1F2A3D")
MUTED = HexColor("#61718B")
LINE = HexColor("#D8E3F4")
GREEN = HexColor("#0EA55B")
LIGHT_GREEN = HexColor("#E9F8EF")
GOLD = HexColor("#D88A05")
LIGHT_GOLD = HexColor("#FFF5D9")
RED = HexColor("#D43B45")
LIGHT_RED = HexColor("#FFF0F1")
PALE = HexColor("#F7FAFF")


def register_fonts() -> None:
    font_dir = Path(r"C:\Windows\Fonts")
    regular = font_dir / "arial.ttf"
    bold = font_dir / "arialbd.ttf"
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("ScamArial", str(regular)))
        pdfmetrics.registerFont(TTFont("ScamArial-Bold", str(bold)))
    else:
        raise RuntimeError("Arial fonts are required to render Vietnamese text.")


def paragraph(c: canvas.Canvas, text: str, x: float, y_top: float, width: float,
              size: float = 10, leading: float | None = None, color=INK,
              bold: bool = False, align: int = 0) -> float:
    leading = leading or size * 1.36
    style = ParagraphStyle(
        name="scam-body",
        fontName="ScamArial-Bold" if bold else "ScamArial",
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        allowWidows=0,
        allowOrphans=0,
    )
    p = Paragraph(text, style)
    _, h = p.wrap(width, 1000)
    p.drawOn(c, x, y_top - h)
    return y_top - h


def rounded(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, radius: float = 12,
            stroke=None, line_width: float = 1) -> None:
    c.saveState()
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(line_width)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, radius, fill=1, stroke=0)
    c.restoreState()


def image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float,
                  radius: float = 10, bg=white) -> None:
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    rounded(c, x, y, w, h, bg, radius, LINE)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, radius)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float,
                radius: float = 10) -> None:
    with Image.open(path) as im:
        iw, ih = im.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    rounded(c, x, y, w, h, white, radius, LINE)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, radius)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def footer(c: canvas.Canvas, page_no: int, lang: str) -> None:
    c.setStrokeColor(LINE)
    c.line(M, 30, PAGE_W - M, 30)
    label = "ScamCheck | HVT.ShieldSpark" if lang == "en" else "ScamCheck | HVT.ShieldSpark"
    c.setFillColor(MUTED)
    c.setFont("ScamArial", 7.5)
    c.drawString(M, 17, label)
    c.drawRightString(PAGE_W - M, 17, f"{page_no} / 8")


def section_header(c: canvas.Canvas, number: str, title: str, kicker: str, page_no: int, lang: str) -> float:
    rounded(c, M, PAGE_H - 67, 36, 24, BLUE, 8)
    c.setFillColor(white)
    c.setFont("ScamArial-Bold", 10)
    c.drawCentredString(M + 18, PAGE_H - 59, number)
    c.setFillColor(NAVY)
    c.setFont("ScamArial-Bold", 21)
    c.drawString(M + 48, PAGE_H - 57, title)
    c.setFillColor(MUTED)
    c.setFont("ScamArial", 8.7)
    c.drawString(M + 49, PAGE_H - 73, kicker)
    footer(c, page_no, lang)
    return PAGE_H - 99


def tag(c: canvas.Canvas, text: str, x: float, y: float, fill, color=INK, w: float | None = None) -> float:
    c.setFont("ScamArial-Bold", 8)
    width = w or (c.stringWidth(text, "ScamArial-Bold", 8) + 18)
    rounded(c, x, y, width, 19, fill, 9)
    c.setFillColor(color)
    c.drawCentredString(x + width / 2, y + 6.2, text)
    return width


def feature_card(c: canvas.Canvas, x: float, y: float, w: float, h: float,
                 title: str, text: str, accent, fill=white) -> None:
    rounded(c, x, y, w, h, fill, 12, LINE)
    rounded(c, x + 15, y + h - 28, 6, 17, accent, 3)
    paragraph(c, f"<b>{escape(title)}</b>", x + 31, y + h - 15, w - 46, 10.1, 12, INK)
    paragraph(c, escape(text), x + 16, y + h - 42, w - 32, 8.5, 11.4, MUTED)


def bullet_list(c: canvas.Canvas, items: list[str], x: float, y_top: float, width: float,
                color=INK, size: float = 9.5, bullet_color=BLUE) -> float:
    y = y_top
    for item in items:
        c.setFillColor(bullet_color)
        c.circle(x + 4, y - 6, 2.1, fill=1, stroke=0)
        y = paragraph(c, escape(item), x + 14, y, width - 14, size, size * 1.38, color)
        y -= 6
    return y


def cover(c: canvas.Canvas, t: dict, lang: str) -> None:
    c.setFillColor(PALE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 162, PAGE_W, 162, fill=1, stroke=0)
    image_contain(c, ASSETS["logo"], M, PAGE_H - 100, 45, 45, 10, NAVY)
    c.setFillColor(white)
    c.setFont("ScamArial-Bold", 25)
    c.drawString(M + 58, PAGE_H - 72, "ScamCheck")
    c.setFont("ScamArial", 9.5)
    c.drawString(M + 60, PAGE_H - 89, t["cover_tag"])
    tag(c, t["team"], PAGE_W - M - 118, PAGE_H - 94, HexColor("#183A74"), white, 118)

    y = PAGE_H - 204
    c.setFillColor(NAVY)
    c.setFont("ScamArial-Bold", 29)
    c.drawString(M, y, t["cover_title"])
    y = paragraph(c, escape(t["cover_subtitle"]), M, y - 17, CONTENT_W, 13.2, 18, MUTED)
    tag(c, t["tag_web"], M, y - 35, LIGHT_BLUE, BLUE)
    tag(c, t["tag_extension"], M + 120, y - 35, LIGHT_GREEN, GREEN)
    tag(c, t["tag_education"], M + 252, y - 35, LIGHT_GOLD, GOLD)
    image_cover(c, ASSETS["web"], M, 97, CONTENT_W * 0.63, 170)
    image_cover(c, ASSETS["extension"], M + CONTENT_W * 0.66, 97, CONTENT_W * 0.34, 170)
    paragraph(c, escape(t["cover_note"]), M, 78, CONTENT_W, 8.7, 12, MUTED)
    footer(c, 1, lang)


def problem_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "01", t["problem_title"], t["problem_kicker"], 2, lang)
    paragraph(c, escape(t["problem_intro"]), M, y, CONTENT_W, 11, 15, INK)
    y -= 73
    columns = 2
    card_w = (CONTENT_W - 14) / columns
    cards = t["problem_cards"]
    for i, (title, text, accent, fill) in enumerate(cards):
        col, row = i % 2, i // 2
        feature_card(c, M + col * (card_w + 14), y - row * 111, card_w, 94, title, text, accent, fill)
    y -= 239
    rounded(c, M, y - 105, CONTENT_W, 93, NAVY, 14)
    paragraph(c, f"<b>{escape(t['design_question_title'])}</b>", M + 22, y - 31, CONTENT_W - 44, 13, 16, white)
    paragraph(c, escape(t["design_question"]), M + 22, y - 54, CONTENT_W - 44, 9.4, 13, HexColor("#D9E7FF"))


def web_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "02", t["web_title"], t["web_kicker"], 3, lang)
    image_contain(c, ASSETS["web"], M, y - 247, CONTENT_W, 231, 12)
    y -= 274
    paragraph(c, escape(t["web_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 66
    card_w = (CONTENT_W - 18) / 3
    for i, (title, text, accent, fill) in enumerate(t["web_cards"]):
        feature_card(c, M + i * (card_w + 9), y - 95, card_w, 84, title, text, accent, fill)


def extension_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "03", t["extension_title"], t["extension_kicker"], 4, lang)
    image_contain(c, ASSETS["extension"], M, y - 299, CONTENT_W * 0.62, 283, 12)
    image_contain(c, ASSETS["popup"], M + CONTENT_W * 0.65, y - 299, CONTENT_W * 0.35, 283, 12)
    y -= 327
    paragraph(c, escape(t["extension_intro"]), M, y, CONTENT_W, 10, 14, INK)
    y -= 57
    bullet_list(c, t["extension_bullets"], M, y, CONTENT_W, size=9.3)


def mechanism_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "04", t["mechanism_title"], t["mechanism_kicker"], 5, lang)
    paragraph(c, escape(t["mechanism_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 77
    steps = t["steps"]
    box_w = (CONTENT_W - 18) / 4
    step_y = y - 97
    for i, (title, text, color, fill) in enumerate(steps):
        x = M + i * (box_w + 6)
        rounded(c, x, step_y, box_w, 88, fill, 12, LINE)
        tag(c, str(i + 1), x + 14, step_y + 54, color, white, 22)
        paragraph(c, f"<b>{escape(title)}</b>", x + 14, step_y + 48, box_w - 28, 9.5, 12, INK)
        paragraph(c, escape(text), x + 14, step_y + 31, box_w - 28, 7.7, 9.6, MUTED)
        if i < 3:
            c.setStrokeColor(BLUE)
            c.setLineWidth(1.4)
            c.line(x + box_w + 1, step_y + 44, x + box_w + 5, step_y + 44)
    y -= 144
    rounded(c, M, y - 151, CONTENT_W, 138, LIGHT_BLUE, 14, HexColor("#C6DBFF"))
    paragraph(c, f"<b>{escape(t['mechanism_guard_title'])}</b>", M + 20, y - 34, CONTENT_W - 40, 12.3, 16, NAVY)
    bullet_list(c, t["mechanism_bullets"], M + 18, y - 56, CONTENT_W - 36, INK, 9.2, BLUE)


def journeys_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "05", t["journeys_title"], t["journeys_kicker"], 6, lang)
    card_w = (CONTENT_W - 16) / 2
    for i, journey in enumerate(t["journeys"]):
        x = M + i * (card_w + 16)
        rounded(c, x, y - 299, card_w, 284, white, 14, LINE)
        tag(c, journey["label"], x + 18, y - 44, journey["color"], white)
        paragraph(c, f"<b>{escape(journey['title'])}</b>", x + 18, y - 72, card_w - 36, 15, 18, NAVY)
        bullet_list(c, journey["bullets"], x + 18, y - 106, card_w - 36, INK, 9.4, journey["color"])
        paragraph(c, escape(journey["outcome"]), x + 18, y - 260, card_w - 36, 8.8, 12, MUTED)
    paragraph(c, escape(t["journey_note"]), M, y - 329, CONTENT_W, 9.5, 13, MUTED)


def applications_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "06", t["applications_title"], t["applications_kicker"], 7, lang)
    paragraph(c, escape(t["applications_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 74
    card_w = (CONTENT_W - 18) / 3
    for i, (title, text, accent, fill) in enumerate(t["applications_cards"]):
        feature_card(c, M + i * (card_w + 9), y - 150, card_w, 137, title, text, accent, fill)
    y -= 184
    rounded(c, M, y - 126, CONTENT_W, 112, LIGHT_GREEN, 14, HexColor("#BAE8CC"))
    paragraph(c, f"<b>{escape(t['impact_title'])}</b>", M + 20, y - 35, CONTENT_W - 40, 12, 15, HexColor("#125C33"))
    bullet_list(c, t["impact_bullets"], M + 18, y - 59, CONTENT_W - 36, HexColor("#125C33"), 9.1, GREEN)


def safety_page(c: canvas.Canvas, t: dict, lang: str) -> None:
    y = section_header(c, "07", t["safety_title"], t["safety_kicker"], 8, lang)
    rounded(c, M, y - 140, CONTENT_W, 126, LIGHT_GOLD, 14, HexColor("#F3D78A"))
    paragraph(c, f"<b>{escape(t['limits_title'])}</b>", M + 20, y - 37, CONTENT_W - 40, 13, 16, HexColor("#714C00"))
    bullet_list(c, t["limits_bullets"], M + 18, y - 60, CONTENT_W - 36, HexColor("#714C00"), 9.1, GOLD)
    y -= 180
    paragraph(c, f"<b>{escape(t['roadmap_title'])}</b>", M, y, CONTENT_W, 15, 18, NAVY)
    y -= 33
    card_w = (CONTENT_W - 18) / 3
    for i, (title, text, accent, fill) in enumerate(t["roadmap_cards"]):
        feature_card(c, M + i * (card_w + 9), y - 112, card_w, 100, title, text, accent, fill)
    y -= 151
    rounded(c, M, y - 79, CONTENT_W, 66, NAVY, 13)
    paragraph(c, escape(t["closing"]), M + 20, y - 33, CONTENT_W - 40, 10.1, 14, white)
    paragraph(c, escape(t["link"]), M + 20, y - 58, CONTENT_W - 40, 8.5, 11, HexColor("#BFD7FF"))


EN = {
    "cover_tag": "Safer digital decisions before a risky click",
    "team": "HVT.ShieldSpark",
    "cover_title": "ScamCheck Product Overview",
    "cover_subtitle": "A bilingual web app and Chrome extension that help people recognise suspicious messages, links and on-page scam signals before acting.",
    "tag_web": "Web application",
    "tag_extension": "Chrome extension",
    "tag_education": "Educational tool",
    "cover_note": "ScamCheck is an educational product developed by a student team. Its assessment does not replace official warnings from banks or competent authorities.",
    "problem_title": "The problem to solve",
    "problem_kicker": "Scams exploit urgency, authority and uncertainty",
    "problem_intro": "A suspicious message is rarely just a technical problem. It is a decision problem: users must recognise pressure, pause, and choose a safer verification path before money, credentials or personal information are exposed.",
    "problem_cards": [
        ("Fast-changing messages", "Scam wording changes quickly across SMS, email, social media, chat and websites.", RED, LIGHT_RED),
        ("Psychological pressure", "Impersonation, deadlines and large rewards can push people to act before checking.", GOLD, LIGHT_GOLD),
        ("Information overload", "Links, screenshots, QR codes and copied branding make a quick judgement difficult.", BLUE, LIGHT_BLUE),
        ("Uneven digital confidence", "Students, families and older users may not know which official channel to trust.", GREEN, LIGHT_GREEN),
    ],
    "design_question_title": "Product question",
    "design_question": "How can a user receive an understandable warning and a practical next step without opening a suspicious link or pretending that an AI result is an official verdict?",
    "web_title": "The ScamCheck web application",
    "web_kicker": "A guided safety check before interaction",
    "web_intro": "The web app provides a single place to paste a message, use browser-supported speech-to-text, upload an image for local OCR, or inspect a QR code before opening its destination. It returns risk context and safer actions in Vietnamese or English.",
    "web_cards": [
        ("Analyse", "Risk category, warning signs and practical safety actions.", BLUE, LIGHT_BLUE),
        ("Learn", "Scam library, trusted contact guidance and decision practice.", GREEN, LIGHT_GREEN),
        ("Share safely", "Redacted result sharing and a clear educational disclaimer.", GOLD, LIGHT_GOLD),
    ],
    "extension_title": "The ScamCheck extension",
    "extension_kicker": "Safety support where people already browse",
    "extension_intro": "The Chrome extension brings ScamCheck into the current page. It supports a user-triggered scan and an opt-in Auto Guard mode that checks a limited visible-text snapshot for meaningful warning signs.",
    "extension_bullets": [
        "Manual scan: select text, paste it, or crop an on-page image for local OCR.",
        "Optional Auto Guard: detects high-risk patterns in the visible page content and displays an on-page warning.",
        "Gmail-aware capture: prioritises the opened email body instead of navigation text.",
        "No automatic link opening, and form/password fields are excluded from Auto Guard collection.",
    ],
    "mechanism_title": "How ScamCheck works",
    "mechanism_kicker": "A safety-first pipeline with OpenAI and reference RAG",
    "mechanism_intro": "ScamCheck keeps API keys on the server. The client sends only the selected text, pasted text, or a bounded visible-text snapshot when Auto Guard is enabled. The backend prepares a structured prompt with relevant safety references and asks OpenAI for JSON output.",
    "steps": [
        ("Capture", "Paste text, select page text, run local OCR, or scan QR data.", BLUE, LIGHT_BLUE),
        ("Protect", "Bound length, exclude form/password fields, never open submitted links.", GREEN, LIGHT_GREEN),
        ("Analyse", "Server adds matched ScamCheck reference patterns and calls OpenAI.", GOLD, LIGHT_GOLD),
        ("Guide", "Structured JSON becomes risk, red flags and safer actions in the UI.", RED, LIGHT_RED),
    ],
    "mechanism_guard_title": "Safety controls built into the flow",
    "mechanism_bullets": [
        "OpenAI API key remains in the Vercel server environment, never in the web page or extension package.",
        "Auto Guard is opt-in and sends a limited visible snapshot; it does not read passwords or form values.",
        "The extension can retry with a smaller snapshot on noisy pages before showing local reference-only guidance.",
        "AI output is presented as educational support, not as a bank, police or government warning.",
    ],
    "journeys_title": "Two user journeys",
    "journeys_kicker": "Manual investigation and optional in-context protection",
    "journeys": [
        {"label": "WEB", "color": BLUE, "title": "Check before you act", "bullets": ["Paste a suspicious message or use a supported input method.", "Review risk signals, link context and recommended actions.", "Use the library, practice module or reporting guidance to learn what to do next."], "outcome": "Outcome: a calm, explainable decision aid before the user calls, transfers, replies or opens a link."},
        {"label": "EXTENSION", "color": GREEN, "title": "Protect while browsing", "bullets": ["Open the extension for a manual scan or enable Auto Guard.", "Auto Guard reads only a bounded visible-text snapshot.", "For strong evidence, an overlay explains the danger and offers safer guidance."], "outcome": "Outcome: a warning can appear in the same browsing context where the risky decision is happening."},
    ],
    "journey_note": "The user remains in control: they can dismiss a warning, mute a website, select what to scan, and verify independently through official channels.",
    "applications_title": "Applications and value",
    "applications_kicker": "Designed for learning and everyday digital safety",
    "applications_intro": "ScamCheck is useful both as a personal safety companion and as a classroom demonstration of responsible AI: it combines pattern recognition, user experience, privacy boundaries and critical thinking.",
    "applications_cards": [
        ("Students", "Build habits for evaluating urgency, unusual links and impersonation before reacting.", BLUE, LIGHT_BLUE),
        ("Families", "Give relatives a simple way to discuss a worrying message and choose a safer next step.", GREEN, LIGHT_GREEN),
        ("Schools", "Support digital-citizenship activities, practice scenarios and evidence-based discussion.", GOLD, LIGHT_GOLD),
    ],
    "impact_title": "What success looks like",
    "impact_bullets": [
        "More users pause before following urgent instructions.",
        "Warnings explain why something is risky instead of only assigning a label.",
        "Users know to use official apps, websites or hotlines for verification.",
    ],
    "safety_title": "Limits, safety and next steps",
    "safety_kicker": "Useful guidance with clear boundaries",
    "limits_title": "What ScamCheck does not claim",
    "limits_bullets": [
        "It does not verify the identity of a sender, bank, agency or website owner.",
        "It does not replace a bank, telecom provider, police service or other official authority.",
        "An AI assessment can be incomplete or wrong; users should stop and verify when the stakes are high.",
    ],
    "roadmap_title": "Practical next steps",
    "roadmap_cards": [
        ("Evaluation", "Build a labelled test set and track false positives, false negatives and language quality.", BLUE, LIGHT_BLUE),
        ("Verified data", "Maintain source-linked reference patterns and review hotline/library records regularly.", GREEN, LIGHT_GREEN),
        ("Feedback loop", "Use privacy-aware feedback to improve explanations, accessibility and common scam coverage.", GOLD, LIGHT_GOLD),
    ],
    "closing": "ScamCheck aims to make the safer action feel easier: pause, understand the signal, and verify through an official channel.",
    "link": "Product web: https://scamcheck-c3chuyenhvt.vercel.app | Chrome extension: ScamCheck - Quet tin nhan",
}


VI = {
    "cover_tag": "Giup ra quyet dinh an toan truoc khi bam vao lien ket rui ro",
    "team": "HVT.ShieldSpark",
    "cover_title": "Gioi thieu san pham ScamCheck",
    "cover_subtitle": "Website va Chrome extension song ngu giup nguoi dung nhan ra tin nhan, duong dan va dau hieu lua dao tren trang truoc khi thao tac.",
    "tag_web": "Ung dung web",
    "tag_extension": "Chrome extension",
    "tag_education": "Cong cu giao duc",
    "cover_note": "ScamCheck la cong cu giao duc do nhom hoc sinh phat trien. Danh gia cua ung dung khong thay the canh bao chinh thuc tu ngan hang hoac co quan chuc nang.",
    "problem_title": "Van de can giai quyet",
    "problem_kicker": "Lua dao khai thac su khan cap, uy quyen va bat an",
    "problem_intro": "Mot tin nhan dang ngo khong chi la van de ky thuat. Do la van de ra quyet dinh: nguoi dung can nhan ra ap luc, dung lai va chon cach xac minh an toan truoc khi lo tien, thong tin ca nhan hoac thong tin dang nhap.",
    "problem_cards": [
        ("Noi dung thay doi nhanh", "Cach dien dat lua dao thay doi lien tuc tren SMS, email, mang xa hoi, chat va website.", RED, LIGHT_RED),
        ("Ap luc tam ly", "Gia mao, han chot va loi hua tien thuong lon de day nguoi dung hanh dong som.", GOLD, LIGHT_GOLD),
        ("Qua tai thong tin", "Link, anh chup man hinh, ma QR va thuong hieu bi sao chep lam viec danh gia nhanh kho hon.", BLUE, LIGHT_BLUE),
        ("Chenh lech ky nang so", "Hoc sinh, gia dinh va nguoi lon tuoi co the chua biet kenh chinh thuc nao dang tin cay.", GREEN, LIGHT_GREEN),
    ],
    "design_question_title": "Cau hoi thiet ke",
    "design_question": "Lam the nao de nguoi dung nhan canh bao de hieu va co buoc xu ly thuc te, ma khong mo link dang ngo hoac gia dinh ket qua AI la ket luan chinh thuc?",
    "web_title": "Ung dung web ScamCheck",
    "web_kicker": "Kiem tra an toan truoc khi tuong tac",
    "web_intro": "Website cho phep dan tin nhan, dung nhap giong noi neu trinh duyet ho tro, tai anh de OCR cuc bo hoac kiem tra ma QR truoc khi mo dich den. Ket qua duoc trinh bay bang tieng Viet hoac tieng Anh kem dau hieu rui ro va hanh dong an toan hon.",
    "web_cards": [
        ("Phan tich", "Muc do rui ro, dau hieu can chu y va hanh dong an toan thuc te.", BLUE, LIGHT_BLUE),
        ("Hoc tap", "Thu vien mau lua dao, huong dan lien he chinh thuc va bai tap tinh huong.", GREEN, LIGHT_GREEN),
        ("Chia se an toan", "Chia se ket qua da che thong tin nhay cam va co tuyên bo ro rang.", GOLD, LIGHT_GOLD),
    ],
    "extension_title": "ScamCheck extension",
    "extension_kicker": "Ho tro an toan ngay tai noi nguoi dung dang luot web",
    "extension_intro": "Chrome extension dua ScamCheck vao ngay trang dang mo. Nguoi dung co the chu dong quet, hoac bat Auto Guard tu nguyen de kiem tra mot ban chup chu dang hien thi co gioi han cho cac dau hieu can canh bao.",
    "extension_bullets": [
        "Kiem tra chu dong: boi den chu, dan noi dung hoac khoanh vung anh tren trang de OCR cuc bo.",
        "Auto Guard tuy chon: phat hien mau rui ro cao trong chu dang hien thi va hien canh bao tren trang.",
        "Toi uu Gmail: uu tien phan than email dang mo thay vi chu dieu huong.",
        "Khong tu mo link; truong form va mat khau duoc loai tru khoi thu thap cua Auto Guard.",
    ],
    "mechanism_title": "Co che hoat dong",
    "mechanism_kicker": "Quy trinh uu tien an toan voi OpenAI va RAG tham chieu",
    "mechanism_intro": "Khoa API duoc giu tai server. Phia nguoi dung chi gui phan chu da chon, chu da dan hoac ban chup chu dang hien thi co gioi han khi bat Auto Guard. Backend tao prompt co cau truc, chen mau tham chieu phu hop va goi OpenAI de nhan JSON co cau truc.",
    "steps": [
        ("Nhap", "Dan chu, boi den chu tren trang, OCR cuc bo hoac quet du lieu QR.", BLUE, LIGHT_BLUE),
        ("Bao ve", "Gioi han do dai, loai tru form va mat khau, khong mo link duoc gui vao.", GREEN, LIGHT_GREEN),
        ("Phan tich", "Server chen mau tham chieu ScamCheck phu hop va goi OpenAI.", GOLD, LIGHT_GOLD),
        ("Huong dan", "JSON co cau truc tro thanh muc rui ro, dau hieu va viec nen lam tren giao dien.", RED, LIGHT_RED),
    ],
    "mechanism_guard_title": "Cac lop bao ve trong quy trinh",
    "mechanism_bullets": [
        "Khoa OpenAI nam trong moi truong Vercel cua server, khong nam trong website hoac goi extension.",
        "Auto Guard la tuy chon va chi gui ban chup chu dang hien thi co gioi han; khong doc mat khau hay gia tri form.",
        "Extension co the thu lai voi ban chup ngan hon tren trang nhieu chu nhieu truoc khi dung doi chieu cuc bo.",
        "Ket qua AI la ho tro giao duc, khong phai canh bao tu ngan hang, cong an hay co quan nha nuoc.",
    ],
    "journeys_title": "Hai hanh trinh nguoi dung",
    "journeys_kicker": "Kiem tra chu dong va bao ve tuy chon trong luc luot web",
    "journeys": [
        {"label": "WEB", "color": BLUE, "title": "Kiem tra truoc khi thao tac", "bullets": ["Dan tin nhan dang ngo hoac dung mot cach nhap duoc ho tro.", "Xem dau hieu rui ro, ngu canh link va khuyen nghi hanh dong.", "Mo thu vien, bai tap tinh huong hoac huong dan bao cao de biet buoc tiep theo."], "outcome": "Ket qua: mot cong cu ho tro ra quyet dinh binh tinh truoc khi nguoi dung goi, chuyen tien, tra loi hoac mo link."},
        {"label": "EXTENSION", "color": GREEN, "title": "Bao ve trong khi luot web", "bullets": ["Mo extension de quet chu dong hoac bat Auto Guard.", "Auto Guard chi doc ban chup chu dang hien thi co gioi han.", "Khi co bang chung manh, overlay giai thich nguy co va dua ra huong dan an toan."], "outcome": "Ket qua: canh bao co the xuat hien ngay trong boi canh nguoi dung sap thao tac rui ro."},
    ],
    "journey_note": "Nguoi dung luon nam quyen kiem soat: co the dong canh bao, tat canh bao tren mot website, tu chon noi dung quet va tu xac minh qua kenh chinh thuc.",
    "applications_title": "Ung dung va gia tri",
    "applications_kicker": "Phuc vu hoc tap va an toan so hang ngay",
    "applications_intro": "ScamCheck vua la cong cu dong hanh an toan ca nhan, vua la vi du ve AI co trach nhiem trong giao duc: ket hop nhan dien mau, trai nghiem nguoi dung, ranh gioi rieng tu va tu duy phan bien.",
    "applications_cards": [
        ("Hoc sinh", "Tao thoi quen danh gia su khan cap, link bat thuong va hanh vi gia mao truoc khi phan ung.", BLUE, LIGHT_BLUE),
        ("Gia dinh", "Tao cach don gian de cung trao doi ve tin nhan dang lo va chon buoc xac minh an toan.", GREEN, LIGHT_GREEN),
        ("Nha truong", "Ho tro hoat dong cong dan so, bai tap tinh huong va thao luan dua tren bang chung.", GOLD, LIGHT_GOLD),
    ],
    "impact_title": "Thanh cong mong muon",
    "impact_bullets": [
        "Nguoi dung dung lai truoc khi lam theo yeu cau khan cap.",
        "Canh bao giai thich vi sao dang ngo thay vi chi gan nhan nguy hiem.",
        "Nguoi dung biet mo app, website hoac hotline chinh thuc de xac minh.",
    ],
    "safety_title": "Gioi han, an toan va huong phat trien",
    "safety_kicker": "Huong dan huu ich voi ranh gioi ro rang",
    "limits_title": "ScamCheck khong tu nhan dieu gi",
    "limits_bullets": [
        "Khong xac minh danh tinh nguoi gui, ngan hang, co quan hay chu so huu website.",
        "Khong thay the ngan hang, nha mang, cong an hoac bat ky co quan chuc nang nao.",
        "Danh gia AI co the thieu hoac sai; nguoi dung can dung lai va xac minh khi hau qua co the lon.",
    ],
    "roadmap_title": "Buoc phat trien tiep theo",
    "roadmap_cards": [
        ("Danh gia", "Xay dung bo test co gan nhan va theo doi false positive, false negative va chat luong ngon ngu.", BLUE, LIGHT_BLUE),
        ("Du lieu xac thuc", "Duy tri mau tham chieu co lien ket nguon va ra soat thu vien, hotline dinh ky.", GREEN, LIGHT_GREEN),
        ("Vong lap phan hoi", "Dung phan hoi co bao ve rieng tu de cai thien giai thich, kha nang tiep can va phu song lua dao.", GOLD, LIGHT_GOLD),
    ],
    "closing": "ScamCheck huong toi viec lam cho lua chon an toan tro nen de hon: dung lai, hieu dau hieu va xac minh qua kenh chinh thuc.",
    "link": "Website: https://scamcheck-c3chuyenhvt.vercel.app | Chrome extension: ScamCheck - Quet tin nhan",
}


# Replace the ASCII draft strings above with publication-ready Vietnamese.
# Keeping this override together makes the English and Vietnamese content easy
# to compare and avoids any accidental mixed-language copy in the final PDF.
VI.update({
    "cover_tag": "Giúp ra quyết định an toàn trước khi bấm vào liên kết rủi ro",
    "cover_title": "Giới thiệu sản phẩm ScamCheck",
    "cover_subtitle": "Website và Chrome extension song ngữ giúp người dùng nhận ra tin nhắn, đường dẫn và dấu hiệu lừa đảo trên trang trước khi thao tác.",
    "tag_web": "Ứng dụng web", "tag_extension": "Chrome extension", "tag_education": "Công cụ giáo dục",
    "cover_note": "ScamCheck là công cụ giáo dục do nhóm học sinh phát triển. Đánh giá của ứng dụng không thay thế cảnh báo chính thức từ ngân hàng hoặc cơ quan chức năng.",
    "problem_title": "Vấn đề cần giải quyết", "problem_kicker": "Lừa đảo khai thác sự khẩn cấp, uy quyền và bất an",
    "problem_intro": "Một tin nhắn đáng ngờ không chỉ là vấn đề kỹ thuật. Đó là vấn đề ra quyết định: người dùng cần nhận ra áp lực, dừng lại và chọn cách xác minh an toàn trước khi lộ tiền, thông tin cá nhân hoặc thông tin đăng nhập.",
    "problem_cards": [
        ("Nội dung thay đổi nhanh", "Cách diễn đạt lừa đảo thay đổi liên tục trên SMS, email, mạng xã hội, chat và website.", RED, LIGHT_RED),
        ("Áp lực tâm lý", "Giả mạo, hạn chót và lời hứa tiền thưởng lớn để đẩy người dùng hành động sớm.", GOLD, LIGHT_GOLD),
        ("Quá tải thông tin", "Link, ảnh chụp màn hình, mã QR và thương hiệu bị sao chép làm việc đánh giá nhanh khó hơn.", BLUE, LIGHT_BLUE),
        ("Chênh lệch kỹ năng số", "Học sinh, gia đình và người lớn tuổi có thể chưa biết kênh chính thức nào đáng tin cậy.", GREEN, LIGHT_GREEN),
    ],
    "design_question_title": "Câu hỏi thiết kế",
    "design_question": "Làm thế nào để người dùng nhận cảnh báo dễ hiểu và có bước xử lý thực tế, mà không mở link đáng ngờ hoặc giả định kết quả AI là kết luận chính thức?",
    "web_title": "Ứng dụng web ScamCheck", "web_kicker": "Kiểm tra an toàn trước khi tương tác",
    "web_intro": "Website cho phép dán tin nhắn, dùng nhập giọng nói nếu trình duyệt hỗ trợ, tải ảnh để OCR cục bộ hoặc kiểm tra mã QR trước khi mở đích đến. Kết quả được trình bày bằng tiếng Việt hoặc tiếng Anh kèm dấu hiệu rủi ro và hành động an toàn hơn.",
    "web_cards": [
        ("Phân tích", "Mức độ rủi ro, dấu hiệu cần chú ý và hành động an toàn thực tế.", BLUE, LIGHT_BLUE),
        ("Học tập", "Thư viện mẫu lừa đảo, hướng dẫn liên hệ chính thức và bài tập tình huống.", GREEN, LIGHT_GREEN),
        ("Chia sẻ an toàn", "Chia sẻ kết quả đã che thông tin nhạy cảm và có tuyên bố rõ ràng.", GOLD, LIGHT_GOLD),
    ],
    "extension_title": "ScamCheck extension", "extension_kicker": "Hỗ trợ an toàn ngay tại nơi người dùng đang lướt web",
    "extension_intro": "Chrome extension đưa ScamCheck vào ngay trang đang mở. Người dùng có thể chủ động quét, hoặc bật Auto Guard tự nguyện để kiểm tra một bản chụp chữ đang hiển thị có giới hạn cho các dấu hiệu cần cảnh báo.",
    "extension_bullets": [
        "Kiểm tra chủ động: bôi đen chữ, dán nội dung hoặc khoanh vùng ảnh trên trang để OCR cục bộ.",
        "Auto Guard tùy chọn: phát hiện mẫu rủi ro cao trong chữ đang hiển thị và hiện cảnh báo trên trang.",
        "Tối ưu Gmail: ưu tiên phần thân email đang mở thay vì chữ điều hướng.",
        "Không tự mở link; trường form và mật khẩu được loại trừ khỏi thu thập của Auto Guard.",
    ],
    "mechanism_title": "Cơ chế hoạt động", "mechanism_kicker": "Quy trình ưu tiên an toàn với OpenAI và RAG tham chiếu",
    "mechanism_intro": "Khóa API được giữ tại server. Phía người dùng chỉ gửi phần chữ đã chọn, chữ đã dán hoặc bản chụp chữ đang hiển thị có giới hạn khi bật Auto Guard. Backend tạo prompt có cấu trúc, chèn mẫu tham chiếu phù hợp và gọi OpenAI để nhận JSON có cấu trúc.",
    "steps": [
        ("Nhập", "Dán chữ, bôi đen chữ trên trang, OCR cục bộ hoặc quét dữ liệu QR.", BLUE, LIGHT_BLUE),
        ("Bảo vệ", "Giới hạn độ dài, loại trừ form và mật khẩu, không mở link được gửi vào.", GREEN, LIGHT_GREEN),
        ("Phân tích", "Server chèn mẫu tham chiếu ScamCheck phù hợp và gọi OpenAI.", GOLD, LIGHT_GOLD),
        ("Hướng dẫn", "JSON có cấu trúc trở thành mức rủi ro, dấu hiệu và việc nên làm trên giao diện.", RED, LIGHT_RED),
    ],
    "mechanism_guard_title": "Các lớp bảo vệ trong quy trình",
    "mechanism_bullets": [
        "Khóa OpenAI nằm trong môi trường Vercel của server, không nằm trong website hoặc gói extension.",
        "Auto Guard là tùy chọn và chỉ gửi bản chụp chữ đang hiển thị có giới hạn; không đọc mật khẩu hay giá trị form.",
        "Extension có thể thử lại với bản chụp ngắn hơn trên trang nhiều chữ nhiễu trước khi dùng đối chiếu cục bộ.",
        "Kết quả AI là hỗ trợ giáo dục, không phải cảnh báo từ ngân hàng, công an hay cơ quan nhà nước.",
    ],
    "journeys_title": "Hai hành trình người dùng", "journeys_kicker": "Kiểm tra chủ động và bảo vệ tùy chọn trong lúc lướt web",
    "journeys": [
        {"label": "WEB", "color": BLUE, "title": "Kiểm tra trước khi thao tác", "bullets": ["Dán tin nhắn đáng ngờ hoặc dùng một cách nhập được hỗ trợ.", "Xem dấu hiệu rủi ro, ngữ cảnh link và khuyến nghị hành động.", "Mở thư viện, bài tập tình huống hoặc hướng dẫn báo cáo để biết bước tiếp theo."], "outcome": "Kết quả: một công cụ hỗ trợ ra quyết định bình tĩnh trước khi người dùng gọi, chuyển tiền, trả lời hoặc mở link."},
        {"label": "EXTENSION", "color": GREEN, "title": "Bảo vệ trong khi lướt web", "bullets": ["Mở extension để quét chủ động hoặc bật Auto Guard.", "Auto Guard chỉ đọc bản chụp chữ đang hiển thị có giới hạn.", "Khi có bằng chứng mạnh, overlay giải thích nguy cơ và đưa ra hướng dẫn an toàn."], "outcome": "Kết quả: cảnh báo có thể xuất hiện ngay trong bối cảnh người dùng sắp thao tác rủi ro."},
    ],
    "journey_note": "Người dùng luôn nắm quyền kiểm soát: có thể đóng cảnh báo, tắt cảnh báo trên một website, tự chọn nội dung quét và tự xác minh qua kênh chính thức.",
    "applications_title": "Ứng dụng và giá trị", "applications_kicker": "Phục vụ học tập và an toàn số hằng ngày",
    "applications_intro": "ScamCheck vừa là công cụ đồng hành an toàn cá nhân, vừa là ví dụ về AI có trách nhiệm trong giáo dục: kết hợp nhận diện mẫu, trải nghiệm người dùng, ranh giới riêng tư và tư duy phản biện.",
    "applications_cards": [
        ("Học sinh", "Tạo thói quen đánh giá sự khẩn cấp, link bất thường và hành vi giả mạo trước khi phản ứng.", BLUE, LIGHT_BLUE),
        ("Gia đình", "Tạo cách đơn giản để cùng trao đổi về tin nhắn đáng lo và chọn bước xác minh an toàn.", GREEN, LIGHT_GREEN),
        ("Nhà trường", "Hỗ trợ hoạt động công dân số, bài tập tình huống và thảo luận dựa trên bằng chứng.", GOLD, LIGHT_GOLD),
    ],
    "impact_title": "Thành công mong muốn",
    "impact_bullets": [
        "Người dùng dừng lại trước khi làm theo yêu cầu khẩn cấp.",
        "Cảnh báo giải thích vì sao đáng ngờ thay vì chỉ gắn nhãn nguy hiểm.",
        "Người dùng biết mở app, website hoặc hotline chính thức để xác minh.",
    ],
    "safety_title": "Giới hạn, an toàn và hướng phát triển", "safety_kicker": "Hướng dẫn hữu ích với ranh giới rõ ràng",
    "limits_title": "ScamCheck không tự nhận điều gì",
    "limits_bullets": [
        "Không xác minh danh tính người gửi, ngân hàng, cơ quan hay chủ sở hữu website.",
        "Không thay thế ngân hàng, nhà mạng, công an hoặc bất kỳ cơ quan chức năng nào.",
        "Đánh giá AI có thể thiếu hoặc sai; người dùng cần dừng lại và xác minh khi hậu quả có thể lớn.",
    ],
    "roadmap_title": "Bước phát triển tiếp theo",
    "roadmap_cards": [
        ("Đánh giá", "Xây dựng bộ test có gắn nhãn và theo dõi false positive, false negative và chất lượng ngôn ngữ.", BLUE, LIGHT_BLUE),
        ("Dữ liệu xác thực", "Duy trì mẫu tham chiếu có liên kết nguồn và rà soát thư viện, hotline định kỳ.", GREEN, LIGHT_GREEN),
        ("Vòng lặp phản hồi", "Dùng phản hồi có bảo vệ riêng tư để cải thiện giải thích, khả năng tiếp cận và phủ sóng lừa đảo.", GOLD, LIGHT_GOLD),
    ],
    "closing": "ScamCheck hướng tới việc làm cho lựa chọn an toàn trở nên dễ hơn: dừng lại, hiểu dấu hiệu và xác minh qua kênh chính thức.",
    "link": "Website: https://scamcheck-c3chuyenhvt.vercel.app | Chrome extension: ScamCheck - Quét tin nhắn",
})


def build(language: str, data: dict, output_name: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / output_name
    c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    c.setTitle("ScamCheck Product Overview" if language == "en" else "Gioi thieu san pham ScamCheck")
    c.setAuthor("HVT.ShieldSpark")
    cover(c, data, language); c.showPage()
    problem_page(c, data, language); c.showPage()
    web_page(c, data, language); c.showPage()
    extension_page(c, data, language); c.showPage()
    mechanism_page(c, data, language); c.showPage()
    journeys_page(c, data, language); c.showPage()
    applications_page(c, data, language); c.showPage()
    safety_page(c, data, language); c.showPage()
    c.save()
    return output


if __name__ == "__main__":
    register_fonts()
    for asset in ASSETS.values():
        if not asset.exists():
            raise FileNotFoundError(asset)
    en = build("en", EN, "ScamCheck_Product_Overview_EN.pdf")
    vi = build("vi", VI, "ScamCheck_Gioi_thieu_San_pham_VI.pdf")
    print(en)
    print(vi)
