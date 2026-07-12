import tempfile
import unittest
from pathlib import Path

from resolve_go_day import ResolutionError, resolve_day


class ResolveDayTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        self.lessons = self.workspace / "docs/go-learning/daily-lessons"
        self.exercise = self.workspace / "exercise/day0"
        self.lessons.mkdir(parents=True)
        self.exercise.mkdir(parents=True)
        (self.lessons / "day-00-why-go.md").write_text("# Day 00\n", encoding="utf-8")
        (self.exercise / "notes.md").write_text("# Day 0\n", encoding="utf-8")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_resolves_explicit_day(self):
        result = resolve_day(self.workspace, "day0")

        self.assertEqual(result["day"], "day0")
        self.assertEqual(result["course"], (self.lessons / "day-00-why-go.md").resolve())
        self.assertEqual(result["notes"], (self.exercise / "notes.md").resolve())
        self.assertEqual(result["evaluation"], (self.exercise / "notes-eval.md").resolve())

    def test_rejects_noncanonical_or_out_of_range_day(self):
        for day in ("day00", "day37", "today", "0"):
            with self.subTest(day=day), self.assertRaises(ResolutionError):
                resolve_day(self.workspace, day)

    def test_requires_notes_file(self):
        (self.exercise / "notes.md").unlink()

        with self.assertRaisesRegex(ResolutionError, "notes.md"):
            resolve_day(self.workspace, "day0")

    def test_requires_exactly_one_course_file(self):
        (self.lessons / "day-00-second.md").write_text("# Duplicate\n", encoding="utf-8")

        with self.assertRaisesRegex(ResolutionError, "exactly one"):
            resolve_day(self.workspace, "day0")


if __name__ == "__main__":
    unittest.main()
