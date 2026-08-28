from __future__ import annotations

import os
from pathlib import Path

from PIL import Image as PILImage
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "Melisa_Baby_International_Company_Profile.pdf"

DESKTOP = Path(r"C:\Users\Xaser\Desktop")
ASSET_DIR = DESKTOP / "Melisa Baby Wholesale Catalog_files"
UPLOADS = ROOT / "apps" / "api" / "uploads" / "vega-products"

LOGO = ASSET_DIR / "melisa-baby-logo.png"
STOREFRONT = DESKTOP / "MAĞAZA ÖN.jpeg"
SHOWROOM = ASSET_DIR / "catalog-showroom-products.jpg"
WAREHOUSE = ASSET_DIR / "catalog-warehouse.jpg"
EXPORT = ASSET_DIR / "catalog-export-logistics.jpg"

PRODUCTS = [
    (UPLOADS / "vega-98706-1787047182358-NAYINOM---1633.jpg", "1633", "NAYINOM", "Sleeveless bodysuit"),
    (UPLOADS / "vega-158142-1787142089866-MURAT-BABY---10301.jpg", "10301", "MURAT BABY", "Three-piece romper set"),
    (UPLOADS / "vega-158131-1787047179236-MURAT-BABY---10252.jpg", "10252", "MURAT BABY", "Bear striped set"),
    (UPLOADS / "vega-158748-1787047184467-Nayinom-Baby---1219.jpg", "1219", "NAYINOM", "Bear three-piece set"),
    (UPLOADS / "vega-158637-1787047171823-CONCEPT---3800.jpg", "3800", "CONCEPT", "Smart coordinated set"),
    (UPLOADS / "vega-158728-1787142090071-MURAT-BABY---10370.jpg", "10370", "MURAT BABY", "Five-piece printed set"),
]

W, H = A4
RED = HexColor("#C81826")
BURGUNDY = HexColor("#7F1720")
INK = HexColor("#2B2321")
CREAM = HexColor("#F8F2EC")
SAND = HexColor("#E8D6C6")
MIST = HexColor("#F3F5F6")
GREEN = HexColor("#187A59")
GOLD = HexColor("#B88A51")
MUTED = HexColor("#6F6662")
LINE = HexColor("#E5DAD2")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
    pdfmetrics.registerFont(TTFont("Georgia", r"C:\Windows\Fonts\georgia.ttf"))
    pdfmetrics.registerFont(TTFont("Georgia-Bold", r"C:\Windows\Fonts\georgiab.ttf"))


def rounded_clip(c: canvas.Canvas, x: float, y: float, w: float, h: float, r: float):
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    c.saveState()
    c.clipPath(p, stroke=0, fill=0)


def draw_image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float, radius: float = 0) -> None:
    with PILImage.open(path) as im:
        iw, ih = im.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    if radius:
        rounded_clip(c, x, y, w, h, radius)
    else:
        p = c.beginPath()
        p.rect(x, y, w, h)
        c.saveState()
        c.clipPath(p, stroke=0, fill=0)
    c.drawImage(str(path), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()


def draw_image_fit(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    with PILImage.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(str(path), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, preserveAspectRatio=True, mask="auto")


def text(c: canvas.Canvas, value: str, x: float, y: float, size: float, color=INK, font="Arial", align="left") -> None:
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawString(x, y, value)


def multiline(c: canvas.Canvas, value: str, x: float, y: float, width: float, size=10, leading=14, color=INK, font="Arial") -> float:
    words = value.split()
    lines, current = [], ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if pdfmetrics.stringWidth(trial, font, size) <= width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def pill(c: canvas.Canvas, label: str, x: float, y: float, w: float, fill=white, stroke=LINE, color=INK, size=8.5) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, 22, 11, fill=1, stroke=1)
    text(c, label, x + w / 2, y + 7, size, color, "Arial-Bold", "center")


def header(c: canvas.Canvas, number: str, kicker: str, title: str, subtitle: str | None = None) -> None:
    c.setFillColor(CREAM)
    c.rect(0, H - 122, W, 122, fill=1, stroke=0)
    c.setFillColor(RED)
    c.rect(0, H - 122, 8, 122, fill=1, stroke=0)
    text(c, number, W - 36, H - 35, 10, RED, "Arial-Bold", "right")
    text(c, kicker.upper(), 36, H - 34, 8.5, RED, "Arial-Bold")
    text(c, title, 36, H - 67, 24, INK, "Georgia-Bold")
    if subtitle:
        multiline(c, subtitle, 36, H - 91, W - 90, 9.5, 13, MUTED)


def footer(c: canvas.Canvas, page: int, total: int = 6) -> None:
    c.setStrokeColor(LINE)
    c.line(36, 30, W - 36, 30)
    text(c, "MELISA BABY", 36, 17, 7.5, RED, "Arial-Bold")
    text(c, "melisababy.com", W / 2, 17, 7.5, MUTED, "Arial", "center")
    text(c, f"{page} / {total}", W - 36, 17, 7.5, MUTED, "Arial", "right")


def qr(c: canvas.Canvas, payload: str, x: float, y: float, size: float) -> None:
    widget = QrCodeWidget(payload)
    bounds = widget.getBounds()
    bw, bh = bounds[2] - bounds[0], bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / bw, 0, 0, size / bh, 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


def page_cover(c: canvas.Canvas) -> None:
    draw_image_cover(c, STOREFRONT, 0, 0, W, H)
    c.setFillColor(Color(0.10, 0.06, 0.05, alpha=0.60))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(Color(0.50, 0.04, 0.07, alpha=0.82))
    c.roundRect(28, 40, W - 56, H - 80, 22, fill=1, stroke=0)
    c.setFillColor(white)
    c.roundRect(50, H - 170, 190, 82, 15, fill=1, stroke=0)
    draw_image_fit(c, LOGO, 65, H - 158, 160, 58)
    text(c, "INTERNATIONAL", 50, H - 230, 10, white, "Arial-Bold")
    text(c, "Company Profile", 50, H - 278, 34, white, "Georgia-Bold")
    multiline(c, "Wholesale baby and children's clothing from Istanbul, Turkey.", 50, H - 315, 430, 16, 21, white, "Arial")
    multiline(c, "Curated collections. Reliable supply. Personal B2B service.", 50, H - 372, 420, 11, 16, HexColor("#F7D9D5"), "Arial-Bold")

    stats = [("30+", "YEARS EXPERIENCE"), ("4200+", "PRODUCTS"), ("140+", "BRANDS"), ("16+", "COUNTRIES")]
    x0, y0, gap = 50, 116, 10
    card_w = (W - 100 - 3 * gap) / 4
    for i, (big, small) in enumerate(stats):
        x = x0 + i * (card_w + gap)
        c.setFillColor(Color(1, 1, 1, alpha=0.13))
        c.roundRect(x, y0, card_w, 66, 12, fill=1, stroke=0)
        text(c, big, x + card_w / 2, y0 + 35, 17, white, "Arial-Bold", "center")
        text(c, small, x + card_w / 2, y0 + 16, 6.2, HexColor("#F8DEDA"), "Arial-Bold", "center")
    text(c, "ISTANBUL  •  TURKEY", 50, 66, 8.5, white, "Arial-Bold")


def page_who(c: canvas.Canvas) -> None:
    header(c, "02", "WHO WE ARE", "A trusted wholesale partner", "We help retailers, boutiques, wholesalers and export partners build complete babywear selections from Turkey.")
    draw_image_cover(c, SHOWROOM, 36, 364, W - 72, 280, 16)
    c.setFillColor(Color(0.50, 0.04, 0.07, alpha=0.88))
    c.roundRect(54, 386, 250, 82, 12, fill=1, stroke=0)
    text(c, "One showroom.", 70, 437, 16, white, "Georgia-Bold")
    text(c, "A complete wholesale selection.", 70, 412, 12, white, "Arial-Bold")

    y = 332
    multiline(c, "Since 1993, Melisa Baby has brought together leading Turkish baby and children's clothing brands in Istanbul. Our team supports buyers from first selection through quotation, preparation and shipment coordination.", 36, y, W - 72, 10.3, 15, INK)
    cards = [
        ("WIDE RANGE", "Ready-stock choices across essential and seasonal categories."),
        ("PRIVATE PRICING", "Current wholesale prices and availability are confirmed directly."),
        ("FAST SUPPORT", "WhatsApp-based service, including live showroom video calls."),
        ("EXPORT READY", "Order preparation and shipment planning for international buyers."),
    ]
    card_w, card_h = (W - 84) / 2, 92
    for i, (ttl, body) in enumerate(cards):
        col, row = i % 2, i // 2
        x = 36 + col * (card_w + 12)
        yy = 145 - row * (card_h + 12)
        c.setFillColor(CREAM if i % 2 == 0 else MIST)
        c.setStrokeColor(LINE)
        c.roundRect(x, yy, card_w, card_h, 12, fill=1, stroke=1)
        text(c, ttl, x + 15, yy + 62, 8.5, RED if i % 2 == 0 else GREEN, "Arial-Bold")
        multiline(c, body, x + 15, yy + 42, card_w - 30, 8.7, 12, MUTED)
    footer(c, 2)


def page_collections(c: canvas.Canvas) -> None:
    header(c, "03", "OUR COLLECTIONS", "One supplier, a complete range", "A practical mix of fast-moving essentials, coordinated sets and seasonal statement pieces.")
    labels = ["Newborn 0-12 M", "Baby Girl 0-4 Y", "Baby Boy 0-4 Y", "Hospital Sets", "Knitwear", "Blankets", "Rompers", "Pajamas", "Shoes", "Accessories"]
    x, y = 36, H - 153
    for label in labels:
        pw = max(75, pdfmetrics.stringWidth(label, "Arial-Bold", 8) + 26)
        if x + pw > W - 36:
            x, y = 36, y - 30
        pill(c, label, x, y, pw, CREAM, SAND, BURGUNDY, 8)
        x += pw + 8

    grid_y, grid_h = 120, 450
    gap = 10
    col_w = (W - 72 - 2 * gap) / 3
    chosen = [PRODUCTS[0], PRODUCTS[1], PRODUCTS[4]]
    for i, (path, code, brand, name) in enumerate(chosen):
        xx = 36 + i * (col_w + gap)
        c.setFillColor(white)
        c.setStrokeColor(LINE)
        c.roundRect(xx, grid_y, col_w, grid_h, 14, fill=1, stroke=1)
        draw_image_cover(c, path, xx + 6, grid_y + 76, col_w - 12, grid_h - 82, 10)
        text(c, brand, xx + 12, grid_y + 52, 7.5, RED, "Arial-Bold")
        text(c, name, xx + 12, grid_y + 35, 8.4, INK, "Arial-Bold")
        text(c, f"Code {code}", xx + 12, grid_y + 18, 7.5, MUTED)
    footer(c, 3)


def page_process(c: canvas.Canvas) -> None:
    header(c, "04", "HOW WE WORK", "Wholesale ordering, made personal", "A clear process designed for remote buyers and showroom visitors.")
    draw_image_cover(c, WAREHOUSE, 330, 105, W - 366, 595, 16)
    steps = [
        ("01", "Tell us what you need", "Share your country, store type, target categories and budget."),
        ("02", "See current options", "Receive photos, availability and private wholesale pricing."),
        ("03", "Build your selection", "Choose models, colors, age groups and size quantities with our team."),
        ("04", "Confirm the quotation", "Review your selection and commercial terms before approval."),
        ("05", "Preparation and check", "Your order is collected, counted and prepared for dispatch."),
        ("06", "Shipment coordination", "We help plan the most suitable delivery option for your market."),
    ]
    y = 673
    for num, ttl, body in steps:
        c.setFillColor(RED)
        c.circle(55, y - 4, 15, fill=1, stroke=0)
        text(c, num, 55, y - 8, 8, white, "Arial-Bold", "center")
        text(c, ttl, 82, y, 11.2, INK, "Arial-Bold")
        multiline(c, body, 82, y - 19, 225, 8.6, 11.5, MUTED)
        if num != "06":
            c.setStrokeColor(SAND)
            c.setLineWidth(1.2)
            c.line(55, y - 22, 55, y - 74)
        y -= 92
    c.setFillColor(CREAM)
    c.roundRect(36, 55, W - 72, 40, 10, fill=1, stroke=0)
    text(c, "Prices, availability, minimum order and shipping terms are confirmed by your sales representative.", W / 2, 70, 7.7, BURGUNDY, "Arial-Bold", "center")
    footer(c, 4)


def page_favorites(c: canvas.Canvas) -> None:
    header(c, "05", "CUSTOMER FAVORITES", "Proven products, fresh selections", "A sample of products with strong 2026 sales movement. Current colors and availability may vary.")
    gap = 10
    card_w = (W - 72 - 2 * gap) / 3
    card_h = 269
    for i, (path, code, brand, name) in enumerate(PRODUCTS):
        col, row = i % 3, i // 3
        x = 36 + col * (card_w + gap)
        y = 385 - row * (card_h + 12)
        c.setFillColor(white)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, card_w, card_h, 12, fill=1, stroke=1)
        draw_image_cover(c, path, x + 5, y + 65, card_w - 10, card_h - 70, 9)
        text(c, brand, x + 10, y + 46, 7, RED, "Arial-Bold")
        text(c, name, x + 10, y + 29, 7.8, INK, "Arial-Bold")
        text(c, f"Code {code}", x + 10, y + 13, 7.2, MUTED)
    footer(c, 5)


def page_contact(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_image_cover(c, STOREFRONT, 0, 410, W, H - 410)
    c.setFillColor(Color(0.10, 0.06, 0.05, alpha=0.42))
    c.rect(0, 410, W, H - 410, fill=1, stroke=0)
    c.setFillColor(white)
    c.roundRect(36, H - 112, 154, 58, 12, fill=1, stroke=0)
    draw_image_fit(c, LOGO, 48, H - 105, 130, 44)
    text(c, "LET'S BUILD YOUR", 36, 365, 9, RED, "Arial-Bold")
    text(c, "next collection", 36, 324, 29, INK, "Georgia-Bold")
    multiline(c, "Request the current catalog and private price list, or book a WhatsApp showroom video call with our wholesale team.", 36, 291, W - 72, 11, 16, MUTED)

    c.setFillColor(white)
    c.setStrokeColor(LINE)
    c.roundRect(36, 92, W - 72, 160, 16, fill=1, stroke=1)
    qr(c, "https://wa.me/905435195029?text=Hello%20Melisa%20Baby%2C%20I%20would%20like%20the%20current%20wholesale%20catalog.", 54, 113, 104)
    text(c, "SCAN TO START ON WHATSAPP", 54, 101, 6.8, RED, "Arial-Bold")
    text(c, "WhatsApp", 182, 219, 8, MUTED, "Arial-Bold")
    text(c, "+90 543 519 50 29", 182, 199, 12, INK, "Arial-Bold")
    text(c, "Website", 182, 172, 8, MUTED, "Arial-Bold")
    text(c, "www.melisababy.com", 182, 152, 11, INK, "Arial-Bold")
    text(c, "Email", 365, 219, 8, MUTED, "Arial-Bold")
    text(c, "info@melisababy.com", 365, 199, 10, INK, "Arial-Bold")
    text(c, "Showroom", 365, 172, 8, MUTED, "Arial-Bold")
    multiline(c, "Mercan Mah. Muhurdar Eminpasa Sok. No:22/A Fatih / Istanbul / Turkey", 365, 152, 175, 8.2, 11, INK, "Arial-Bold")
    text(c, "Instagram  @melisababy.wholesale", 36, 66, 8.5, BURGUNDY, "Arial-Bold")
    text(c, "Showroom visits by WhatsApp appointment", W - 36, 66, 8.5, MUTED, "Arial", "right")
    footer(c, 6)


def validate_inputs() -> None:
    paths = [LOGO, STOREFRONT, SHOWROOM, WAREHOUSE, EXPORT] + [p[0] for p in PRODUCTS]
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing assets:\n" + "\n".join(missing))


def build() -> None:
    validate_inputs()
    register_fonts()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("Melisa Baby International Company Profile")
    c.setAuthor("Melisa Baby")
    c.setSubject("Wholesale baby and children's clothing company profile")
    for fn in [page_cover, page_who, page_collections, page_process, page_favorites, page_contact]:
        fn(c)
        c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
