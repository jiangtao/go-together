#!/usr/bin/env python3
"""Smoke tests for build_translated_book.py."""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader
from reportlab.lib.pagesizes import A5, landscape
from reportlab.pdfgen.canvas import Canvas


SCRIPT = Path(__file__).with_name("build_translated_book.py")


class BuildTranslatedBookTests(unittest.TestCase):
    def test_builds_bilingual_and_reading_editions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            translations = root / "translations.md"
            bilingual = root / "bilingual.pdf"
            reading = root / "reading.pdf"

            canvas = Canvas(str(source), pagesize=A5)
            canvas.drawString(40, 500, "ORIGINAL_SENTENCE_ONLY page one")
            canvas.showPage()
            canvas.setPageSize(landscape(A5))
            canvas.drawString(40, 250, "ORIGINAL_SENTENCE_ONLY page two")
            canvas.save()

            translations.write_text(
                """## Page 1

# 完整中文译文

这是第一页，保留 API 与 `exampleFunction`。

## Page 2

### 第二页

- TARGET_TRANSLATION_ONLY
""",
                encoding="utf-8",
            )

            common = [
                sys.executable,
                str(SCRIPT),
                "--source",
                str(source),
                "--translations",
                str(translations),
                "--term-note",
                "保留 API",
            ]
            subprocess.run(
                [*common, "--output", str(bilingual), "--mode", "bilingual"],
                check=True,
                capture_output=True,
                text=True,
            )
            subprocess.run(
                [
                    *common,
                    "--output",
                    str(reading),
                    "--mode",
                    "reading",
                    "--translation-header",
                    "中文阅读版",
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            bilingual_reader = PdfReader(str(bilingual))
            reading_reader = PdfReader(str(reading))
            self.assertEqual(len(bilingual_reader.pages), 2)
            self.assertEqual(len(reading_reader.pages), 2)
            self.assertGreater(
                float(bilingual_reader.pages[0].mediabox.width),
                float(bilingual_reader.pages[0].mediabox.height),
            )
            self.assertLess(
                float(reading_reader.pages[0].mediabox.width),
                float(reading_reader.pages[0].mediabox.height),
            )

            bilingual_text = "\n".join(
                page.extract_text() or "" for page in bilingual_reader.pages
            )
            reading_text = "\n".join(
                page.extract_text() or "" for page in reading_reader.pages
            )
            self.assertIn("ORIGINAL_SENTENCE_ONLY", bilingual_text)
            self.assertIn("完整中文译文", reading_text)
            self.assertIn("TARGET_TRANSLATION_ONLY", reading_text)
            self.assertNotIn("ORIGINAL_SENTENCE_ONLY", reading_text)


if __name__ == "__main__":
    unittest.main()
