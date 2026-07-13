import json
import tempfile
import unittest
from pathlib import Path

from prepare_go_day import PreparationError, parse_day, prepare_notes


class ParseDayTest(unittest.TestCase):
    def test_accepts_one_explicit_day_and_rejects_guessing_or_ranges(self):
        for request, expected in (
            ("开始 Day 13", 13),
            ("创建 day01 笔记", 1),
            ("prepare DAY-36 notes", 36),
            ("day00", 0),
        ):
            with self.subTest(request=request):
                self.assertEqual(parse_day(request), expected)
        for request in (
            "开始今天",
            "Day 37",
            "Day 1-3",
            "Day 13 and 14",
            "Day 1 和 Day 2",
        ):
            with self.subTest(request=request), self.assertRaises(PreparationError):
                parse_day(request)


class PrepareRouterTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        (self.workspace / "docs").mkdir()
        (self.workspace / "policy").mkdir()
        (self.workspace / "docs/intro.md").write_text("# Intro\n", encoding="utf-8")
        (self.workspace / "policy/evaluation.md").write_text("# Policy\n", encoding="utf-8")
        (self.workspace / "policy/profile.json").write_text(
            '{"schemaVersion":1,"profileId":"go-local","environment":{},"commands":[]}\n',
            encoding="utf-8",
        )
        self.adapter = self.workspace / "adapter.json"
        self.adapter.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "courseId": "go-backend",
                    "lifecycle": "published",
                    "evaluationPolicyPath": "policy/evaluation.md",
                    "commandProfilePath": "policy/profile.json",
                    "defaultObjective": "Learn this lesson.",
                    "defaultGoals": ["Explain it."],
                    "defaultEvaluation": {
                        "competencies": [
                            {
                                "competencyId": "lesson-requirements",
                                "title": "Complete requirements",
                            }
                        ],
                        "requiredEvidence": ["notes"],
                        "scoringBasis": ["accurate"],
                    },
                    "exercisePathMode": "record-root",
                    "lessons": [
                        {
                            "lessonId": "intro",
                            "lifecycle": "active",
                            "day": 0,
                            "title": "Intro",
                            "contentPath": "docs/intro.md",
                            "exerciseTemplatePath": None,
                            "recordPath": "exercise/day0",
                            "evaluationFileName": "notes-eval.md",
                        }
                    ],
                }
            )
            + "\n",
            encoding="utf-8",
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_uses_same_core_for_dry_run_exclusive_create_and_force(self):
        preview = prepare_notes(
            self.workspace,
            "开始 Day 0",
            dry_run=True,
            adapter_path=self.adapter,
        )
        self.assertEqual(preview.status, "preview")
        self.assertIn("go-backend / intro", preview.content)
        self.assertFalse(preview.notes.exists())

        created = prepare_notes(
            self.workspace,
            "开始 Day 0",
            adapter_path=self.adapter,
        )
        self.assertEqual(created.status, "created")
        self.assertTrue(created.notes.is_file())
        self.assertFalse((created.notes.parent / "notes-eval.md").exists())
        with self.assertRaisesRegex(PreparationError, "already exists"):
            prepare_notes(
                self.workspace,
                "开始 Day 0",
                adapter_path=self.adapter,
            )

        replaced = prepare_notes(
            self.workspace,
            "重建 Day 0",
            force=True,
            adapter_path=self.adapter,
        )
        self.assertEqual(replaced.status, "replaced")


if __name__ == "__main__":
    unittest.main()
