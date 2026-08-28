from decimal import Decimal
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "PF-2026-AHM10350_Melisa_Baby_EN.pdf"

FONT_DIR = Path(r"C:\Windows\Fonts")
pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic", str(FONT_DIR / "ariali.ttf")))

NAVY = colors.HexColor("#172033")
BLUE_GRAY = colors.HexColor("#9DADC4")
LIGHT = colors.HexColor("#F4F7FA")
MID = colors.HexColor("#E5EAF0")
RED = colors.HexColor("#E8262D")
ORANGE = colors.HexColor("#F38B2A")
MUTED = colors.HexColor("#556174")
GREEN = colors.HexColor("#14845A")

PAGE_W, PAGE_H = A4
MARGIN = 10 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


def money(value):
    value = Decimal(str(value))
    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def hs(code):
    digits = "".join(ch for ch in str(code) if ch.isdigit())
    if len(digits) == 12:
        return f"{digits[:4]}.{digits[4:6]}.{digits[6:8]}.{digits[8:10]}.{digits[10:]}"
    return str(code)


ITEMS = [
    ("2004 MELISA", "5-PIECE SET", "611120900000", 80, "PCS", 10.40),
    ("8051 MELISA", "BLANKET", "630130100000", 5, "PCS", 5.80),
    ("8052 MELISA", "BLANKET", "630130100000", 5, "PCS", 5.80),
    ("8050 MELISA", "BLANKET", "630130100000", 5, "PCS", 5.80),
    ("4556 MIOMINI", "ELEGANT BOYS' FOOTED ROMPER", "611120900000", 16, "PCS", 8.50),
    ("4607 MY MIO", "HOODED ROMPER", "611120900000", 40, "PCS", 8.80),
    ("056 PAKEL", "CAR PRINT FOOTED ROMPER", "611120900000", 40, "PCS", 5.40),
    ("9245 DEMIRDAG", "WRAP-OVER NEWBORN SET", "611120900000", 75, "PCS", 2.25),
    ("1330 PERA BABY", "ROMPER", "611120900000", 100, "PCS", 4.00),
    ("2020 MINIDAY BABY", "FLORA ROMPER", "611120900000", 39, "PCS", 4.80),
    ("10410 MURAT BABY", "HEART SLEEVE FRILL BODYSUIT SET", "611120900000", 16, "PCS", 5.10),
    ("10806 MURAT BABY", "PREMIUM BABY SET MAMY", "611120900000", 3, "PCS", 8.50),
    ("9998 MURAT BABY", "BUTTON DETAIL PLAIN VELVET ROMPER", "611120900000", 20, "PCS", 4.20),
    ("9998 MURAT BABY", "BUTTON DETAIL PLAIN VELVET ROMPER", "611120900000", 20, "PCS", 4.20),
    ("9889 MURAT BABY", "FLORAL PRINT VELVET ROMPER WITH HAT", "611120900000", 15, "PCS", 3.70),
    ("10057 MURAT BABY", "DEER EMBROIDERED VELVET SET", "611120900000", 20, "PCS", 4.60),
    ("7994 BUUDE KIDS", "LAMB AND RABBIT BLANKET", "630130100000", 20, "PCS", 5.30),
    ("261062 BOM-BIBO BABY", "BEAR PRINT BODYSUIT SET", "611120900000", 45, "PCS", 3.85),
    ("261141 BOM-BIBO BABY", "EMBROIDERED COLLAR PREMATURE ROMPER", "611120900000", 15, "PCS", 3.10),
    ("7104 NEHAD", "VELSOFT ROMPER", "611130900000", 60, "PCS", 6.60),
    ("7090 NEHAD", "VELSOFT ROMPER", "611130900000", 40, "PCS", 6.25),
    ("7385 FUNNY", "PREMIUM BABY BOOTIES", "611120900000", 24, "PCS", 2.80),
    ("7310 FUNNY", "CHARISMA BABY BOOTIES", "611120900000", 24, "PCS", 2.25),
    ("7362 FUNNY", "SPECIAL BABY BOOTIES", "611120900000", 24, "PCS", 2.25),
    ("7370 FUNNY", "PREMIUM BABY BOOTIES", "611120900000", 12, "PCS", 2.70),
    ("575423 BABY SEA", "BABY BALLET SHOES", "611120900000", 24, "PCS", 3.00),
    ("1256 PAPULIN", "BABY BOOTIES", "611120900000", 24, "PCS", 3.75),
    ("4409 PAPULIN", "BABY BOOTIES", "611120900000", 24, "PCS", 3.75),
    ("4254 BEBESSI", "VINTAGE BATHROBE SET", "620920000019", 2, "PCS", 11.90),
    ("4316 BEBESSI", "BUNNY HUG BOXED BATHROBE", "620920000019", 3, "PCS", 11.65),
    ("4170 BEBESSI", "RABBIT BOXED BATHROBE SET", "620920000019", 3, "PCS", 11.90),
    ("3968 BEBESSI", "LAMB BOXED BATHROBE SET", "620920000019", 2, "PCS", 11.90),
    ("4227 BEBESSI", "TO PLAY BATHROBE SET", "620920000019", 4, "PCS", 11.65),
    ("4152 BEBESSI", "BIG BEAR BOXED BATHROBE SET", "620920000019", 3, "PCS", 11.90),
    ("3985 BEBESSI", "SAILING BATHROBE SET", "620920000019", 3, "PCS", 11.90),
    ("3399 MELISA", "KNITTED BABY BOOTIES", "611120900000", 5, "PCS", 5.70),
    ("1448 MY PINGY BABY", "DRESS", "620920000019", 12, "PCS", 10.60),
    ("3633 MY MIO", "NATURAL FLORAL DRESS", "620920000019", 10, "PCS", 9.35),
    ("10173 MURAT BABY", "MINI HEART PATTERN DRESS", "620920000019", 15, "PCS", 5.45),
    ("1414 MY PINGY BABY", "DRESS", "620920000019", 12, "PCS", 9.65),
    ("1425 MY PINGY BABY", "DRESS", "620920000019", 8, "PCS", 10.30),
    ("1424 MY PINGY BABY", "DRESS", "620920000019", 12, "PCS", 10.65),
    ("1434 MY PINGY BABY", "DRESS", "620920000019", 4, "PCS", 10.65),
    ("1406 MY PINGY BABY", "DRESS", "620920000019", 8, "PCS", 11.60),
    ("4412 MY MIO", "PRINTED LINEN DRESS", "620990900019", 15, "PCS", 10.70),
    ("4630 MY MIO", "KNITTED DRESS WITH BOLERO", "611120900000", 15, "PCS", 13.00),
    ("4628 MY MIO", "LONG-SLEEVE DRESS WITH CARDIGAN", "611120900000", 15, "PCS", 13.65),
    ("4629 MY MIO", "LONG-SLEEVE LACE-COLLAR DRESS", "620920000019", 15, "PCS", 12.20),
    ("4471 MIOMINI", "WOVEN DRESS", "620920000019", 15, "PCS", 9.35),
    ("20530 ANNA BABBA", "KNITTED DRESS WITH CARDIGAN", "611120900000", 8, "PCS", 11.90),
    ("20355 ANNA BABBA", "FLOWER GARDEN DRESS", "620920000019", 16, "PCS", 10.65),
    ("20499 ANNA BABBA", "DAISY LONG-SLEEVE DRESS WITH HAT", "620920000019", 12, "PCS", 8.15),
    ("20354 ANNA BABBA", "FLOWER DRESS SET", "620920000019", 8, "PCS", 12.80),
    ("4195 MY MIO", "PRINTED GIRLS' LINEN DRESS", "620990900019", 10, "PCS", 9.40),
    ("5009 SO FAME BABY", "BABY BOOTIES", "611120900000", 24, "PCS", 2.90),
]


STYLE_NORMAL = ParagraphStyle("normal", fontName="Arial", fontSize=6.4, leading=7.5, textColor=NAVY)
STYLE_SMALL = ParagraphStyle("small", fontName="Arial", fontSize=5.8, leading=6.8, textColor=MUTED)
STYLE_BOLD = ParagraphStyle("bold", fontName="Arial-Bold", fontSize=6.4, leading=7.5, textColor=NAVY)
STYLE_WHITE = ParagraphStyle("white", fontName="Arial-Bold", fontSize=6.4, leading=7.5, textColor=colors.white)
STYLE_RIGHT = ParagraphStyle("right", parent=STYLE_NORMAL, alignment=TA_RIGHT)
STYLE_RIGHT_BOLD = ParagraphStyle("rightb", parent=STYLE_BOLD, alignment=TA_RIGHT)
STYLE_CENTER = ParagraphStyle("center", parent=STYLE_NORMAL, alignment=TA_CENTER)


def p(text, style=STYLE_NORMAL):
    return Paragraph(str(text).replace("&", "&amp;"), style)


def box_title(c, x, y, w, text):
    c.setFillColor(NAVY)
    c.rect(x, y - 18, w, 18, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 8)
    c.drawString(x + 7, y - 12, text)


def draw_page_header(c, page_no, total_pages=3):
    c.setFont("Arial", 6.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, PAGE_H - 9 * mm, "25 AUGUST 2026 10:47")
    c.drawCentredString(PAGE_W / 2, PAGE_H - 9 * mm, "PF-2026-AHM10350  |  MELISA BABY")
    c.drawRightString(PAGE_W - MARGIN, 7 * mm, f"{page_no}/{total_pages}")


def draw_table(c, items, start_no, top_y, bottom_y):
    data = [[
        p("#", STYLE_BOLD), p("STOCK CODE / PRODUCT", STYLE_BOLD), p("HS CODE", STYLE_BOLD),
        p("QTY", STYLE_BOLD), p("UNIT", STYLE_BOLD), p("UNIT PRICE", STYLE_BOLD), p("AMOUNT EUR", STYLE_BOLD)
    ]]
    for no, (stock, desc, code, qty, unit, price) in enumerate(items, start=start_no):
        data.append([
            p(no, STYLE_CENTER),
            Paragraph(f"<b>{stock}</b><br/><font color='#556174'>{desc}</font>", STYLE_NORMAL),
            p(hs(code), STYLE_NORMAL), p(qty, STYLE_RIGHT), p(unit, STYLE_CENTER),
            p(money(price), STYLE_RIGHT), p(money(Decimal(str(qty)) * Decimal(str(price))), STYLE_RIGHT_BOLD)
        ])
    col_widths = [22, 176, 96, 42, 52, 77, 86]
    available_h = top_y - bottom_y
    header_h = 18
    row_h = (available_h - header_h) / len(items)
    table = Table(data, colWidths=col_widths, rowHeights=[header_h] + [row_h] * len(items))
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.45, BLUE_GRAY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 1), (3, -1), "RIGHT"),
        ("ALIGN", (5, 1), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    table.wrapOn(c, CONTENT_W, available_h)
    table.drawOn(c, MARGIN, bottom_y)


def draw_first_page(c):
    draw_page_header(c, 1)
    y_top = PAGE_H - 16 * mm
    left_w = 112 * mm
    right_w = CONTENT_W - left_w - 5 * mm

    c.setStrokeColor(NAVY)
    c.setLineWidth(1.2)
    c.line(MARGIN, y_top, MARGIN + left_w - 4 * mm, y_top)
    c.setFillColor(NAVY)
    c.setFont("Arial-Bold", 8.5)
    c.drawString(MARGIN, y_top - 13, "Melisa Bebe Tekstil San. ve Tic. Ltd. Sti.")
    c.setFont("Arial", 6.2)
    c.setFillColor(MUTED)
    company_lines = [
        "Muhurdar Eminpasa St. Mercan Dist. No:22/A",
        "Fatih, Istanbul, Turkiye",
        "Tel: +90 212 595 02 09  |  Fax: +90 212 511 19 18",
        "Tax Office: Hocapasa  |  Tax No: 6140585769",
        "MERSIS: 0614058576900012  |  Trade Registry: 922791",
    ]
    for i, line in enumerate(company_lines):
        c.drawString(MARGIN, y_top - 26 - i * 10, line)
    c.setFillColor(RED)
    c.setFont("Arial-Italic", 30)
    c.drawCentredString(MARGIN + left_w - 25 * mm, y_top - 44, "Melisa")
    c.setFont("Arial", 13)
    c.drawCentredString(MARGIN + left_w - 19 * mm, y_top - 61, "baby")

    rx = MARGIN + left_w + 5 * mm
    box_title(c, rx, y_top, right_w, "PROFORMA INVOICE")
    meta = [
        [p("Proforma No", STYLE_BOLD), p("PF-2026-AHM10350", STYLE_BOLD)],
        [p("Source Document", STYLE_BOLD), p("AHM10350", STYLE_BOLD)],
        [p("Date", STYLE_BOLD), p("25.08.2026", STYLE_BOLD)],
        [p("Valid Until", STYLE_BOLD), p("01.09.2026", STYLE_BOLD)],
        [p("Currency", STYLE_BOLD), p("EUR", STYLE_BOLD)],
    ]
    mt = Table(meta, colWidths=[33 * mm, right_w - 33 * mm], rowHeights=[14] * 5)
    mt.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .45, BLUE_GRAY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BACKGROUND", (0, 0), (0, -1), LIGHT), ("LEFTPADDING", (0, 0), (-1, -1), 5)]))
    mt.wrapOn(c, right_w, 70)
    mt.drawOn(c, rx, y_top - 18 - 70)
    section_y = y_top - 105
    consignee_w = 133 * mm
    delivery_w = CONTENT_W - consignee_w - 3 * mm
    box_title(c, MARGIN, section_y, consignee_w, "CONSIGNEE")
    c.setStrokeColor(BLUE_GRAY)
    c.rect(MARGIN, section_y - 102, consignee_w, 84, fill=0, stroke=1)
    c.setFillColor(NAVY)
    c.setFont("Arial-Bold", 8)
    c.drawString(MARGIN + 7, section_y - 34, "Compana VA Gonta Commercial")
    c.setFont("Arial", 6.4)
    c.drawString(MARGIN + 7, section_y - 48, "1 Lear, Bailieborough, Co. Cavan, A82 F704")
    c.drawString(MARGIN + 7, section_y - 60, "Bailieborough, Ireland")
    c.drawString(MARGIN + 7, section_y - 76, "Contact: Semih Senyildiz")
    c.drawString(MARGIN + 200, section_y - 76, "VAT No: 04283360DH")
    c.drawString(MARGIN + 7, section_y - 89, "Phone: +353 87 099 8483")
    c.drawString(MARGIN + 200, section_y - 89, "Email: alina@vagonta.com")

    dx = MARGIN + consignee_w + 3 * mm
    box_title(c, dx, section_y, delivery_w, "DELIVERY")
    delivery = [
        [Paragraph("<b>INCOTERM</b><br/>TO BE CONFIRMED", STYLE_SMALL), Paragraph("<b>TRANSPORT</b><br/>ROAD", STYLE_SMALL)],
        [Paragraph("<b>PLACE OF DELIVERY</b><br/>1 Lear, Bailieborough,<br/>Co. Cavan, A82 F704", STYLE_SMALL), Paragraph("<b>PAYMENT</b><br/>ADVANCE", STYLE_SMALL)],
        [Paragraph("<b>PACKAGES</b><br/>7", STYLE_SMALL), Paragraph("<b>NET / GROSS</b><br/>230 / 250 KG", STYLE_SMALL)],
    ]
    dt = Table(delivery, colWidths=[delivery_w/2, delivery_w/2], rowHeights=[24, 31, 29])
    dt.setStyle(TableStyle([("GRID", (0,0), (-1,-1), .45, BLUE_GRAY), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("BACKGROUND", (0,0), (-1,-1), colors.white), ("LEFTPADDING", (0,0), (-1,-1), 4)]))
    dt.wrapOn(c, delivery_w, 84)
    dt.drawOn(c, dx, section_y - 102)

    notice_y = section_y - 111
    c.setStrokeColor(ORANGE)
    c.rect(MARGIN, notice_y - 18, CONTENT_W, 18, fill=0, stroke=1)
    c.setFont("Arial-Bold", 5.5)
    c.setFillColor(RED)
    c.drawString(MARGIN + 7, notice_y - 12, "PROFORMA - NOT A COMMERCIAL OR TAX INVOICE.")
    c.setFont("Arial", 5.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + 188, notice_y - 12, "For quotation and payment preparation only; not an e-Invoice or official export invoice.")

    draw_table(c, ITEMS[:22], 1, notice_y - 26, 13 * mm)


def draw_second_page(c):
    draw_page_header(c, 2)
    draw_table(c, ITEMS[22:], 23, PAGE_H - 14 * mm, 13 * mm)


def draw_label_value_grid(c, x, y, w, h, rows, title):
    box_title(c, x, y, w, title)
    row_h = (h - 18) / len(rows)
    data = [[p(label, STYLE_BOLD), p(value, STYLE_BOLD)] for label, value in rows]
    t = Table(data, colWidths=[w * .48, w * .52], rowHeights=[row_h] * len(rows))
    t.setStyle(TableStyle([("GRID", (0,0), (-1,-1), .45, BLUE_GRAY), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 7), ("BACKGROUND", (0,0), (0,-1), LIGHT)]))
    t.wrapOn(c, w, h-18)
    t.drawOn(c, x, y-h)


def draw_third_page(c):
    draw_page_header(c, 3)
    top = PAGE_H - 17 * mm
    gap = 3 * mm
    left_w = 114 * mm
    right_w = CONTENT_W - left_w - gap
    terms = [
        ("DELIVERY TERM", "TO BE CONFIRMED"),
        ("PLACE OF DELIVERY", "1 Lear, Bailieborough, Co. Cavan, A82 F704"),
        ("PAYMENT METHOD", "ADVANCE PAYMENT"),
        ("MODE OF TRANSPORT", "ROAD"),
        ("ORIGIN", "TURKIYE"),
        ("PACKAGES / WEIGHT", "7 packages - 230 kg net - 250 kg gross"),
    ]
    draw_label_value_grid(c, MARGIN, top, left_w, 138, terms, "COMMERCIAL TERMS")

    tx = MARGIN + left_w + gap
    box_title(c, tx, top, right_w, "TOTALS")
    totals = [
        ("Goods Total", "6.774,40 EUR"),
        ("Freight Charge", "770,00 EUR"),
        ("Total Discount", "0,00 EUR"),
        ("Subtotal", "7.544,40 EUR"),
        ("VAT (0%)", "0,00 EUR"),
        ("Total Quantity", "1.094 PCS"),
        ("AMOUNT DUE", "7.544,40 EUR"),
    ]
    tdata = [[p(a, STYLE_BOLD), p(b, STYLE_RIGHT_BOLD)] for a,b in totals]
    tt = Table(tdata, colWidths=[right_w*.55, right_w*.45], rowHeights=[17]*len(totals))
    tt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.45,BLUE_GRAY),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("BACKGROUND",(0,0),(0,-1),LIGHT),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),("TEXTCOLOR",(0,-1),(-1,-1),GREEN)]))
    tt.wrapOn(c,right_w,119); tt.drawOn(c,tx,top-137)

    lower_top = top - 151
    bank_w = 108 * mm
    notes_w = CONTENT_W - bank_w - gap
    box_title(c, MARGIN, lower_top, bank_w, "BANK ACCOUNTS")
    bank_rows = [
        [p("Kuveyt Turk Participation Bank", STYLE_BOLD), ""],
        [p("TRY", STYLE_BOLD), p("TR85 0020 5000 0910 7244 6000 01", STYLE_NORMAL)],
        [p("USD", STYLE_BOLD), p("TR04 0020 5000 0910 7244 6001 01", STYLE_NORMAL)],
        [p("EUR", STYLE_BOLD), p("TR74 0020 5000 0910 7244 6001 02", STYLE_NORMAL)],
        [p("SWIFT", STYLE_BOLD), p("KTEFTRISXXX", STYLE_NORMAL)],
    ]
    bt = Table(bank_rows, colWidths=[34*mm, bank_w-34*mm], rowHeights=[20,18,18,18,18])
    bt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.45,BLUE_GRAY),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("SPAN",(0,0),(-1,0)),("BACKGROUND",(0,0),(-1,0),LIGHT),("LEFTPADDING",(0,0),(-1,-1),6),("TEXTCOLOR",(0,1),(0,3),RED)]))
    bt.wrapOn(c,bank_w,92); bt.drawOn(c,MARGIN,lower_top-110)

    nx = MARGIN + bank_w + gap
    box_title(c, nx, lower_top, notes_w, "NOTES")
    c.setStrokeColor(BLUE_GRAY); c.rect(nx, lower_top-110, notes_w, 92, fill=0, stroke=1)
    notes = [
        "GOODS ARE OF TURKISH ORIGIN.",
        "VAT 0% - export supply. Delivery and payment terms must be verified before use.",
        "HS codes, origin, weight and export tax exemption must be verified by an authorized person on the final commercial invoice.",
    ]
    y = lower_top - 35
    for i, line in enumerate(notes):
        sty = STYLE_BOLD if i == 0 else STYLE_NORMAL
        para = p(line, sty); para.wrapOn(c, notes_w-14, 40); para.drawOn(c,nx+7,y-12); y -= 25 if i else 20

    sign_y = lower_top - 136
    c.setStrokeColor(BLUE_GRAY)
    c.line(MARGIN, sign_y, MARGIN + 92*mm, sign_y)
    c.line(PAGE_W - MARGIN - 92*mm, sign_y, PAGE_W - MARGIN, sign_y)
    c.setFont("Arial", 6.2); c.setFillColor(MUTED)
    c.drawCentredString(MARGIN + 46*mm, sign_y-12, "Prepared by / Stamp - Signature")
    c.drawCentredString(PAGE_W - MARGIN - 46*mm, sign_y-12, "Buyer's Approval / Stamp - Signature")
    c.setFont("Arial", 5.8)
    c.drawRightString(PAGE_W-MARGIN, sign_y-31, "Generated by Melisa ERP Proforma - 25.08.2026 10:47")


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("PF-2026-AHM10350 Melisa Baby - English")
    c.setAuthor("Melisa Bebe Tekstil")
    draw_first_page(c); c.showPage()
    draw_second_page(c); c.showPage()
    draw_third_page(c); c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
