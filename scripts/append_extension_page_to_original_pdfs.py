from __future__ import annotations

from html import escape
from pathlib import Path
import subprocess

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(r"D:\prototype")
DOWNLOADS = Path(r"C:\Users\leoha\Downloads")
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "tmp" / "pdfs" / "extension-append"
PAGE_W, PAGE_H = A4
M = 42
CONTENT_W = PAGE_W - 2 * M

NAVY = HexColor("#10275B")
BLUE = HexColor("#2463D7")
SKY = HexColor("#ECF3FF")
LINE = HexColor("#D9E5F8")
INK = HexColor("#17243A")
MUTED = HexColor("#5C6F8E")
GREEN = HexColor("#0EA560")
MINT = HexColor("#EAF9F0")
GOLD = HexColor("#E58A00")
CREAM = HexColor("#FFF6DF")

SCREEN_EXT = ROOT / "Screenshot (232).png"
SCREEN_POPUP = ROOT / "store-assets" / "scamcheck-extension-screenshot-1.png"
SOURCE_VI = DOWNLOADS / "ScamCheck_NextGen_Bilingual_HVT_ShieldSpark (1).pdf"
SOURCE_EN = DOWNLOADS / "ScamCheck_NextGen_Round1_English_HVT_ShieldSpark.pdf"
PDFTOPPM = Path(r"C:\Users\leoha\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")


def fonts() -> None:
    pdfmetrics.registerFont(TTFont("AppendArial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("AppendArial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


def box(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, radius: float = 8, stroke=None) -> None:
    c.saveState()
    c.setFillColor(fill)
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, radius, fill=1, stroke=0)
    c.restoreState()


def para(c: canvas.Canvas, text: str, x: float, y_top: float, w: float, size: float = 9,
         color=INK, bold: bool = False, leading: float | None = None) -> float:
    style = ParagraphStyle(
        name="append-copy",
        fontName="AppendArial-Bold" if bold else "AppendArial",
        fontSize=size,
        leading=leading or size * 1.35,
        textColor=color,
        spaceAfter=0,
    )
    p = Paragraph(text, style)
    _, h = p.wrap(w, 1000)
    p.drawOn(c, x, y_top - h)
    return y_top - h


def image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    box(c, x, y, w, h, white, 9, LINE)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, 9)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def bullet_list(c: canvas.Canvas, items: list[str], x: float, y_top: float, w: float, color=INK) -> float:
    y = y_top
    for item in items:
        c.setFillColor(BLUE)
        c.circle(x + 3.5, y - 5.4, 1.8, fill=1, stroke=0)
        y = para(c, escape(item), x + 12, y, w - 12, 8.6, color, False, 11.1)
        y -= 5
    return y


def mini_card(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, text: str, accent, fill) -> None:
    box(c, x, y, w, h, fill, 9, LINE)
    box(c, x + 12, y + h - 26, 5, 15, accent, 3)
    para(c, f"<b>{escape(title)}</b>", x + 25, y + h - 12, w - 35, 9, INK)
    para(c, escape(text), x + 13, y + h - 36, w - 26, 7.6, MUTED, False, 9.6)


def draw_extension_page(path: Path, language: str) -> None:
    is_vi = language == "vi"
    c = canvas.Canvas(str(path), pagesize=A4, pageCompression=1)
    c.setTitle("ScamCheck extension appendix" if not is_vi else "Phu luc tien ich Chrome ScamCheck")
    c.setAuthor("HVT.ShieldSpark")

    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 52, PAGE_W, 52, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("AppendArial-Bold", 10)
    c.drawString(M, PAGE_H - 31, "HVT.ShieldSpark | ScamCheck | NextGen 2026")
    c.setFont("AppendArial", 8)
    c.drawRightString(PAGE_W - M, PAGE_H - 31, "Page 9")

    title = "PHỤ LỤC: TIỆN ÍCH CHROME SCAMCHECK" if is_vi else "APPENDIX: SCAMCHECK CHROME EXTENSION"
    subtitle = "Bảo vệ có ngữ cảnh khi người dùng đang lướt web" if is_vi else "Contextual safety support while users browse"
    c.setFillColor(NAVY)
    c.setFont("AppendArial-Bold", 17)
    c.drawString(M, PAGE_H - 81, title)
    c.setFillColor(MUTED)
    c.setFont("AppendArial", 9.5)
    c.drawString(M, PAGE_H - 97, subtitle)
    c.setStrokeColor(LINE)
    c.line(M, PAGE_H - 108, PAGE_W - M, PAGE_H - 108)

    intro = (
        "ScamCheck extension đưa công cụ kiểm tra vào ngay trang đang mở. Người dùng có thể tự quét nội dung, hoặc bật Auto Guard tùy chọn để nhận cảnh báo ngay trong bối cảnh đang lướt web."
        if is_vi else
        "The ScamCheck extension brings the checking experience into the current page. Users can scan content deliberately, or enable optional Auto Guard to receive a warning in the browsing context."
    )
    para(c, escape(intro), M, PAGE_H - 126, CONTENT_W, 9.4, INK, False, 12.5)

    left_w = CONTENT_W * 0.65
    top_y = PAGE_H - 405
    image_contain(c, SCREEN_EXT, M, top_y, left_w, 236)
    image_contain(c, SCREEN_POPUP, M + left_w + 11, top_y, CONTENT_W - left_w - 11, 236)
    c.setFillColor(MUTED)
    c.setFont("AppendArial", 7.4)
    c.drawString(M, top_y - 12, "Ảnh chụp extension hoạt động trên trang web" if is_vi else "Authentic screenshots of the extension in use")

    desc = (
        "Ảnh trái cho thấy extension hiển thị ngay trên một trang web; ảnh phải là cửa sổ kiểm tra nhanh. Thiết kế ưu tiên để người dùng chủ động chọn nội dung cần kiểm tra thay vì tự động mở hoặc tương tác với đường link đáng ngờ."
        if is_vi else
        "The left image shows the extension in an ordinary web page; the right image is the quick-check panel. The design lets the user choose what to inspect instead of opening or interacting with suspicious links."
    )
    y = top_y - 30
    y = para(c, escape(desc), M, y, CONTENT_W, 8.9, INK, False, 11.5)
    y -= 18

    cards = (
        [
            ("Quét chủ động", "Bôi đen chữ, dán tin nhắn hoặc quét ảnh trên trang để OCR cục bộ.", BLUE, SKY),
            ("Auto Guard tùy chọn", "Khi gặp dấu hiệu mạnh, hiện cảnh báo có giải thích và hướng dẫn an toàn.", GREEN, MINT),
            ("Riêng tư và kiểm soát", "Có thể tắt cảnh báo theo từng website; mật khẩu và trường biểu mẫu bị loại trừ.", GOLD, CREAM),
        ] if is_vi else [
            ("Active scan", "Select text, paste a message or scan a page image through local OCR.", BLUE, SKY),
            ("Optional Auto Guard", "When strong signals appear, show an explained warning and safer guidance.", GREEN, MINT),
            ("Privacy and control", "Users can disable alerts per site; password and form fields are excluded.", GOLD, CREAM),
        ]
    )
    w = (CONTENT_W - 16) / 3
    for i, item in enumerate(cards):
        mini_card(c, M + i * (w + 8), y - 74, w, 65, *item)
    y -= 98

    safe_title = "Nguyên tắc an toàn của extension" if is_vi else "Extension safety principles"
    safe_items = (
        [
            "Không tự động mở liên kết mà người dùng kiểm tra.",
            "Auto Guard chỉ hoạt động khi người dùng chủ động bật và chỉ dùng bản chụp chữ đang hiển thị có giới hạn.",
            "Kết quả AI là hỗ trợ giáo dục; người dùng vẫn cần xác minh qua kênh chính thức khi tình huống có hậu quả lớn.",
        ] if is_vi else [
            "It does not automatically open a link that the user is checking.",
            "Auto Guard works only when enabled by the user and uses a bounded snapshot of visible text.",
            "AI output is educational guidance; high-impact situations still require official-channel verification.",
        ]
    )
    box(c, M, y - 108, CONTENT_W, 95, SKY, 10, HexColor("#BFD5FF"))
    para(c, f"<b>{escape(safe_title)}</b>", M + 16, y - 28, CONTENT_W - 32, 10.2, NAVY)
    bullet_list(c, safe_items, M + 16, y - 49, CONTENT_W - 32)

    c.setStrokeColor(LINE)
    c.line(M, 29, PAGE_W - M, 29)
    c.setFillColor(MUTED)
    c.setFont("AppendArial", 7.4)
    footer_note = (
        "ScamCheck là công cụ giáo dục. Hãy xác minh tình huống rủi ro cao qua kênh chính thức."
        if is_vi else
        "ScamCheck is an educational tool. Verify high-risk situations through official channels."
    )
    c.drawString(M, 17, footer_note)
    c.drawRightString(PAGE_W - M, 17, "9 / 9")
    c.save()


def append(source: Path, extension_page: Path, target: Path) -> None:
    writer = PdfWriter()
    # Add pages individually so the page resource dictionaries stay separate
    # from the older source PDF's resources.
    for page in PdfReader(str(source)).pages:
        writer.add_page(page)
    for page in PdfReader(str(extension_page)).pages:
        writer.add_page(page)
    with target.open("wb") as stream:
        writer.write(stream)


def flatten_extension_page(source: Path, target: Path) -> Path:
    """Rasterise the appended page to avoid resource-name collisions with legacy PDFs."""
    prefix = TMP / f"{source.stem}-flat"
    subprocess.run(
        [str(PDFTOPPM), "-f", "1", "-l", "1", "-r", "180", "-png", str(source), str(prefix)],
        check=True,
    )
    raster = TMP / f"{source.stem}-flat-1.png"
    if not raster.exists():
        raise FileNotFoundError(raster)
    c = canvas.Canvas(str(target), pagesize=A4, pageCompression=1)
    c.drawImage(ImageReader(str(raster)), 0, 0, PAGE_W, PAGE_H, mask="auto")
    c.save()
    return target


def render_pdf_pages(source: Path, prefix: str, dpi: int = 190) -> list[Path]:
    """Render pages before recombining them, keeping legacy page artwork intact."""
    output_prefix = TMP / prefix
    subprocess.run(
        [str(PDFTOPPM), "-r", str(dpi), "-png", str(source), str(output_prefix)],
        check=True,
    )
    pages = sorted(TMP.glob(f"{prefix}-*.png"), key=lambda p: int(p.stem.rsplit("-", 1)[1]))
    if not pages:
        raise FileNotFoundError(f"No rendered pages for {source}")
    return pages


def combine_page_images(pages: list[Path], target: Path, title: str) -> None:
    """Create a compatibility-safe PDF from the original rendered pages plus page 9."""
    c = canvas.Canvas(str(target), pagesize=A4, pageCompression=1)
    c.setTitle(title)
    c.setAuthor("HVT.ShieldSpark")
    for page in pages:
        c.drawImage(ImageReader(str(page)), 0, 0, PAGE_W, PAGE_H, mask="auto")
        c.showPage()
    c.save()


def main() -> None:
    fonts()
    for item in [SOURCE_VI, SOURCE_EN, SCREEN_EXT, SCREEN_POPUP]:
        if not item.exists():
            raise FileNotFoundError(item)
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    vi_page = TMP / "extension-page-vi.pdf"
    en_page = TMP / "extension-page-en.pdf"
    draw_extension_page(vi_page, "vi")
    draw_extension_page(en_page, "en")
    vi_target = OUT / "ScamCheck_NextGen_Bilingual_HVT_ShieldSpark_Extended.pdf"
    en_target = OUT / "ScamCheck_NextGen_Round1_English_HVT_ShieldSpark_Extended.pdf"
    vi_pages = render_pdf_pages(SOURCE_VI, "original-vi") + render_pdf_pages(vi_page, "extension-vi")
    en_pages = render_pdf_pages(SOURCE_EN, "original-en") + render_pdf_pages(en_page, "extension-en")
    combine_page_images(vi_pages, vi_target, "ScamCheck - NextGen Innovator 2026 Vietnamese Reference")
    combine_page_images(en_pages, en_target, "ScamCheck - NextGen Innovator 2026 English Project Reference")
    print(vi_target)
    print(en_target)


if __name__ == "__main__":
    main()
