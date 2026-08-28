from decimal import Decimal
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUT = Path("output/pdf/SEBRA_STYLE_SRL_Proforma_Invoice_PF-2025-0022.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "arialbd.ttf")))

RED = colors.HexColor("#DC2626")
NAVY = colors.HexColor("#14213D")
SLATE = colors.HexColor("#475569")
LIGHT = colors.HexColor("#F8FAFC")
LINE = colors.HexColor("#CBD5E1")
AMBER = colors.HexColor("#FFF7ED")
AMBER_LINE = colors.HexColor("#FDBA74")
GREEN = colors.HexColor("#047857")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyA", fontName="Arial", fontSize=8, leading=11, textColor=NAVY))
styles.add(ParagraphStyle(name="BodySmall", fontName="Arial", fontSize=7, leading=9, textColor=SLATE))
styles.add(ParagraphStyle(name="SmallBold", fontName="Arial-Bold", fontSize=7, leading=9, textColor=NAVY))
styles.add(ParagraphStyle(name="HeaderCell", fontName="Arial-Bold", fontSize=6.7, leading=8.1, textColor=colors.white, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="Section", fontName="Arial-Bold", fontSize=8, leading=10, textColor=SLATE, spaceAfter=3))
styles.add(ParagraphStyle(name="TitleP", fontName="Arial-Bold", fontSize=18, leading=21, textColor=NAVY, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="SubTitleP", fontName="Arial-Bold", fontSize=8, leading=10, textColor=RED, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="Cell", fontName="Arial", fontSize=6.7, leading=8.1, textColor=NAVY))
styles.add(ParagraphStyle(name="CellC", fontName="Arial", fontSize=6.7, leading=8.1, textColor=NAVY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="CellR", fontName="Arial", fontSize=6.7, leading=8.1, textColor=NAVY, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="CellBold", fontName="Arial-Bold", fontSize=6.7, leading=8.1, textColor=NAVY))
styles.add(ParagraphStyle(name="TotalLabel", fontName="Arial-Bold", fontSize=8, leading=10, textColor=NAVY, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="TotalValue", fontName="Arial-Bold", fontSize=9, leading=11, textColor=GREEN, alignment=TA_RIGHT))


def money(value):
    return f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def qty(value):
    return f"{value:,}".replace(",", ".")


items = [
    ("BEBE BATTANİYE (%100 POLYESTER)", 100, "6.30", "630140909000"),
    ("BEBE ELBİSE (%100 PAMUK)", 80, "4.00", "620920000019"),
    ("BEBE ELBİSE (%100 PAMUK)", 664, "6.70", "620920000019"),
    ("BEBE ELBİSE (%80 PAMUK %20 POLYESTER)", 160, "8.80", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 140, "4.00", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 240, "5.30", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 425, "6.20", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 260, "7.40", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 135, "9.20", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 90, "10.07", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 68, "10.50", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 154, "11.20", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 98, "13.20", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 157, "13.50", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 77, "14.50", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 45, "15.50", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 40, "16.00", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 156, "3.20", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 425, "4.20", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 816, "4.60", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 80, "5.10", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 120, "7.20", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 39, "7.50", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 80, "8.20", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 45, "10.50", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 45, "11.00", "620920000019"),
    ("BEBE TULUM (%80 PAMUK %20 POLYESTER)", 45, "12.00", "620920000019"),
    ("BEBE TULUM (%80 PAMUK %20 POLYESTER)", 87, "13.00", "620920000019"),
    ("BEBE TULUM (%80 PAMUK %20 POLYESTER)", 42, "13.50", "620920000019"),
    ("BEBE TULUM (%80 PAMUK %20 POLYESTER)", 39, "13.70", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 521, "5.60", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 296, "6.60", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 230, "5.30", "620920000019"),
    ("BEBE ELBİSE (%80 PAMUK %20 POLYESTER)", 3, "8.90", "620920000019"),
    ("BEBE TAKIM (%80 PAMUK %20 POLYESTER)", 146, "9.30", "620920000019"),
    ("BEBE YELEK (%100 POLYESTER)", 1412, "3.30", "620930000019"),
    ("BEBE YELEK (%100 POLYESTER)", 540, "3.60", "620930000019"),
    ("BEBE YELEK (%100 POLYESTER)", 80, "3.80", "620930000019"),
    ("BEBE YELEK (%100 POLYESTER)", 150, "3.40", "620930000019"),
    ("BEBE TİŞÖRT (%100 PAMUK)", 240, "2.10", "610910000000"),
    ("BEBE ŞAPKA (%100 POLYESTER)", 180, "2.50", "620920000019"),
    ("BEBE PATİK (%100 POLYESTER)", 600, "0.80", "620930000019"),
    ("BEBE TAYT (%100 PAMUK)", 170, "2.00", "620920000019"),
    ("BEBE TEK ALT (%100 PAMUK)", 70, "2.60", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 90, "5.50", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 450, "2.10", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 360, "4.00", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 540, "8.00", "620920000019"),
    ("BEBE TULUM (%100 PAMUK)", 1341, "5.90", "620920000019"),
    ("BEBE BADİ (%100 PAMUK)", 80, "2.60", "620920000019"),
    ("BEBE YELEK (%100 POLYESTER)", 200, "3.30", "620930000019"),
    ("BEBE YELEK (%100 POLYESTER)", 248, "2.60", "620930000019"),
    ("BEBE TULUM (%100 PAMUK)", 90, "4.10", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 35, "7.90", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 40, "5.50", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 35, "5.90", "620920000019"),
    ("BEBE TAKIM (%100 PAMUK)", 35, "6.60", "620920000019"),
]

for i, row in enumerate(items):
    items[i] = (row[0], row[1], Decimal(row[2]), row[3])

grand_total = sum(Decimal(q) * price for _, q, price, _ in items)
total_qty = sum(q for _, q, _, _ in items)
assert len(items) == 57
assert total_qty == 13134
assert grand_total == Decimal("70426.10")


def P(text, style="BodyA"):
    return Paragraph(text, styles[style])


def page_frame(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.setFont("Arial", 6.5)
    canvas.setFillColor(SLATE)
    canvas.drawString(18 * mm, 8.5 * mm, "Melisa Bebe Tekstil - Proforma Invoice PF-2025-0022")
    canvas.drawRightString(width - 18 * mm, 8.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUT),
    pagesize=A4,
    leftMargin=18 * mm,
    rightMargin=18 * mm,
    topMargin=14 * mm,
    bottomMargin=18 * mm,
    title="SEBRA STYLE S.R.L. Proforma Invoice PF-2025-0022",
    author="Melisa Bebe Tekstil San. ve Tic. Ltd. Şti.",
)

story = []

brand = Table(
    [[
        P('<font color="#DC2626" size="23"><b>Melisa</b></font><br/><font color="#475569" size="7">BEBE TEKSTİL</font>', "BodyA"),
        P("PROFORMA INVOICE", "TitleP"),
    ]],
    colWidths=[86 * mm, 86 * mm],
)
brand.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LINEBELOW", (0, 0), (-1, -1), 1.2, RED),
]))
story += [brand, Spacer(1, 5 * mm)]

seller = (
    "<b>EXPORTER / SATICI</b><br/>"
    "Melisa Bebe Tekstil San. ve Tic. Ltd. Şti.<br/>"
    "Mühürdar Eminpaşa Sk. Mercan Mah. No:22/A<br/>"
    "Fatih, İstanbul, Türkiye<br/>"
    "Tel: +90 212 595 02 09 | Fax: +90 212 511 19 18<br/>"
    "Tax Office: Hocapaşa | VKN: 6140585769<br/>"
    "MERSİS: 0614058576900012 | Trade Registry: 922791"
)
buyer = (
    "<b>CONSIGNEE / ALICI</b><br/>"
    "SEBRA STYLE S.R.L.<br/>"
    "ILFOV / ILFOV, ROMANIA<br/>"
    "Tax ID: 2222222222<br/>"
    "Party Type: EXPORT<br/>"
    "Full address and telephone: <b>TO BE CONFIRMED</b>"
)
meta = (
    "<b>PROFORMA DETAILS</b><br/>"
    "Proforma No: <b>PF-2025-0022</b><br/>"
    "Date: 03.10.2025<br/>"
    "Valid Until: 10.10.2025<br/>"
    "Reference e-Invoice: IHR2025000000022<br/>"
    "Currency: USD | VAT: 0%"
)
info = Table([[P(seller), P(buyer), P(meta)]], colWidths=[66 * mm, 57 * mm, 49 * mm])
info.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story += [info, Spacer(1, 4 * mm)]

warning = Table([[P(
    "<b>DRAFT / KONTROL:</b> This document is not a tax invoice. The source e-Invoice states FOB with road transport. "
    "The named Incoterm and the consignee's full address must be confirmed by the exporter and freight forwarder before commercial use.",
    "BodySmall",
)]], colWidths=[172 * mm])
warning.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), AMBER),
    ("BOX", (0, 0), (-1, -1), 0.7, AMBER_LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story += [warning, Spacer(1, 4 * mm)]

header = [
    P("NO", "HeaderCell"),
    P("DESCRIPTION / MAL TANIMI", "HeaderCell"),
    P("HS CODE / GTİP", "HeaderCell"),
    P("QTY / ADET", "HeaderCell"),
    P("UNIT PRICE<br/>USD", "HeaderCell"),
    P("AMOUNT<br/>USD", "HeaderCell"),
]
rows = [header]
for index, (description, quantity, unit_price, hs_code) in enumerate(items, start=1):
    amount = Decimal(quantity) * unit_price
    rows.append([
        P(str(index), "CellC"),
        P(description, "Cell"),
        P(hs_code, "CellC"),
        P(qty(quantity), "CellR"),
        P(money(unit_price), "CellR"),
        P(money(amount), "CellR"),
    ])

items_table = LongTable(
    rows,
    repeatRows=1,
    colWidths=[9 * mm, 70 * mm, 31 * mm, 18 * mm, 21 * mm, 23 * mm],
    hAlign="LEFT",
)
items_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 3),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ("TOPPADDING", (0, 0), (-1, 0), 5),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
    ("TOPPADDING", (0, 1), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
    ("ALIGN", (0, 1), (0, -1), "CENTER"),
    ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
]))
story += [items_table, Spacer(1, 5 * mm)]

summary = Table([
    [P("Total quantity / Toplam adet", "TotalLabel"), P(qty(total_qty), "TotalValue")],
    [P("Goods total / Mal hizmet toplamı", "TotalLabel"), P(f"{money(grand_total)} USD", "TotalValue")],
    [P("VAT / KDV (0%)", "TotalLabel"), P("0,00 USD", "TotalValue")],
    [P("TOTAL PAYABLE / ÖDENECEK TUTAR", "TotalLabel"), P(f"{money(grand_total)} USD", "TotalValue")],
], colWidths=[112 * mm, 60 * mm])
summary.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("BOX", (0, 0), (-1, -1), 0.8, NAVY),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ECFDF5")),
]))
story += [summary, Spacer(1, 4 * mm)]

terms_left = (
    "<b>SHIPMENT / SEVKİYAT</b><br/>"
    "Delivery term: FOB (as stated on source e-Invoice)<br/>"
    "Transport mode: Road / Karayolu<br/>"
    "Delivery place: ILFOV, ROMANIA<br/>"
    "Packages: 53 cartons<br/>"
    "Net weight: 2,460 kg | Gross weight: 2,897 kg<br/>"
    "Origin: Türkiye"
)
terms_right = (
    "<b>PAYMENT / BANK</b><br/>"
    "Payment term: TO BE CONFIRMED<br/>"
    "Bank: Kuveyt Türk Katılım Bankası<br/>"
    "USD IBAN: TR04 0020 5000 0910 7244 6001 01<br/>"
    "SWIFT: KTEFTRISXXX<br/>"
    "Export VAT exemption reference: 301 - 11/1-a"
)
terms = Table([[P(terms_left), P(terms_right)]], colWidths=[86 * mm, 86 * mm])
terms.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story += [KeepTogether([terms, Spacer(1, 7 * mm)])]

signature = Table([
    [P("Prepared by / Hazırlayan", "Section"), P("Accepted by buyer / Alıcı onayı", "Section")],
    [P("Name, signature and stamp", "BodySmall"), P("Name, signature and stamp", "BodySmall")],
    [Spacer(1, 14 * mm), Spacer(1, 14 * mm)],
], colWidths=[86 * mm, 86 * mm])
signature.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(signature)

doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
print(OUT.resolve())
