from __future__ import annotations

from html import escape
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


ROOT = Path(r"D:\prototype")
OUT = ROOT / "output" / "pdf"
ASSETS = {
    "logo": ROOT / "icon.png",
    "web": ROOT / "store-assets" / "website-background.png",
    "extension": ROOT / "Screenshot (232).png",
    "popup": ROOT / "store-assets" / "scamcheck-extension-screenshot-1.png",
}

PAGE_W, PAGE_H = A4
M = 44
CONTENT_W = PAGE_W - 2 * M
NAVY = HexColor("#0D2451")
BLUE = HexColor("#2764E7")
SKY = HexColor("#EAF2FF")
INK = HexColor("#17243A")
MUTED = HexColor("#5F718E")
LINE = HexColor("#D9E4F5")
GREEN = HexColor("#0EAE62")
MINT = HexColor("#EAF9F0")
GOLD = HexColor("#E58A00")
CREAM = HexColor("#FFF6DF")
RED = HexColor("#D83A4A")
ROSE = HexColor("#FFF0F2")
PALE = HexColor("#F7FAFF")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("SCArial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("SCArial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


def para(c: canvas.Canvas, text: str, x: float, y_top: float, width: float, size: float = 10,
         leading: float | None = None, color=INK, bold: bool = False, align: int = 0) -> float:
    leading = leading or size * 1.35
    style = ParagraphStyle(
        name="sc-copy",
        fontName="SCArial-Bold" if bold else "SCArial",
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        allowWidows=0,
        allowOrphans=0,
    )
    block = Paragraph(text, style)
    _, h = block.wrap(width, 1200)
    block.drawOn(c, x, y_top - h)
    return y_top - h


def box(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, radius: float = 12,
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


def image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float, radius: float = 12) -> None:
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    box(c, x, y, w, h, white, radius, LINE)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, radius)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float, radius: float = 12) -> None:
    with Image.open(path) as im:
        iw, ih = im.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    box(c, x, y, w, h, white, radius, LINE)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, radius)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def chip(c: canvas.Canvas, text: str, x: float, y: float, fill, color=INK, w: float | None = None) -> float:
    c.setFont("SCArial-Bold", 7.6)
    width = w or c.stringWidth(text, "SCArial-Bold", 7.6) + 18
    box(c, x, y, width, 19, fill, 9)
    c.setFillColor(color)
    c.drawCentredString(x + width / 2, y + 6.3, text)
    return width


def footer(c: canvas.Canvas, number: int) -> None:
    c.setStrokeColor(LINE)
    c.line(M, 30, PAGE_W - M, 30)
    c.setFont("SCArial", 7.4)
    c.setFillColor(MUTED)
    c.drawString(M, 17, "ScamCheck | HVT.ShieldSpark | NextGen Innovator 2026")
    c.drawRightString(PAGE_W - M, 17, f"{number} / 9")


def header(c: canvas.Canvas, section: str, title: str, kicker: str, number: int) -> float:
    box(c, M, PAGE_H - 67, 38, 25, BLUE, 8)
    c.setFillColor(white)
    c.setFont("SCArial-Bold", 9.5)
    c.drawCentredString(M + 19, PAGE_H - 59.5, section)
    para(c, f"<b>{escape(title)}</b>", M + 50, PAGE_H - 44, CONTENT_W - 50, 19.5, 22, NAVY)
    c.setFillColor(MUTED)
    c.setFont("SCArial", 8.7)
    c.drawString(M + 50, PAGE_H - 75, kicker)
    footer(c, number)
    return PAGE_H - 101


def bullets(c: canvas.Canvas, items: list[str], x: float, y_top: float, width: float,
            size: float = 9.3, color=INK, bullet_color=BLUE, gap: float = 5) -> float:
    y = y_top
    for item in items:
        c.setFillColor(bullet_color)
        c.circle(x + 4, y - 6, 2.0, fill=1, stroke=0)
        y = para(c, escape(item), x + 14, y, width - 14, size, size * 1.34, color)
        y -= gap
    return y


def card(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, text: str, accent, fill=white) -> None:
    box(c, x, y, w, h, fill, 13, LINE)
    box(c, x + 15, y + h - 29, 6, 18, accent, 3)
    para(c, f"<b>{escape(title)}</b>", x + 31, y + h - 14, w - 46, 10, 12, INK)
    para(c, escape(text), x + 16, y + h - 43, w - 32, 8.4, 11.1, MUTED)


def cover(c: canvas.Canvas, t: dict) -> None:
    c.setFillColor(PALE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 173, PAGE_W, 173, fill=1, stroke=0)
    image_contain(c, ASSETS["logo"], M, PAGE_H - 105, 49, 49, 10)
    c.setFillColor(white)
    c.setFont("SCArial-Bold", 22)
    c.drawString(M + 62, PAGE_H - 79, "ScamCheck")
    c.setFont("SCArial", 8.2)
    c.setFillColor(HexColor("#BED5FF"))
    c.drawString(M + 63, PAGE_H - 95, t["cover_brand"])
    chip(c, t["cover_chip"], PAGE_W - M - 162, PAGE_H - 94, HexColor("#163A75"), HexColor("#DCE9FF"), 162)

    y = PAGE_H - 210
    para(c, f"<b>{escape(t['cover_title'])}</b>", M, y, CONTENT_W, 26, 30, NAVY)
    y -= 48
    para(c, escape(t["cover_subtitle"]), M, y, CONTENT_W * 0.79, 11, 15, MUTED)
    y -= 58
    x = M
    for label, fill, color in t["cover_tags"]:
        x += chip(c, label, x, y, fill, color) + 7
    y -= 51
    box(c, M, y - 67, CONTENT_W, 59, white, 13, LINE)
    para(c, f"<b>{escape(t['cover_team_title'])}</b>", M + 17, y - 23, 175, 10.5, 12, NAVY)
    para(c, escape(t["cover_team"]), M + 17, y - 42, 185, 8.7, 11, MUTED)
    para(c, escape(t["cover_event"]), M + 236, y - 27, CONTENT_W - 253, 10.2, 13, INK)
    y -= 105
    left = CONTENT_W * 0.65
    image_cover(c, ASSETS["web"], M, y - 206, left, 206, 13)
    image_contain(c, ASSETS["popup"], M + left + 12, y - 206, CONTENT_W - left - 12, 206, 13)
    y -= 230
    box(c, M, y - 47, CONTENT_W, 39, CREAM, 12, HexColor("#F2D481"))
    para(c, escape(t["cover_note"]), M + 16, y - 23, CONTENT_W - 32, 8.5, 11.3, HexColor("#6C500B"))
    footer(c, 1)


def problem(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "01", t["problem_title"], t["problem_kicker"], 2)
    para(c, escape(t["problem_intro"]), M, y, CONTENT_W, 10.3, 14.3, INK)
    y -= 76
    w = (CONTENT_W - 18) / 3
    for i, values in enumerate(t["problem_cards"]):
        card(c, M + i * (w + 9), y - 119, w, 108, *values)
    y -= 157
    box(c, M, y - 140, CONTENT_W, 126, SKY, 14, HexColor("#BFD5FF"))
    para(c, f"<b>{escape(t['problem_goal_title'])}</b>", M + 20, y - 36, CONTENT_W - 40, 13, 16, NAVY)
    bullets(c, t["problem_goals"], M + 18, y - 60, CONTENT_W - 36, 9.4, INK, BLUE)
    y -= 180
    box(c, M, y - 75, CONTENT_W, 63, NAVY, 13)
    para(c, escape(t["problem_question"]), M + 20, y - 28, CONTENT_W - 40, 10, 13.5, white)
    para(c, escape(t["problem_question_caption"]), M + 20, y - 51, CONTENT_W - 40, 8.2, 10.5, HexColor("#C9DCFF"))


def solution(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "02", t["solution_title"], t["solution_kicker"], 3)
    image_contain(c, ASSETS["web"], M, y - 249, CONTENT_W, 233)
    y -= 274
    para(c, escape(t["solution_intro"]), M, y, CONTENT_W, 10, 13.7, INK)
    y -= 63
    w = (CONTENT_W - 18) / 3
    for i, values in enumerate(t["solution_cards"]):
        card(c, M + i * (w + 9), y - 102, w, 91, *values)
    y -= 135
    box(c, M, y - 76, CONTENT_W, 63, MINT, 13, HexColor("#BEEBD0"))
    para(c, f"<b>{escape(t['solution_note_title'])}</b>", M + 19, y - 32, CONTENT_W - 38, 10.5, 13, HexColor("#125C33"))
    para(c, escape(t["solution_note"]), M + 19, y - 52, CONTENT_W - 38, 8.6, 11.5, HexColor("#226643"))


def mechanism(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "03", t["mechanism_title"], t["mechanism_kicker"], 4)
    para(c, escape(t["mechanism_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 82
    steps = t["mechanism_steps"]
    w = (CONTENT_W - 24) / 5
    for i, (title, text, color, fill) in enumerate(steps):
        x = M + i * (w + 6)
        box(c, x, y - 114, w, 102, fill, 13, LINE)
        chip(c, str(i + 1), x + 14, y - 37, color, white, 21)
        para(c, f"<b>{escape(title)}</b>", x + 14, y - 47, w - 28, 9.2, 11.4, INK)
        para(c, escape(text), x + 14, y - 70, w - 28, 7.5, 9.6, MUTED)
        if i < len(steps) - 1:
            c.setStrokeColor(BLUE)
            c.setLineWidth(1.2)
            c.line(x + w + 1, y - 64, x + w + 5, y - 64)
    y -= 153
    box(c, M, y - 148, CONTENT_W, 134, SKY, 14, HexColor("#BFD5FF"))
    para(c, f"<b>{escape(t['mechanism_safety_title'])}</b>", M + 20, y - 37, CONTENT_W - 40, 12.2, 15, NAVY)
    bullets(c, t["mechanism_safety"], M + 18, y - 62, CONTENT_W - 36, 9.1, INK, BLUE)
    y -= 192
    box(c, M, y - 63, CONTENT_W, 50, CREAM, 12, HexColor("#F1D581"))
    para(c, escape(t["mechanism_boundary"]), M + 17, y - 25, CONTENT_W - 34, 8.8, 11.5, HexColor("#6C500B"))


def extension(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "04", t["extension_title"], t["extension_kicker"], 5)
    left = CONTENT_W * 0.64
    image_contain(c, ASSETS["extension"], M, y - 303, left, 287)
    image_contain(c, ASSETS["popup"], M + left + 12, y - 303, CONTENT_W - left - 12, 287)
    y -= 332
    para(c, escape(t["extension_intro"]), M, y, CONTENT_W, 10, 13.6, INK)
    y -= 63
    w = (CONTENT_W - 12) / 2
    for i, values in enumerate(t["extension_cards"]):
        card(c, M + i * (w + 12), y - 86, w, 75, *values)
    y -= 119
    box(c, M, y - 80, CONTENT_W, 67, MINT, 13, HexColor("#BFEBD1"))
    para(c, f"<b>{escape(t['extension_safety_title'])}</b>", M + 18, y - 31, CONTENT_W - 36, 10.5, 13, HexColor("#125C33"))
    para(c, escape(t["extension_safety"]), M + 18, y - 52, CONTENT_W - 36, 8.7, 11.5, HexColor("#226643"))


def feasibility(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "05", t["feasibility_title"], t["feasibility_kicker"], 6)
    para(c, escape(t["feasibility_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 72
    rows = t["feasibility_rows"]
    col1 = 144
    row_h = 52
    box(c, M, y - 29, CONTENT_W, 28, NAVY, 9)
    para(c, f"<b>{escape(t['feasibility_head_a'])}</b>", M + 13, y - 10, col1 - 18, 8.6, 10, white)
    para(c, f"<b>{escape(t['feasibility_head_b'])}</b>", M + col1 + 12, y - 10, CONTENT_W - col1 - 24, 8.6, 10, white)
    y -= 29
    for i, (a, b) in enumerate(rows):
        fill = white if i % 2 == 0 else PALE
        box(c, M, y - row_h, CONTENT_W, row_h, fill, 0, LINE)
        para(c, f"<b>{escape(a)}</b>", M + 13, y - 16, col1 - 20, 8.7, 10.8, NAVY)
        para(c, escape(b), M + col1 + 12, y - 14, CONTENT_W - col1 - 24, 8.5, 10.8, MUTED)
        y -= row_h
    y -= 30
    w = (CONTENT_W - 18) / 3
    for i, values in enumerate(t["feasibility_cards"]):
        card(c, M + i * (w + 9), y - 109, w, 98, *values)


def impact(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "06", t["impact_title"], t["impact_kicker"], 7)
    para(c, escape(t["impact_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 73
    w = (CONTENT_W - 18) / 3
    for i, values in enumerate(t["impact_cards"]):
        card(c, M + i * (w + 9), y - 132, w, 121, *values)
    y -= 172
    box(c, M, y - 139, CONTENT_W, 125, SKY, 14, HexColor("#BFD5FF"))
    para(c, f"<b>{escape(t['impact_measure_title'])}</b>", M + 20, y - 37, CONTENT_W - 40, 12.2, 15, NAVY)
    bullets(c, t["impact_measures"], M + 18, y - 61, CONTENT_W - 36, 9.2, INK, BLUE)
    y -= 181
    box(c, M, y - 58, CONTENT_W, 45, NAVY, 13)
    para(c, escape(t["impact_closing"]), M + 18, y - 28, CONTENT_W - 36, 9.3, 12, white, False, TA_CENTER)


def plan(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "07", t["plan_title"], t["plan_kicker"], 8)
    para(c, escape(t["plan_intro"]), M, y, CONTENT_W, 10.2, 14, INK)
    y -= 80
    phase_h = 83
    for i, (label, title, text, color, fill) in enumerate(t["plan_phases"]):
        box(c, M, y - phase_h, CONTENT_W, phase_h, fill, 13, LINE)
        chip(c, label, M + 17, y - 32, color, white, 58)
        para(c, f"<b>{escape(title)}</b>", M + 88, y - 20, CONTENT_W - 105, 10.4, 12.8, INK)
        para(c, escape(text), M + 88, y - 43, CONTENT_W - 105, 8.8, 11.4, MUTED)
        y -= phase_h + 11
    box(c, M, y - 93, CONTENT_W, 80, CREAM, 13, HexColor("#F1D581"))
    para(c, f"<b>{escape(t['plan_demo_title'])}</b>", M + 19, y - 34, CONTENT_W - 38, 11, 13.5, HexColor("#704C00"))
    para(c, escape(t["plan_demo"]), M + 19, y - 56, CONTENT_W - 38, 8.8, 11.4, HexColor("#704C00"))


def closing(c: canvas.Canvas, t: dict) -> None:
    y = header(c, "08", t["closing_title"], t["closing_kicker"], 9)
    box(c, M, y - 132, CONTENT_W, 118, NAVY, 15)
    para(c, f"<b>{escape(t['closing_demo_title'])}</b>", M + 22, y - 37, CONTENT_W - 44, 14, 17, white)
    para(c, escape(t["closing_demo"]), M + 22, y - 65, CONTENT_W - 44, 9.5, 12.8, HexColor("#D3E2FF"))
    para(c, escape(t["closing_url"]), M + 22, y - 94, CONTENT_W - 44, 8.6, 11, HexColor("#BBD4FF"))
    y -= 171
    w = (CONTENT_W - 18) / 3
    for i, values in enumerate(t["closing_cards"]):
        card(c, M + i * (w + 9), y - 112, w, 101, *values)
    y -= 151
    box(c, M, y - 115, CONTENT_W, 102, ROSE, 14, HexColor("#FFD0D6"))
    para(c, f"<b>{escape(t['closing_limits_title'])}</b>", M + 20, y - 37, CONTENT_W - 40, 11.5, 14, HexColor("#8D1D2B"))
    bullets(c, t["closing_limits"], M + 18, y - 60, CONTENT_W - 36, 9.0, HexColor("#7C2530"), RED)
    y -= 152
    para(c, escape(t["closing_team"]), M, y - 17, CONTENT_W, 9.4, 12, MUTED, False, TA_CENTER)


EN = {
    "cover_brand": "SAFER DIGITAL DECISIONS", "cover_chip": "NEXTGEN INNOVATOR 2026",
    "cover_title": "ScamCheck - project reference", "cover_subtitle": "A bilingual web application and Chrome extension that help people pause, recognise scam signals and choose a safer verification path before acting.",
    "cover_tags": [("Web app", SKY, BLUE), ("Chrome extension", MINT, HexColor("#12623A")), ("Educational AI", CREAM, HexColor("#805900"))],
    "cover_team_title": "Student team", "cover_team": "HVT.ShieldSpark\nHoang Van Thu High School for the Gifted", "cover_event": "NextGen Innovator 2026\nRound 1 project reference", "cover_note": "ScamCheck is an educational product. Its assessment does not replace official warnings from banks, telecommunications providers or competent authorities.",
    "problem_title": "Problem and current context", "problem_kicker": "Scams exploit speed, authority and uncertainty", "problem_intro": "Scam messages now appear across SMS, email, social media, chats and websites. They often combine copied branding, urgent deadlines, suspicious links and requests for money, credentials or personal information - leaving users to make a high-stakes decision in seconds.",
    "problem_cards": [("Rapidly changing tactics", "Wording and channels evolve quickly, so a single fixed keyword list is not enough.", RED, ROSE), ("Psychological pressure", "Impersonation, fear and unrealistic rewards can push people to act before verifying.", GOLD, CREAM), ("Digital confidence gap", "Students and families may not know which official channel is safe for confirmation.", BLUE, SKY)],
    "problem_goal_title": "What the product must do", "problem_goals": ["Turn a vague feeling of risk into understandable, evidence-based warning signs.", "Offer a safer next step without opening submitted links or asking users to act immediately.", "Build practical digital-safety habits for students, families and school communities."], "problem_question": "Design question: How can an AI tool encourage a calm, safer decision without presenting itself as an official authority?", "problem_question_caption": "ScamCheck focuses on explanation, user control and official-channel verification.",
    "solution_title": "Proposed solution: ScamCheck web", "solution_kicker": "A calm decision-support experience before a risky click", "solution_intro": "ScamCheck lets users paste a suspicious message, use browser-supported voice entry, upload an image for local OCR or inspect QR data before opening a destination. The result presents a risk level, visible signals and safer actions in Vietnamese or English.",
    "solution_cards": [("Analyse", "Risk level, suspicious signals, link context and practical next steps.", BLUE, SKY), ("Learn", "Reference library, reporting guidance and scenario-based practice activities.", GREEN, MINT), ("Share safely", "A redacted result image can be shared without exposing personal details.", GOLD, CREAM)], "solution_note_title": "Safety-first product principle", "solution_note": "The product is designed to explain warning signs and guide verification. It does not automatically open the links that users submit for review.",
    "mechanism_title": "How ScamCheck works", "mechanism_kicker": "Structured AI analysis with safety and privacy boundaries", "mechanism_intro": "The user controls the input. The backend keeps API keys server-side, retrieves relevant ScamCheck reference patterns, sends a structured prompt to OpenAI, and returns a structured result for the interface.",
    "mechanism_steps": [("Input", "Paste text, select page text, local OCR or QR data.", BLUE, SKY), ("Protect", "Limit length; exclude password and form fields.", GREEN, MINT), ("Retrieve", "Match useful ScamCheck reference patterns.", GOLD, CREAM), ("Analyse", "OpenAI returns a structured risk assessment.", RED, ROSE), ("Guide", "Show signals and safer next steps in the UI.", BLUE, SKY)],
    "mechanism_safety_title": "Safety and privacy safeguards", "mechanism_safety": ["The OpenAI key remains in the Vercel server environment, not in the web page or extension package.", "Auto Guard is opt-in and sends only a bounded visible-text snapshot, excluding passwords and form values.", "The extension never automatically opens a submitted link; the result is guidance, not a certainty or official warning."], "mechanism_boundary": "Responsible-AI boundary: an assessment can be incomplete or wrong. For high-impact situations, users should pause and verify using an official app, website or hotline.",
    "extension_title": "ScamCheck Chrome extension", "extension_kicker": "Support that appears where the user is browsing", "extension_intro": "The extension brings ScamCheck into the current page. It supports deliberate checks of selected text or page images, and an opt-in Auto Guard that can examine a bounded snapshot of visible page text for strong risk patterns.",
    "extension_cards": [("Active scan", "Read selected text, paste a message, or capture an on-page image for local OCR.", BLUE, SKY), ("Optional Auto Guard", "When strong signals appear, show an on-page overlay with an explanation and safer guidance.", GREEN, MINT)], "extension_safety_title": "Designed for user control", "extension_safety": "Users can turn Auto Guard on or off, dismiss an alert or disable alerts for a specific website. Gmail prioritises the opened message body rather than navigation text.",
    "feasibility_title": "Feasibility and scalability", "feasibility_kicker": "A working prototype with a clear technical path", "feasibility_intro": "ScamCheck is built as a practical MVP: the web app and extension use the same server analysis endpoint and the same safety principles, making the experience easier to evaluate and improve over time.", "feasibility_head_a": "Component", "feasibility_head_b": "Current implementation and growth path",
    "feasibility_rows": [("Web interface", "Responsive HTML, CSS and JavaScript with Vietnamese/English mode, accessible controls and input choices."), ("AI backend", "Vercel serverless endpoint keeps the API key private and returns structured analysis for the web and extension."), ("Reference layer", "ScamCheck scam-pattern library is selected by category and added as context before analysis."), ("Chrome extension", "Manifest V3 extension supports active scans, local OCR flow and optional Auto Guard on compatible pages."), ("Evaluation", "Labelled test cases, feedback and source review can track language quality, false positives and false negatives.")],
    "feasibility_cards": [("Shared core", "One analysis API and reference layer reduce duplicated logic across the web and extension.", BLUE, SKY), ("Safe expansion", "New scam patterns can be added to the reference library and evaluated before wider use.", GREEN, MINT), ("Measurable quality", "A test set and feedback loop make model behaviour visible and improvable.", GOLD, CREAM)],
    "impact_title": "Impact and relevance", "impact_kicker": "Digital resilience through understandable AI", "impact_intro": "ScamCheck is intended as both a personal safety companion and a learning tool. It connects AI, entrepreneurship and citizenship by helping users examine persuasion, evidence and safer options before reacting.",
    "impact_cards": [("Students", "Practise identifying urgency, impersonation and suspicious links before responding.", BLUE, SKY), ("Families", "Create a simple shared language for discussing suspicious messages and choosing safe verification.", GREEN, MINT), ("Schools", "Support digital-citizenship lessons, scenario practice and evidence-based discussion.", GOLD, CREAM)],
    "impact_measure_title": "What success looks like", "impact_measures": ["Users pause before following a high-pressure request.", "Warnings explain why a message may be risky rather than only attaching a label.", "Users know to verify through an official application, website or hotline.", "Feedback and labelled examples continuously improve clarity, inclusion and reliability."], "impact_closing": "The goal is not to make people fear technology. It is to make safer digital decisions easier.",
    "plan_title": "Implementation plan", "plan_kicker": "From prototype validation to an evidence-backed demonstration", "plan_intro": "The project can be developed through short, testable cycles: improve the product, evaluate real scenarios, document results and prepare a clear live demonstration.",
    "plan_phases": [("P1", "Consolidate the core", "Maintain the web workflow, analysis endpoint, reference patterns and bilingual experience.", BLUE, SKY), ("P2", "Strengthen the extension", "Test active scans and Auto Guard on compatible sites; protect inputs and improve error handling.", GREEN, MINT), ("P3", "Evaluate responsibly", "Use labelled scam and safe examples to inspect explanation quality, false positives and false negatives.", GOLD, CREAM), ("P4", "Prepare the demonstration", "Polish the mobile web experience, capture evidence, practise the story and present product boundaries clearly.", RED, ROSE)],
    "plan_demo_title": "Suggested live-demo sequence", "plan_demo": "Show a suspicious message in the web app, explain the risk result, then demonstrate the extension's active scan or opt-in Auto Guard on a compatible page. Close with the official-channel verification reminder.",
    "closing_title": "Demo, access and responsible use", "closing_kicker": "A clear handoff for judges, users and future evaluators", "closing_demo_title": "Try ScamCheck", "closing_demo": "Website access, product walkthrough and practical scenario checks are available through the project web app. The extension provides the same safety-first support while browsing on compatible pages.", "closing_url": "Web: https://scamcheck-c3chuyenhvt.vercel.app | Chrome Web Store: ScamCheck - Quet tin nhan",
    "closing_cards": [("Demo evidence", "Use real product screenshots, scenario examples and the live web app.", BLUE, SKY), ("Source review", "Maintain links and dates for library references, hotlines and public guidance.", GREEN, MINT), ("Feedback", "Collect privacy-respecting feedback to improve explanations and accessibility.", GOLD, CREAM)],
    "closing_limits_title": "Important limits", "closing_limits": ["ScamCheck does not verify a sender's identity, a bank, a public authority or ownership of a website.", "It does not replace official warnings from banks, law enforcement, telecoms providers or competent authorities.", "Users should not transfer money, reveal OTP codes or provide passwords because of an AI result."], "closing_team": "Prepared by HVT.ShieldSpark | Hoang Van Thu High School for the Gifted",
}

VI = {
    "cover_brand": "AN TOAN KHONG GIAN SO", "cover_chip": "NEXTGEN INNOVATOR 2026",
    "cover_title": "ScamCheck - ho so du an", "cover_subtitle": "Website va tien ich Chrome song ngu giup nguoi dung dung lai, nhan ra dau hieu lua dao va chon cach xac minh an toan hon truoc khi thao tac.",
    "cover_tags": [("Ung dung web", SKY, BLUE), ("Tien ich Chrome", MINT, HexColor("#12623A")), ("AI giao duc", CREAM, HexColor("#805900"))],
    "cover_team_title": "Nhom hoc sinh", "cover_team": "HVT.ShieldSpark\nTruong THPT Chuyen Hoang Van Thu", "cover_event": "NextGen Innovator 2026\nHo so tham khao Vong 1", "cover_note": "ScamCheck la cong cu giao duc. Danh gia cua ung dung khong thay the canh bao chinh thuc tu ngan hang, nha mang hoac co quan chuc nang.",
    "problem_title": "Van de va hien trang", "problem_kicker": "Lua dao khai thac su khan cap, uy quyen va bat an", "problem_intro": "Tin nhan lua dao xuat hien tren SMS, email, mang xa hoi, chat va website. Chung thuong ket hop thuong hieu bi gia mao, han chot khan cap, duong link dang ngo va yeu cau ve tien, tai khoan hoac thong tin ca nhan - trong khi nguoi dung phai dua ra quyet dinh quan trong chi trong vai giay.",
    "problem_cards": [("Thu doan thay doi nhanh", "Cach dien dat va kenh lua dao thay doi lien tuc, khong the chi dua vao mot danh sach tu khoa co dinh.", RED, ROSE), ("Ap luc tam ly", "Gia mao, de doa va loi hua tien thuong lon co the day nguoi dung hanh dong truoc khi kiem tra.", GOLD, CREAM), ("Chenh lech ky nang so", "Hoc sinh va gia dinh co the chua biet kenh chinh thuc nao an toan de xac minh.", BLUE, SKY)],
    "problem_goal_title": "San pham can lam duoc gi", "problem_goals": ["Bien cam giac lo lang mo ho thanh cac dau hieu canh bao de hieu va co co so.", "Dua ra buoc xu ly an toan hon ma khong tu mo link da duoc gui vao hoac ep nguoi dung hanh dong ngay.", "Hinh thanh thoi quen an toan so thuc te cho hoc sinh, gia dinh va nha truong."], "problem_question": "Cau hoi thiet ke: Lam the nao de AI khuyen khich nguoi dung dua ra quyet dinh binh tinh, an toan ma khong tu nhan la mot co quan chinh thuc?", "problem_question_caption": "ScamCheck tap trung vao giai thich, quyen kiem soat cua nguoi dung va xac minh qua kenh chinh thuc.",
    "solution_title": "Giai phap de xuat: web ScamCheck", "solution_kicker": "Ho tro ra quyet dinh binh tinh truoc khi bam vao lien ket rui ro", "solution_intro": "ScamCheck cho phep dan tin nhan dang ngo, dung nhap giong noi neu trinh duyet ho tro, tai anh de OCR cuc bo hoac kiem tra du lieu QR truoc khi mo dich den. Ket qua hien thi muc do rui ro, dau hieu va hanh dong an toan bang tieng Viet hoac tieng Anh.",
    "solution_cards": [("Phan tich", "Muc do rui ro, dau hieu dang ngo, ngu canh link va buoc tiep theo thuc te.", BLUE, SKY), ("Hoc tap", "Thu vien mau, huong dan bao cao va bai tap tinh huong.", GREEN, MINT), ("Chia se an toan", "Tao anh ket qua da che thong tin nhay cam de chia se an toan hon.", GOLD, CREAM)], "solution_note_title": "Nguyen tac uu tien an toan", "solution_note": "San pham duoc thiet ke de giai thich dau hieu va huong dan xac minh. ScamCheck khong tu dong mo cac lien ket ma nguoi dung gui vao de kiem tra.",
    "mechanism_title": "Co che hoat dong", "mechanism_kicker": "Phan tich AI co cau truc voi ranh gioi an toan va rieng tu", "mechanism_intro": "Nguoi dung kiem soat noi dung dau vao. Backend giu khoa API o phia server, truy xuat mau tham chieu ScamCheck phu hop, gui prompt co cau truc toi OpenAI va tra ve ket qua co cau truc cho giao dien.",
    "mechanism_steps": [("Nhap", "Dan chu, boi den chu tren trang, OCR cuc bo hoac du lieu QR.", BLUE, SKY), ("Bao ve", "Gioi han do dai; loai tru mat khau va truong bieu mau.", GREEN, MINT), ("Tham chieu", "Doi chieu mau ScamCheck can thiet.", GOLD, CREAM), ("Phan tich", "OpenAI tra ve danh gia rui ro co cau truc.", RED, ROSE), ("Huong dan", "Hien dau hieu va viec nen lam tren giao dien.", BLUE, SKY)],
    "mechanism_safety_title": "Cac lop bao ve an toan va rieng tu", "mechanism_safety": ["Khoa OpenAI nam trong moi truong Vercel cua server, khong nam trong trang web hay goi extension.", "Auto Guard la tuy chon va chi gui ban chup chu dang hien thi co gioi han; khong doc mat khau hay gia tri form.", "Extension khong tu dong mo lien ket. Ket qua la huong dan, khong phai ket luan chac chan hay canh bao chinh thuc."], "mechanism_boundary": "Ranh gioi AI co trach nhiem: danh gia co the thieu hoac sai. Neu tinh huong co hau qua lon, nguoi dung can dung lai va xac minh bang ung dung, website hoac hotline chinh thuc.",
    "extension_title": "Tien ich Chrome ScamCheck", "extension_kicker": "Ho tro ngay tai trang ma nguoi dung dang luot", "extension_intro": "Extension dua ScamCheck vao ngay trang dang mo. Nguoi dung co the chu dong quet phan chu boi den hoac anh tren trang, va co the bat Auto Guard tu nguyen de kiem tra mot ban chup chu dang hien thi co gioi han khi co dau hieu rui ro ro rang.",
    "extension_cards": [("Quet chu dong", "Doc phan chu da boi den, dan tin nhan hoac chup anh tren trang de OCR cuc bo.", BLUE, SKY), ("Auto Guard tuy chon", "Khi phat hien dau hieu manh, hien overlay giai thich nguy co va huong dan an toan.", GREEN, MINT)], "extension_safety_title": "Thiet ke de nguoi dung luon kiem soat", "extension_safety": "Nguoi dung co the bat/tat Auto Guard, dong canh bao hoac tat canh bao tren mot website. Tren Gmail, extension uu tien phan than email dang mo thay vi chu dieu huong.",
    "feasibility_title": "Tinh kha thi va kha nang mo rong", "feasibility_kicker": "MVP da hoat dong voi huong phat trien ky thuat ro rang", "feasibility_intro": "ScamCheck duoc xay dung nhu mot MVP thuc te: website va extension dung chung endpoint phan tich cua server va chung nguyen tac an toan, giup trai nghiem de danh gia va cai tien theo thoi gian.", "feasibility_head_a": "Thanh phan", "feasibility_head_b": "Hien trang va huong phat trien",
    "feasibility_rows": [("Giao dien web", "HTML, CSS va JavaScript responsive; co che do Viet/Anh, dieu khien de tiep can va nhieu cach nhap."), ("Backend AI", "Endpoint serverless tren Vercel giu khoa API rieng tu va tra ket qua co cau truc cho web va extension."), ("Lop tham chieu", "Thu vien mau lua dao ScamCheck duoc chon theo danh muc va chen vao ngu canh truoc khi phan tich."), ("Tien ich Chrome", "Extension Manifest V3 co quet chu dong, luong OCR cuc bo va Auto Guard tuy chon tren trang tuong thich."), ("Danh gia", "Bo test gan nhan, phan hoi va ra soat nguon giup theo doi chat luong ngon ngu, false positive va false negative.")],
    "feasibility_cards": [("Loi dung chung", "Mot API phan tich va lop tham chieu dung chung giam logic trung lap giua web va extension.", BLUE, SKY), ("Mo rong an toan", "Mau lua dao moi co the them vao thu vien va danh gia truoc khi dung rong rai.", GREEN, MINT), ("Chat luong do duoc", "Bo test va vong lap phan hoi giup hanh vi cua mo hinh ro rang va co the cai tien.", GOLD, CREAM)],
    "impact_title": "Tac dong va tinh phu hop", "impact_kicker": "Nang luc tu ve so qua AI de hieu va co trach nhiem", "impact_intro": "ScamCheck vua la cong cu dong hanh an toan ca nhan, vua la cong cu hoc tap. Du an ket noi AI, khoi nghiep va cong dan so bang cach giup nguoi dung xem xet su thuyet phuc, bang chung va lua chon an toan hon truoc khi phan ung.",
    "impact_cards": [("Hoc sinh", "Luyen nhan ra su khan cap, gia mao va lien ket dang ngo truoc khi tra loi.", BLUE, SKY), ("Gia dinh", "Tao ngon ngu chung de cung trao doi ve tin nhan dang lo va cach xac minh an toan.", GREEN, MINT), ("Nha truong", "Ho tro giao duc cong dan so, bai tap tinh huong va thao luan dua tren bang chung.", GOLD, CREAM)],
    "impact_measure_title": "Thanh cong mong muon", "impact_measures": ["Nguoi dung dung lai truoc khi lam theo yeu cau co ap luc cao.", "Canh bao giai thich vi sao dang ngo thay vi chi gan nhan nguy hiem.", "Nguoi dung biet xac minh qua ung dung, website hoac hotline chinh thuc.", "Phan hoi va mau co gan nhan lien tuc cai thien su ro rang, tinh bao trum va do tin cay."], "impact_closing": "Muc tieu khong phai la lam moi nguoi so cong nghe. Muc tieu la de ra quyet dinh so an toan hon de dang hon.",
    "plan_title": "Ke hoach trien khai", "plan_kicker": "Tu xac thuc MVP den trinh bay co bang chung", "plan_intro": "Du an co the phat trien qua cac chu ky ngan, de kiem thu: cai tien san pham, danh gia tinh huong thuc te, ghi nhan ket qua va chuan bi mot phan demo mach lac.",
    "plan_phases": [("P1", "Cung co loi", "Duy tri luong web, endpoint phan tich, mau tham chieu va trai nghiem song ngu.", BLUE, SKY), ("P2", "Tang cuong extension", "Kiem thu quet chu dong va Auto Guard tren trang tuong thich; bao ve dau vao va cai tien xu ly loi.", GREEN, MINT), ("P3", "Danh gia co trach nhiem", "Dung mau lua dao va an toan co gan nhan de kiem tra chat luong giai thich, false positive va false negative.", GOLD, CREAM), ("P4", "Chuan bi demo", "Hoan thien trai nghiem mobile, chup bang chung, luyen cau chuyen san pham va trinh bay ro ranh gioi cua AI.", RED, ROSE)],
    "plan_demo_title": "Trinh tu demo goi y", "plan_demo": "Cho mot tin nhan dang ngo tren website, giai thich ket qua phan tich, sau do demo quet chu dong hoac Auto Guard cua extension tren trang tuong thich. Ket thuc bang loi nhac xac minh qua kenh chinh thuc.",
    "closing_title": "Demo, truy cap va su dung co trach nhiem", "closing_kicker": "Ban giao ro rang cho ban giam khao, nguoi dung va nguoi danh gia", "closing_demo_title": "Thu ScamCheck", "closing_demo": "Website, huong dan su dung va cac tinh huong kiem tra thuc te co the truy cap qua ung dung web cua du an. Extension mang cung cach ho tro uu tien an toan trong luc luot web tren cac trang tuong thich.", "closing_url": "Web: https://scamcheck-c3chuyenhvt.vercel.app | Chrome Web Store: ScamCheck - Quet tin nhan",
    "closing_cards": [("Bang chung demo", "Dung screenshot san pham that, tinh huong mau va website dang hoat dong.", BLUE, SKY), ("Ra soat nguon", "Duy tri link va ngay kiem tra cho thu vien mau, hotline va huong dan cong khai.", GREEN, MINT), ("Phan hoi", "Thu thap phan hoi ton trong rieng tu de cai tien giai thich va kha nang tiep can.", GOLD, CREAM)],
    "closing_limits_title": "Gioi han quan trong", "closing_limits": ["ScamCheck khong xac minh danh tinh nguoi gui, ngan hang, co quan hay chu so huu website.", "Ung dung khong thay the canh bao chinh thuc tu ngan hang, co quan cong an, nha mang hay co quan chuc nang.", "Nguoi dung khong nen chuyen tien, cung cap OTP hay mat khau chi vi ket qua cua AI."], "closing_team": "Thuc hien boi HVT.ShieldSpark | Truong THPT Chuyen Hoang Van Thu",
}

# Publication copy for the Vietnamese edition. The draft above mirrors the
# English data structure; this override ensures the delivered Vietnamese PDF
# is written naturally, with full Vietnamese diacritics throughout.
VI.update({
    "cover_brand": "AN TOÀN KHÔNG GIAN SỐ",
    "cover_title": "ScamCheck - hồ sơ dự án",
    "cover_subtitle": "Website và tiện ích Chrome song ngữ giúp người dùng dừng lại, nhận ra dấu hiệu lừa đảo và chọn cách xác minh an toàn hơn trước khi thao tác.",
    "cover_tags": [("Ứng dụng web", SKY, BLUE), ("Tiện ích Chrome", MINT, HexColor("#12623A")), ("AI giáo dục", CREAM, HexColor("#805900"))],
    "cover_team_title": "Nhóm học sinh",
    "cover_team": "HVT.ShieldSpark\nTrường THPT Chuyên Hoàng Văn Thụ",
    "cover_event": "NextGen Innovator 2026\nHồ sơ tham khảo Vòng 1",
    "cover_note": "ScamCheck là công cụ giáo dục. Đánh giá của ứng dụng không thay thế cảnh báo chính thức từ ngân hàng, nhà mạng hoặc cơ quan chức năng.",
    "problem_title": "Vấn đề và hiện trạng",
    "problem_kicker": "Lừa đảo khai thác sự khẩn cấp, uy quyền và bất an",
    "problem_intro": "Tin nhắn lừa đảo xuất hiện trên SMS, email, mạng xã hội, chat và website. Chúng thường kết hợp thương hiệu bị giả mạo, hạn chót khẩn cấp, đường link đáng ngờ và yêu cầu về tiền, tài khoản hoặc thông tin cá nhân - trong khi người dùng phải đưa ra quyết định quan trọng chỉ trong vài giây.",
    "problem_cards": [
        ("Thủ đoạn thay đổi nhanh", "Cách diễn đạt và kênh lừa đảo thay đổi liên tục, không thể chỉ dựa vào một danh sách từ khóa cố định.", RED, ROSE),
        ("Áp lực tâm lý", "Giả mạo, đe dọa và lời hứa tiền thưởng lớn có thể đẩy người dùng hành động trước khi kiểm tra.", GOLD, CREAM),
        ("Chênh lệch kỹ năng số", "Học sinh và gia đình có thể chưa biết kênh chính thức nào an toàn để xác minh.", BLUE, SKY),
    ],
    "problem_goal_title": "Sản phẩm cần làm được gì",
    "problem_goals": [
        "Biến cảm giác lo lắng mơ hồ thành các dấu hiệu cảnh báo dễ hiểu và có cơ sở.",
        "Đưa ra bước xử lý an toàn hơn mà không tự mở link đã được gửi vào hoặc ép người dùng hành động ngay.",
        "Hình thành thói quen an toàn số thực tế cho học sinh, gia đình và nhà trường.",
    ],
    "problem_question": "Câu hỏi thiết kế: Làm thế nào để AI khuyến khích người dùng đưa ra quyết định bình tĩnh, an toàn mà không tự nhận là một cơ quan chính thức?",
    "problem_question_caption": "ScamCheck tập trung vào giải thích, quyền kiểm soát của người dùng và xác minh qua kênh chính thức.",
    "solution_title": "Giải pháp đề xuất: web ScamCheck",
    "solution_kicker": "Hỗ trợ ra quyết định bình tĩnh trước khi bấm vào liên kết rủi ro",
    "solution_intro": "ScamCheck cho phép dán tin nhắn đáng ngờ, dùng nhập giọng nói nếu trình duyệt hỗ trợ, tải ảnh để OCR cục bộ hoặc kiểm tra dữ liệu QR trước khi mở đích đến. Kết quả hiển thị mức độ rủi ro, dấu hiệu và hành động an toàn bằng tiếng Việt hoặc tiếng Anh.",
    "solution_cards": [
        ("Phân tích", "Mức độ rủi ro, dấu hiệu đáng ngờ, ngữ cảnh link và bước tiếp theo thực tế.", BLUE, SKY),
        ("Học tập", "Thư viện mẫu, hướng dẫn báo cáo và bài tập tình huống.", GREEN, MINT),
        ("Chia sẻ an toàn", "Tạo ảnh kết quả đã che thông tin nhạy cảm để chia sẻ an toàn hơn.", GOLD, CREAM),
    ],
    "solution_note_title": "Nguyên tắc ưu tiên an toàn",
    "solution_note": "Sản phẩm được thiết kế để giải thích dấu hiệu và hướng dẫn xác minh. ScamCheck không tự động mở các liên kết mà người dùng gửi vào để kiểm tra.",
    "mechanism_title": "Cơ chế hoạt động",
    "mechanism_kicker": "Phân tích AI có cấu trúc với ranh giới an toàn và riêng tư",
    "mechanism_intro": "Người dùng kiểm soát nội dung đầu vào. Backend giữ khóa API ở phía server, truy xuất mẫu tham chiếu ScamCheck phù hợp, gửi prompt có cấu trúc tới OpenAI và trả về kết quả có cấu trúc cho giao diện.",
    "mechanism_steps": [
        ("Nhập", "Dán chữ, bôi đen chữ trên trang, OCR cục bộ hoặc dữ liệu QR.", BLUE, SKY),
        ("Bảo vệ", "Giới hạn độ dài; loại trừ mật khẩu và trường biểu mẫu.", GREEN, MINT),
        ("Tham chiếu", "Đối chiếu mẫu ScamCheck cần thiết.", GOLD, CREAM),
        ("Phân tích", "OpenAI trả về đánh giá rủi ro có cấu trúc.", RED, ROSE),
        ("Hướng dẫn", "Hiện dấu hiệu và việc nên làm trên giao diện.", BLUE, SKY),
    ],
    "mechanism_safety_title": "Các lớp bảo vệ an toàn và riêng tư",
    "mechanism_safety": [
        "Khóa OpenAI nằm trong môi trường Vercel của server, không nằm trong trang web hay gói extension.",
        "Auto Guard là tùy chọn và chỉ gửi bản chụp chữ đang hiển thị có giới hạn; không đọc mật khẩu hay giá trị form.",
        "Extension không tự động mở liên kết. Kết quả là hướng dẫn, không phải kết luận chắc chắn hay cảnh báo chính thức.",
    ],
    "mechanism_boundary": "Ranh giới AI có trách nhiệm: đánh giá có thể thiếu hoặc sai. Nếu tình huống có hậu quả lớn, người dùng cần dừng lại và xác minh bằng ứng dụng, website hoặc hotline chính thức.",
    "extension_title": "Tiện ích Chrome ScamCheck",
    "extension_kicker": "Hỗ trợ ngay tại trang mà người dùng đang lướt",
    "extension_intro": "Extension đưa ScamCheck vào ngay trang đang mở. Người dùng có thể chủ động quét phần chữ bôi đen hoặc ảnh trên trang, và có thể bật Auto Guard tự nguyện để kiểm tra một bản chụp chữ đang hiển thị có giới hạn khi có dấu hiệu rủi ro rõ ràng.",
    "extension_cards": [
        ("Quét chủ động", "Đọc phần chữ đã bôi đen, dán tin nhắn hoặc chụp ảnh trên trang để OCR cục bộ.", BLUE, SKY),
        ("Auto Guard tùy chọn", "Khi phát hiện dấu hiệu mạnh, hiện overlay giải thích nguy cơ và hướng dẫn an toàn.", GREEN, MINT),
    ],
    "extension_safety_title": "Thiết kế để người dùng luôn kiểm soát",
    "extension_safety": "Người dùng có thể bật/tắt Auto Guard, đóng cảnh báo hoặc tắt cảnh báo trên một website. Trên Gmail, extension ưu tiên phần thân email đang mở thay vì chữ điều hướng.",
    "feasibility_title": "Tính khả thi và khả năng mở rộng",
    "feasibility_kicker": "MVP đã hoạt động với hướng phát triển kỹ thuật rõ ràng",
    "feasibility_intro": "ScamCheck được xây dựng như một MVP thực tế: website và extension dùng chung endpoint phân tích của server và chung nguyên tắc an toàn, giúp trải nghiệm dễ đánh giá và cải tiến theo thời gian.",
    "feasibility_head_a": "Thành phần", "feasibility_head_b": "Hiện trạng và hướng phát triển",
    "feasibility_rows": [
        ("Giao diện web", "HTML, CSS và JavaScript responsive; có chế độ Việt/Anh, điều khiển dễ tiếp cận và nhiều cách nhập."),
        ("Backend AI", "Endpoint serverless trên Vercel giữ khóa API riêng tư và trả kết quả có cấu trúc cho web và extension."),
        ("Lớp tham chiếu", "Thư viện mẫu lừa đảo ScamCheck được chọn theo danh mục và chèn vào ngữ cảnh trước khi phân tích."),
        ("Tiện ích Chrome", "Extension Manifest V3 có quét chủ động, luồng OCR cục bộ và Auto Guard tùy chọn trên trang tương thích."),
        ("Đánh giá", "Bộ test gắn nhãn, phản hồi và rà soát nguồn giúp theo dõi chất lượng ngôn ngữ, false positive và false negative."),
    ],
    "feasibility_cards": [
        ("Lõi dùng chung", "Một API phân tích và lớp tham chiếu dùng chung giảm logic trùng lặp giữa web và extension.", BLUE, SKY),
        ("Mở rộng an toàn", "Mẫu lừa đảo mới có thể thêm vào thư viện và đánh giá trước khi dùng rộng rãi.", GREEN, MINT),
        ("Chất lượng đo được", "Bộ test và vòng lặp phản hồi giúp hành vi của mô hình rõ ràng và có thể cải tiến.", GOLD, CREAM),
    ],
    "impact_title": "Tác động và tính phù hợp",
    "impact_kicker": "Năng lực tự vệ số qua AI dễ hiểu và có trách nhiệm",
    "impact_intro": "ScamCheck vừa là công cụ đồng hành an toàn cá nhân, vừa là công cụ học tập. Dự án kết nối AI, khởi nghiệp và công dân số bằng cách giúp người dùng xem xét sự thuyết phục, bằng chứng và lựa chọn an toàn hơn trước khi phản ứng.",
    "impact_cards": [
        ("Học sinh", "Luyện nhận ra sự khẩn cấp, giả mạo và liên kết đáng ngờ trước khi trả lời.", BLUE, SKY),
        ("Gia đình", "Tạo ngôn ngữ chung để cùng trao đổi về tin nhắn đáng lo và cách xác minh an toàn.", GREEN, MINT),
        ("Nhà trường", "Hỗ trợ giáo dục công dân số, bài tập tình huống và thảo luận dựa trên bằng chứng.", GOLD, CREAM),
    ],
    "impact_measure_title": "Thành công mong muốn",
    "impact_measures": [
        "Người dùng dừng lại trước khi làm theo yêu cầu có áp lực cao.",
        "Cảnh báo giải thích vì sao đáng ngờ thay vì chỉ gắn nhãn nguy hiểm.",
        "Người dùng biết xác minh qua ứng dụng, website hoặc hotline chính thức.",
        "Phản hồi và mẫu có gắn nhãn liên tục cải thiện sự rõ ràng, tính bao trùm và độ tin cậy.",
    ],
    "impact_closing": "Mục tiêu không phải là làm mọi người sợ công nghệ. Mục tiêu là để ra quyết định số an toàn hơn dễ dàng hơn.",
    "plan_title": "Kế hoạch triển khai",
    "plan_kicker": "Từ xác thực MVP đến trình bày có bằng chứng",
    "plan_intro": "Dự án có thể phát triển qua các chu kỳ ngắn, dễ kiểm thử: cải tiến sản phẩm, đánh giá tình huống thực tế, ghi nhận kết quả và chuẩn bị một phần demo mạch lạc.",
    "plan_phases": [
        ("P1", "Củng cố lõi", "Duy trì luồng web, endpoint phân tích, mẫu tham chiếu và trải nghiệm song ngữ.", BLUE, SKY),
        ("P2", "Tăng cường extension", "Kiểm thử quét chủ động và Auto Guard trên trang tương thích; bảo vệ đầu vào và cải tiến xử lý lỗi.", GREEN, MINT),
        ("P3", "Đánh giá có trách nhiệm", "Dùng mẫu lừa đảo và an toàn có gắn nhãn để kiểm tra chất lượng giải thích, false positive và false negative.", GOLD, CREAM),
        ("P4", "Chuẩn bị demo", "Hoàn thiện trải nghiệm mobile, chụp bằng chứng, luyện câu chuyện sản phẩm và trình bày rõ ranh giới của AI.", RED, ROSE),
    ],
    "plan_demo_title": "Trình tự demo gợi ý",
    "plan_demo": "Cho một tin nhắn đáng ngờ trên website, giải thích kết quả phân tích, sau đó demo quét chủ động hoặc Auto Guard của extension trên trang tương thích. Kết thúc bằng lời nhắc xác minh qua kênh chính thức.",
    "closing_title": "Demo, truy cập và sử dụng có trách nhiệm",
    "closing_kicker": "Bàn giao rõ ràng cho ban giám khảo, người dùng và người đánh giá",
    "closing_demo_title": "Thử ScamCheck",
    "closing_demo": "Website, hướng dẫn sử dụng và các tình huống kiểm tra thực tế có thể truy cập qua ứng dụng web của dự án. Extension mang cùng cách hỗ trợ ưu tiên an toàn trong lúc lướt web trên các trang tương thích.",
    "closing_url": "Web: https://scamcheck-c3chuyenhvt.vercel.app | Chrome Web Store: ScamCheck - Quét tin nhắn",
    "closing_cards": [
        ("Bằng chứng demo", "Dùng screenshot sản phẩm thật, tình huống mẫu và website đang hoạt động.", BLUE, SKY),
        ("Rà soát nguồn", "Duy trì link và ngày kiểm tra cho thư viện mẫu, hotline và hướng dẫn công khai.", GREEN, MINT),
        ("Phản hồi", "Thu thập phản hồi tôn trọng riêng tư để cải tiến giải thích và khả năng tiếp cận.", GOLD, CREAM),
    ],
    "closing_limits_title": "Giới hạn quan trọng",
    "closing_limits": [
        "ScamCheck không xác minh danh tính người gửi, ngân hàng, cơ quan hay chủ sở hữu website.",
        "Ứng dụng không thay thế cảnh báo chính thức từ ngân hàng, cơ quan công an, nhà mạng hay cơ quan chức năng.",
        "Người dùng không nên chuyển tiền, cung cấp OTP hay mật khẩu chỉ vì kết quả của AI.",
    ],
    "closing_team": "Thực hiện bởi HVT.ShieldSpark | Trường THPT Chuyên Hoàng Văn Thụ",
})


def build(data: dict, output_name: str, title: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / output_name
    c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    c.setTitle(title)
    c.setAuthor("HVT.ShieldSpark")
    cover(c, data); c.showPage()
    problem(c, data); c.showPage()
    solution(c, data); c.showPage()
    mechanism(c, data); c.showPage()
    extension(c, data); c.showPage()
    feasibility(c, data); c.showPage()
    impact(c, data); c.showPage()
    plan(c, data); c.showPage()
    closing(c, data); c.showPage()
    c.save()
    return output


if __name__ == "__main__":
    register_fonts()
    for asset in ASSETS.values():
        if not asset.exists():
            raise FileNotFoundError(asset)
    print(build(VI, "ScamCheck_NextGen_Round1_Vietnamese_HVT_ShieldSpark.pdf", "ScamCheck - NextGen Innovator 2026 Ho so tieng Viet"))
    print(build(EN, "ScamCheck_NextGen_Round1_English_Revamped_HVT_ShieldSpark.pdf", "ScamCheck - NextGen Innovator 2026 English Project Reference"))
