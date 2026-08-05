#!/usr/bin/env python3
"""Build page-aligned bilingual or target-language-only PDF book editions."""

from __future__ import annotations

import argparse
import copy
import html
import io
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, A5, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


FONT_PAIRS = (
    (
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
    ),
    (
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ),
    (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    ),
    (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--translations", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=("bilingual", "reading"), required=True)
    parser.add_argument("--title")
    parser.add_argument("--language", default="中文")
    parser.add_argument("--translation-header", default="中文译文")
    parser.add_argument("--source-header", default="英文原页")
    parser.add_argument("--page-label-template", default="原书第 {page} 页")
    parser.add_argument(
        "--term-note",
        default="关键术语、产品名称、代码与标识符保留英文",
    )
    parser.add_argument("--blank-page-note", default="")
    parser.add_argument("--regular-font", type=Path)
    parser.add_argument("--bold-font", type=Path)
    return parser.parse_args()


def choose_fonts(regular: Path | None, bold: Path | None) -> tuple[Path, Path]:
    if regular:
        bold = bold or regular
        if not regular.is_file() or not bold.is_file():
            raise FileNotFoundError("指定的 regular/bold 字体不存在")
        return regular, bold
    for regular_name, bold_name in FONT_PAIRS:
        regular_path = Path(regular_name)
        bold_path = Path(bold_name)
        if regular_path.is_file() and bold_path.is_file():
            return regular_path, bold_path
    raise FileNotFoundError(
        "未找到可用字体；请使用 --regular-font 与 --bold-font 指定 TTF/TTC"
    )


def register_fonts(regular: Path, bold: Path) -> None:
    pdfmetrics.registerFont(
        TTFont("TranslationRegular", str(regular), subfontIndex=0)
    )
    pdfmetrics.registerFont(TTFont("TranslationBold", str(bold), subfontIndex=0))


def parse_translation_pages(markdown: str, page_count: int) -> dict[int, str]:
    matches = list(re.finditer(r"^## Page (\d+)\s*$", markdown, re.MULTILINE))
    pages: dict[int, str] = {}
    duplicate_pages: set[int] = set()
    for index, match in enumerate(matches):
        page_number = int(match.group(1))
        if page_number in pages:
            duplicate_pages.add(page_number)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        pages[page_number] = markdown[start:end].strip()

    expected = set(range(1, page_count + 1))
    missing = sorted(expected - set(pages))
    extra = sorted(set(pages) - expected)
    if duplicate_pages or missing or extra:
        raise ValueError(
            "译文页映射无效："
            f"duplicates={sorted(duplicate_pages)}, missing={missing}, extra={extra}"
        )
    return pages


def inline_markup(value: str) -> str:
    value = html.escape(value, quote=False)
    value = re.sub(
        r"`([^`]+)`",
        r'<font name="TranslationRegular" color="#0F766E">\1</font>',
        value,
    )
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    return value


def parse_blocks(markdown: str) -> list[tuple[str, str]]:
    if not markdown.strip():
        return []
    result: list[tuple[str, str]] = []
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            result.append(("body", " ".join(paragraph)))
            paragraph.clear()

    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            flush()
        elif line.startswith("### "):
            flush()
            result.append(("h2", line[4:].strip()))
        elif line.startswith("## "):
            flush()
            result.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            flush()
            result.append(("h1", line[2:].strip()))
        elif line.startswith("- "):
            flush()
            result.append(("bullet", line[2:].strip()))
        elif re.match(r"^\d+\. ", line):
            flush()
            result.append(("number", line))
        else:
            paragraph.append(line)
    flush()
    return result


def paragraph_styles(font_size: float) -> dict[str, ParagraphStyle]:
    leading = font_size * 1.48
    shared = {
        "fontName": "TranslationRegular",
        "fontSize": font_size,
        "leading": leading,
        "textColor": colors.HexColor("#23262B"),
        "alignment": TA_LEFT,
        "wordWrap": "CJK",
        "splitLongWords": True,
    }
    return {
        "body": ParagraphStyle(
            "body",
            **shared,
            spaceAfter=font_size * 0.65,
        ),
        "h1": ParagraphStyle(
            "h1",
            **{
                **shared,
                "fontName": "TranslationBold",
                "fontSize": font_size * 1.48,
                "leading": font_size * 1.8,
                "textColor": colors.HexColor("#0F172A"),
            },
            spaceBefore=font_size * 0.25,
            spaceAfter=font_size * 0.8,
        ),
        "h2": ParagraphStyle(
            "h2",
            **{
                **shared,
                "fontName": "TranslationBold",
                "fontSize": font_size * 1.12,
                "leading": font_size * 1.5,
                "textColor": colors.HexColor("#1D4ED8"),
            },
            spaceBefore=font_size * 0.45,
            spaceAfter=font_size * 0.4,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            **shared,
            leftIndent=12,
            firstLineIndent=-8,
            bulletIndent=0,
            spaceAfter=font_size * 0.3,
        ),
        "number": ParagraphStyle(
            "number",
            **shared,
            leftIndent=12,
            firstLineIndent=-12,
            spaceAfter=font_size * 0.3,
        ),
    }


def make_flowables(markdown: str, font_size: float) -> list[Paragraph]:
    styles = paragraph_styles(font_size)
    flowables: list[Paragraph] = []
    for kind, value in parse_blocks(markdown):
        value = inline_markup(value)
        if kind == "bullet":
            value = f"• {value}"
        flowables.append(Paragraph(value, styles[kind]))
    return flowables


def flowables_height(flowables: list[Paragraph], width: float) -> float:
    height = 0.0
    for flowable in flowables:
        _, item_height = flowable.wrap(width, 10000)
        height += item_height
        height += getattr(flowable.style, "spaceBefore", 0)
        height += getattr(flowable.style, "spaceAfter", 0)
    return height


def fit_flowables(markdown: str, width: float, height: float) -> list[Paragraph]:
    for font_size in (10.5, 10.0, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.5):
        flowables = make_flowables(markdown, font_size)
        if flowables_height(flowables, width) <= height:
            return flowables
    raise ValueError("单页译文过长，即使使用 6.5pt 字体也无法容纳")


def draw_flowables(
    canvas: Canvas,
    markdown: str,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    flowables = fit_flowables(markdown, width, height)
    cursor_y = top
    bottom = top - height
    for flowable in flowables:
        cursor_y -= getattr(flowable.style, "spaceBefore", 0)
        _, item_height = flowable.wrap(width, cursor_y - bottom)
        flowable.drawOn(canvas, x, cursor_y - item_height)
        cursor_y -= item_height + getattr(flowable.style, "spaceAfter", 0)


def draw_translation_panel(
    canvas: Canvas,
    markdown: str,
    page_number: int,
    page_width: float,
    page_height: float,
    panel_x: float,
    panel_width: float,
    translation_header: str,
    page_label_template: str,
    term_note: str,
    blank_page_note: str,
) -> None:
    header_y = page_height - 9 * mm
    content_top = page_height - 14 * mm
    content_bottom = 12 * mm
    canvas.setFillColor(colors.HexColor("#F8FAFC"))
    canvas.rect(panel_x - 4 * mm, 0, panel_width + 8 * mm, page_height, 0, 1)

    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.setFont("TranslationBold", 7.6)
    canvas.drawString(panel_x, header_y, translation_header)
    canvas.setFont("TranslationRegular", 7.2)
    canvas.drawRightString(
        panel_x + panel_width,
        header_y,
        page_label_template.format(page=page_number),
    )

    if markdown.strip():
        draw_flowables(
            canvas,
            markdown,
            panel_x,
            content_top - 3 * mm,
            panel_width,
            content_top - content_bottom - 4 * mm,
        )
    elif blank_page_note:
        canvas.setFillColor(colors.HexColor("#94A3B8"))
        canvas.setFont("TranslationRegular", 9)
        canvas.drawCentredString(
            panel_x + panel_width / 2,
            page_height / 2,
            blank_page_note,
        )

    if term_note:
        canvas.setFillColor(colors.HexColor("#94A3B8"))
        canvas.setFont("TranslationRegular", 6.7)
        canvas.drawRightString(panel_x + panel_width, 6 * mm, term_note)


def translation_page_bytes(
    markdown: str,
    page_number: int,
    page_size: tuple[float, float],
    panel_x: float,
    panel_width: float,
    args: argparse.Namespace,
) -> bytes:
    stream = io.BytesIO()
    page_width, page_height = page_size
    canvas = Canvas(stream, pagesize=page_size, pageCompression=1)
    draw_translation_panel(
        canvas,
        markdown,
        page_number,
        page_width,
        page_height,
        panel_x,
        panel_width,
        args.translation_header,
        args.page_label_template,
        args.term_note,
        args.blank_page_note,
    )
    canvas.save()
    return stream.getvalue()


def add_metadata(writer: PdfWriter, args: argparse.Namespace) -> None:
    title = args.title or args.source.stem
    writer.add_metadata(
        {
            "/Title": title,
            "/Subject": f"{args.language} translated edition",
            "/Keywords": "PDF, translation, bilingual, translated book",
        }
    )


def build_reading(
    source: PdfReader,
    translations: dict[int, str],
    args: argparse.Namespace,
) -> None:
    page_width, page_height = A5
    margin = 12 * mm
    panel_width = page_width - 2 * margin
    writer = PdfWriter()
    add_metadata(writer, args)
    for page_number in range(1, len(source.pages) + 1):
        page_bytes = translation_page_bytes(
            translations[page_number],
            page_number,
            A5,
            margin,
            panel_width,
            args,
        )
        writer.add_page(PdfReader(io.BytesIO(page_bytes)).pages[0])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as handle:
        writer.write(handle)


def build_bilingual(
    source: PdfReader,
    translations: dict[int, str],
    args: argparse.Namespace,
) -> None:
    page_width, page_height = landscape(A4)
    margin = 12 * mm
    gutter = 8 * mm
    half_width = (page_width - 2 * margin - gutter) / 2
    left_x = margin
    right_x = margin + half_width + gutter
    content_top = page_height - 14 * mm
    content_bottom = 12 * mm
    content_height = content_top - content_bottom

    writer = PdfWriter()
    add_metadata(writer, args)
    for page_number, original in enumerate(source.pages, start=1):
        overlay_bytes = translation_page_bytes(
            translations[page_number],
            page_number,
            (page_width, page_height),
            right_x,
            half_width,
            args,
        )
        output_page = PdfReader(io.BytesIO(overlay_bytes)).pages[0]
        source_page = copy.deepcopy(original)
        if source_page.rotation:
            source_page.transfer_rotation_to_content()
        source_width = float(source_page.mediabox.width)
        source_height = float(source_page.mediabox.height)
        source_left = float(source_page.mediabox.left)
        source_bottom = float(source_page.mediabox.bottom)
        scale = min(half_width / source_width, content_height / source_height)
        draw_width = source_width * scale
        draw_height = source_height * scale
        target_x = left_x + (half_width - draw_width) / 2
        target_y = content_bottom + (content_height - draw_height) / 2
        transform = Transformation().scale(scale).translate(
            target_x - source_left * scale,
            target_y - source_bottom * scale,
        )
        output_page.merge_transformed_page(
            source_page,
            transform,
            over=True,
            expand=False,
        )

        frame_stream = io.BytesIO()
        frame = Canvas(frame_stream, pagesize=(page_width, page_height), pageCompression=1)
        frame.setStrokeColor(colors.HexColor("#CBD5E1"))
        frame.setLineWidth(0.5)
        frame.rect(target_x, target_y, draw_width, draw_height, 1, 0)
        frame.line(
            right_x - gutter / 2,
            margin,
            right_x - gutter / 2,
            page_height - margin,
        )
        frame.setFillColor(colors.HexColor("#64748B"))
        frame.setFont("TranslationBold", 7.6)
        frame.drawString(left_x, page_height - 9 * mm, args.source_header)
        frame.save()
        output_page.merge_page(
            PdfReader(io.BytesIO(frame_stream.getvalue())).pages[0],
            over=True,
        )
        writer.add_page(output_page)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as handle:
        writer.write(handle)


def validate_output(output: Path, expected_pages: int) -> None:
    result = PdfReader(str(output))
    if len(result.pages) != expected_pages:
        raise ValueError(
            f"输出页数错误：expected={expected_pages}, actual={len(result.pages)}"
        )


def main() -> None:
    args = parse_args()
    regular, bold = choose_fonts(args.regular_font, args.bold_font)
    register_fonts(regular, bold)
    source = PdfReader(str(args.source))
    translations = parse_translation_pages(
        args.translations.read_text(encoding="utf-8"),
        len(source.pages),
    )
    if args.mode == "bilingual":
        build_bilingual(source, translations, args)
    else:
        build_reading(source, translations, args)
    validate_output(args.output, len(source.pages))
    print(args.output.resolve())


if __name__ == "__main__":
    main()
