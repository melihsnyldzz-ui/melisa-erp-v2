from __future__ import annotations

import argparse
import io
import json
import os
from collections import OrderedDict
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


PAGE_W, PAGE_H = A4
RED = HexColor('#D92D32')
DARK = HexColor('#172033')
INK = HexColor('#253044')
MUTED = HexColor('#697386')
LINE = HexColor('#E4E8EF')
CREAM = HexColor('#FFF8F4')
SOFT_RED = HexColor('#FDEBEC')
GREEN = HexColor('#15845A')
SOFT_GREEN = HexColor('#E9F7F0')
WHITE = white


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont('CatalogRegular', r'C:\Windows\Fonts\arial.ttf'))
    pdfmetrics.registerFont(TTFont('CatalogBold', r'C:\Windows\Fonts\arialbd.ttf'))


def tr_money(value: float, currency: str) -> str:
    formatted = f'{float(value):,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    symbol = {'USD': '$', 'EUR': '€', 'TRY': '₺'}.get(currency, currency)
    return f'{symbol}{formatted}'


def fit_text(text: str, font: str, size: float, max_width: float, max_lines: int = 2) -> list[str]:
    words = str(text or '').split()
    if not words:
        return ['']
    lines: list[str] = []
    current = ''
    for word in words:
        candidate = f'{current} {word}'.strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) == max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    consumed = ' '.join(lines)
    if len(consumed) < len(' '.join(words)) and lines:
        while lines[-1] and pdfmetrics.stringWidth(f'{lines[-1]}…', font, size) > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = f'{lines[-1]}…'
    return lines


def display_product_name(item: dict) -> str:
    return str(item.get('customerFacingName') or item.get('productName') or '')


def rounded_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=LINE, radius=12) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def image_reader(path: Path, width: int = 1000, height: int = 1000, background=(255, 255, 255)) -> ImageReader:
    with Image.open(path) as source:
        source = ImageOps.exif_transpose(source).convert('RGB')
        source.thumbnail((width, height), Image.Resampling.LANCZOS)
        stage = Image.new('RGB', (width, height), background)
        x = (width - source.width) // 2
        y = (height - source.height) // 2
        stage.paste(source, (x, y))
        buffer = io.BytesIO()
        stage.save(buffer, format='JPEG', quality=92, optimize=True)
        buffer.seek(0)
        return ImageReader(buffer)


def draw_logo(c: canvas.Canvas, logo: Path, x: float, y: float, w: float, h: float) -> None:
    c.drawImage(str(logo), x, y, width=w, height=h, preserveAspectRatio=True, anchor='c', mask='auto')


def draw_page_footer(c: canvas.Canvas, page_number: int, generated_date: str) -> None:
    c.setStrokeColor(LINE)
    c.line(28, 24, PAGE_W - 28, 24)
    c.setFont('CatalogRegular', 7.2)
    c.setFillColor(MUTED)
    c.drawString(28, 12, f'Fiyatlar {generated_date} tarihindeki ERP satış fiyatlarıdır. Siparişte stok ve fiyat teyidi yapılır.')
    c.drawRightString(PAGE_W - 28, 12, str(page_number))


def draw_cover(c: canvas.Canvas, logo: Path, products: list[dict], image_root: Path) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(RED)
    c.rect(0, PAGE_H - 18, PAGE_W, 18, fill=1, stroke=0)
    draw_logo(c, logo, 42, PAGE_H - 145, 210, 95)

    c.setFillColor(DARK)
    c.setFont('CatalogBold', 27)
    c.drawString(42, PAGE_H - 205, 'TOPTAN ÜRÜN')
    c.setFillColor(RED)
    c.drawString(42, PAGE_H - 239, 'KATALOĞU')
    c.setFillColor(MUTED)
    c.setFont('CatalogRegular', 11)
    c.drawString(43, PAGE_H - 266, '30 seçili ürün  •  5 güçlü marka  •  Güncel ERP fiyatları')

    tile_w, tile_h, gap = 160, 170, 9
    start_x, start_y = 42, 80
    hero_items = products[:6]
    for index, item in enumerate(hero_items):
        col, row = index % 3, index // 3
        x = start_x + col * (tile_w + gap)
        y = start_y + (1 - row) * (tile_h + gap)
        rounded_box(c, x, y, tile_w, tile_h, WHITE, WHITE, 14)
        product_path = image_root / item['imagePath'].lstrip('/').replace('/', os.sep)
        c.drawImage(image_reader(product_path, 700, 700, (255, 255, 255)), x + 7, y + 7, tile_w - 14, tile_h - 14)

    c.setFillColor(DARK)
    c.setFont('CatalogBold', 11)
    c.drawString(42, 47, 'MELİSA BABY WHOLESALE')
    c.setFont('CatalogRegular', 8.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - 42, 47, 'İstanbul • Türkiye')
    c.showPage()


def draw_intro(c: canvas.Canvas, logo: Path, payload: dict, generated_date: str) -> None:
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_logo(c, logo, 34, PAGE_H - 98, 140, 60)
    c.setFillColor(DARK)
    c.setFont('CatalogBold', 22)
    c.drawString(34, PAGE_H - 142, 'Yeni sezon için seçili ürünler')
    c.setFont('CatalogRegular', 10.5)
    c.setFillColor(MUTED)
    c.drawString(34, PAGE_H - 164, 'Görselli aktif ürünler arasından, stok ve satış verileri dikkate alınarak hazırlandı.')

    rounded_box(c, 34, PAGE_H - 292, PAGE_W - 68, 96, CREAM, HexColor('#F4D7CD'), 14)
    c.setFillColor(DARK)
    c.setFont('CatalogBold', 12)
    c.drawString(50, PAGE_H - 222, 'Bu katalogda neler var?')
    c.setFont('CatalogRegular', 9.5)
    c.setFillColor(INK)
    lines = [
        '• 30 seçili ve stokta bulunan ürün',
        '• Ürün kodu, marka, kategori ve satış fiyatı',
        '• Siparişi hızlandıran net ürün kartları',
        '• WhatsApp üzerinden kolay teyit ve sipariş desteği',
    ]
    for index, line in enumerate(lines):
        c.drawString(50, PAGE_H - 244 - index * 15, line)

    c.setFillColor(DARK)
    c.setFont('CatalogBold', 13)
    c.drawString(34, PAGE_H - 332, 'Katalog markaları')
    x, y = 34, PAGE_H - 378
    for brand in payload['topBrands']:
        label = brand['brand']
        width = pdfmetrics.stringWidth(label, 'CatalogBold', 9) + 28
        if x + width > PAGE_W - 34:
            x, y = 34, y - 42
        rounded_box(c, x, y, width, 30, SOFT_RED, HexColor('#F5C6C8'), 15)
        c.setFillColor(RED)
        c.setFont('CatalogBold', 9)
        c.drawCentredString(x + width / 2, y + 10, label)
        x += width + 8

    rounded_box(c, 34, 182, PAGE_W - 68, 175, HexColor('#F7F9FC'), LINE, 14)
    c.setFillColor(DARK)
    c.setFont('CatalogBold', 13)
    c.drawString(50, 330, 'Siparişinizi nasıl oluşturabilirsiniz?')
    steps = [
        ('1', 'Ürün kodunu seçin', 'Beğendiğiniz ürünün stok kodunu not edin.'),
        ('2', 'WhatsApp’tan iletin', 'Kodları ve istediğiniz miktarları bize gönderin.'),
        ('3', 'Stok ve fiyat teyidi', 'Ekibimiz güncel uygunluğu kontrol ederek dönüş yapsın.'),
    ]
    for index, (number, title, body) in enumerate(steps):
        yy = 286 - index * 45
        c.setFillColor(RED)
        c.circle(64, yy + 7, 13, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('CatalogBold', 9)
        c.drawCentredString(64, yy + 4, number)
        c.setFillColor(DARK)
        c.setFont('CatalogBold', 9.5)
        c.drawString(86, yy + 9, title)
        c.setFillColor(MUTED)
        c.setFont('CatalogRegular', 8.5)
        c.drawString(86, yy - 4, body)

    c.setFillColor(RED)
    c.setFont('CatalogBold', 11)
    c.drawString(34, 142, 'Önemli bilgi')
    c.setFillColor(MUTED)
    c.setFont('CatalogRegular', 8.5)
    c.drawString(34, 124, 'Fiyatlar ürünün kendi para birimindedir; alış/maliyet bilgisi içermez.')
    c.drawString(34, 110, 'Katalog anlık ERP verisiyle hazırlanmıştır. Kesin stok ve fiyat sipariş sırasında teyit edilir.')
    draw_page_footer(c, 2, generated_date)
    c.showPage()


def draw_product_card(c: canvas.Canvas, item: dict, image_root: Path, x: float, y: float, w: float, h: float) -> None:
    rounded_box(c, x, y, w, h, WHITE, LINE, 12)
    image_h = 143
    c.setFillColor(HexColor('#FAFBFD'))
    c.roundRect(x + 7, y + h - image_h - 7, w - 14, image_h, 9, fill=1, stroke=0)
    product_path = image_root / item['imagePath'].lstrip('/').replace('/', os.sep)
    c.drawImage(image_reader(product_path, 900, 700, (250, 251, 253)), x + 9, y + h - image_h - 5, w - 18, image_h - 4)

    badge_w = 48
    c.setFillColor(SOFT_GREEN)
    c.roundRect(x + w - badge_w - 12, y + h - 25, badge_w, 15, 7.5, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont('CatalogBold', 6.8)
    c.drawCentredString(x + w - badge_w / 2 - 12, y + h - 20, 'STOKTA')

    text_x = x + 12
    text_w = w - 24
    name_y = y + h - image_h - 23
    c.setFillColor(DARK)
    c.setFont('CatalogBold', 9.1)
    for line_index, line in enumerate(fit_text(display_product_name(item), 'CatalogBold', 9.1, text_w, 2)):
        c.drawString(text_x, name_y - line_index * 11, line)

    detail_y = y + 42
    c.setFillColor(MUTED)
    c.setFont('CatalogRegular', 7.4)
    code_text = f"Kod: {item['stockCode']}"
    c.drawString(text_x, detail_y + 17, fit_text(code_text, 'CatalogRegular', 7.4, text_w - 4, 1)[0])
    category = str(item.get('category') or 'Genel koleksiyon').strip()
    c.drawString(text_x, detail_y + 5, fit_text(category, 'CatalogRegular', 7.4, text_w - 4, 1)[0])
    c.setFillColor(RED)
    c.setFont('CatalogBold', 14)
    c.drawRightString(x + w - 12, y + 14, tr_money(item['salePrice'], item['currency']))


def draw_product_pages(c: canvas.Canvas, products: list[dict], image_root: Path, generated_date: str, start_page: int) -> int:
    grouped: OrderedDict[str, list[dict]] = OrderedDict()
    for product in products:
        grouped.setdefault(product['brand'], []).append(product)

    page_number = start_page
    for brand, items in grouped.items():
        for chunk_start in range(0, len(items), 6):
            chunk = items[chunk_start:chunk_start + 6]
            c.setFillColor(WHITE)
            c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            c.setFillColor(DARK)
            c.setFont('CatalogBold', 19)
            c.drawString(28, PAGE_H - 43, brand)
            c.setFillColor(MUTED)
            c.setFont('CatalogRegular', 8.5)
            c.drawString(28, PAGE_H - 58, 'Seçili toptan ürünler')
            c.setFillColor(RED)
            c.roundRect(PAGE_W - 118, PAGE_H - 58, 90, 24, 12, fill=1, stroke=0)
            c.setFillColor(WHITE)
            c.setFont('CatalogBold', 8)
            c.drawCentredString(PAGE_W - 73, PAGE_H - 50, f'{len(items)} ÜRÜN')

            margin, gap_x, gap_y = 28, 12, 11
            card_w = (PAGE_W - 2 * margin - gap_x) / 2
            card_h = 231
            top_y = PAGE_H - 79
            for index, item in enumerate(chunk):
                col, row = index % 2, index // 2
                x = margin + col * (card_w + gap_x)
                y = top_y - (row + 1) * card_h - row * gap_y
                draw_product_card(c, item, image_root, x, y, card_w, card_h)

            draw_page_footer(c, page_number, generated_date)
            c.showPage()
            page_number += 1
    return page_number


def draw_back_cover(c: canvas.Canvas, logo: Path, generated_date: str, page_number: int) -> None:
    c.setFillColor(DARK)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(RED)
    c.circle(PAGE_W - 45, PAGE_H - 45, 105, fill=1, stroke=0)
    c.setFillColor(Color(1, 1, 1, alpha=0.06))
    c.circle(55, 85, 145, fill=1, stroke=0)
    rounded_box(c, 120, PAGE_H - 236, PAGE_W - 240, 118, WHITE, WHITE, 18)
    draw_logo(c, logo, 138, PAGE_H - 220, PAGE_W - 276, 86)
    c.setFillColor(WHITE)
    c.setFont('CatalogBold', 24)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 310, 'Siparişinizi birlikte hazırlayalım')
    c.setFont('CatalogRegular', 11)
    c.setFillColor(HexColor('#CBD2DE'))
    c.drawCentredString(PAGE_W / 2, PAGE_H - 339, 'Beğendiğiniz ürün kodlarını WhatsApp üzerinden bize iletin.')

    rounded_box(c, 70, 260, PAGE_W - 140, 205, HexColor('#222D43'), HexColor('#35415A'), 18)
    contacts = [
        ('WhatsApp', '+90 543 519 50 29'),
        ('Web', 'www.melisababy.com'),
        ('E-posta', 'info@melisababy.com'),
        ('Instagram', '@melisababy.wholesale'),
        ('Adres', 'Mercan Mah. Mühürdar Eminpaşa Sok. No:22/A Fatih / İstanbul'),
    ]
    for index, (label, value) in enumerate(contacts):
        yy = 425 - index * 35
        c.setFillColor(HexColor('#AEB8C9'))
        c.setFont('CatalogBold', 7.5)
        c.drawString(92, yy, label.upper())
        c.setFillColor(WHITE)
        c.setFont('CatalogRegular', 10)
        c.drawString(178, yy, value)

    c.setFillColor(HexColor('#9AA6B9'))
    c.setFont('CatalogRegular', 7.5)
    c.drawCentredString(PAGE_W / 2, 44, f'Melisa Baby Wholesale • {generated_date} • {page_number}')
    c.showPage()


def build_catalog(selection: Path, output: Path, logo: Path, image_root: Path) -> None:
    payload = json.loads(selection.read_text(encoding='utf-8'))
    products = payload['products']
    if len(products) != 30:
        raise ValueError(f'Catalog requires exactly 30 products, found {len(products)}')
    generated_date = datetime.fromisoformat(payload['generatedAt'].replace('Z', '+00:00')).strftime('%d.%m.%Y')
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    c.setTitle('Melisa Baby Toptan Ürün Kataloğu')
    c.setAuthor('Melisa Baby Wholesale')
    c.setSubject('30 seçili ürün ve güncel ERP satış fiyatları')
    draw_cover(c, logo, products, image_root)
    draw_intro(c, logo, payload, generated_date)
    next_page = draw_product_pages(c, products, image_root, generated_date, 3)
    draw_back_cover(c, logo, generated_date, next_page)
    c.save()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--selection', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--logo', type=Path, required=True)
    parser.add_argument('--image-root', type=Path, required=True)
    return parser.parse_args()


if __name__ == '__main__':
    register_fonts()
    args = parse_args()
    build_catalog(args.selection, args.output, args.logo, args.image_root)
