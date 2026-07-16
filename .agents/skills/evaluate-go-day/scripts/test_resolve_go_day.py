import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from go_day_test_fixture import write_course_fixture
from resolve_go_day import ResolutionError, resolve_day


class ResolveDayRouterTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name).resolve()
        write_course_fixture(self.workspace, create_notes=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_maps_explicit_day_to_canonical_stable_identity_and_same_core(self):
        result = resolve_day(self.workspace, "day0")

        self.assertEqual(result["courseId"], "go-backend")
        self.assertEqual(result["lessonId"], "intro")
        self.assertEqual(result["day"], "day0")
        self.assertEqual(
            result["course"],
            self.workspace / "courses/go-backend/lessons/intro.md",
        )
        self.assertEqual(
            result["notes"],
            self.workspace / "learning-records/go-backend/lessons/intro/notes.md",
        )
        self.assertEqual(
            result["evaluation"],
            self.workspace
            / "learning-records/go-backend/lessons/intro/evaluation.md",
        )

        canonical_evaluation = (
            "# Evaluation Record\n\n```evaluation-record\n"
            + json.dumps(
                {
                    "schemaVersion": 2,
                    "courseId": "go-backend",
                    "lessonId": "intro",
                    "legacySourceBase64": None,
                    "cycles": [],
                    "events": [],
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n```\n"
        )
        result["evaluation"].write_text(canonical_evaluation, encoding="utf-8")
        evaluation_before = result["evaluation"].read_bytes()
        core = (
            Path(__file__).resolve().parents[2]
            / "evaluate-course-lesson/scripts/evaluation_core.py"
        )
        status = subprocess.run(
            [
                sys.executable,
                str(core),
                "status",
                result["courseId"],
                result["lessonId"],
                "--workspace",
                str(self.workspace),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(status.returncode, 0, status.stderr)
        self.assertEqual(json.loads(status.stdout)["status"], "未开始")
        self.assertEqual(result["evaluation"].read_bytes(), evaluation_before)

    def test_rejects_noncanonical_unknown_or_missing_notes_without_scanning(self):
        for day in ("day00", "day37", "today", "0"):
            with self.subTest(day=day), self.assertRaises(ResolutionError):
                resolve_day(self.workspace, day)
        with self.assertRaisesRegex(ResolutionError, "mapping"):
            resolve_day(self.workspace, "day1")
        notes = self.workspace / "learning-records/go-backend/lessons/intro/notes.md"
        notes.unlink()
        with self.assertRaisesRegex(ResolutionError, "notes"):
            resolve_day(self.workspace, "day0")
        os.symlink(self.workspace / "courses/go-backend/lessons/intro.md", notes)
        with self.assertRaisesRegex(ResolutionError, "symlink"):
            resolve_day(self.workspace, "day0")


class GoCanonicalMappingContractTest(unittest.TestCase):
    def test_committed_course_mapping_is_explicit_complete_and_unique(self):
        course = (
            Path(__file__).resolve().parents[4]
            / "courses/go-backend/course.json"
        )
        value = json.loads(course.read_text(encoding="utf-8"))
        lessons = [
            lesson
            for track in value["tracks"]
            for stage in track["stages"]
            for lesson in stage["lessons"]
        ]
        self.assertEqual(value["courseId"], "go-backend")
        self.assertEqual([lesson["day"] for lesson in lessons], list(range(37)))
        self.assertEqual(len({lesson["lessonId"] for lesson in lessons}), 37)
        self.assertEqual(
            [lesson["contentPath"] for lesson in lessons],
            [f"lessons/{lesson['lessonId']}.md" for lesson in lessons],
        )


if __name__ == "__main__":
    unittest.main()
