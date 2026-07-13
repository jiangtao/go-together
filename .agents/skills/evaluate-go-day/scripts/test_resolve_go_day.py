import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from resolve_go_day import ResolutionError, resolve_day


class ResolveDayRouterTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        (self.workspace / "docs").mkdir()
        (self.workspace / "policy").mkdir()
        (self.workspace / "exercise/day0").mkdir(parents=True)
        (self.workspace / "docs/intro.md").write_text("# Intro\n", encoding="utf-8")
        (self.workspace / "policy/evaluation.md").write_text("# Policy\n", encoding="utf-8")
        (self.workspace / "policy/profile.json").write_text(
            '{"schemaVersion":1,"profileId":"go-local","environment":{},"commands":[]}\n',
            encoding="utf-8",
        )
        (self.workspace / "exercise/day0/notes.md").write_text(
            "# Notes\n", encoding="utf-8"
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
                    "defaultObjective": "Learn",
                    "defaultGoals": ["Explain"],
                    "defaultEvaluation": {
                        "competencies": [
                            {
                                "competencyId": "lesson-requirements",
                                "title": "Complete lesson requirements",
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

    def test_maps_explicit_day_to_stable_identity_and_same_core(self):
        result = resolve_day(
            self.workspace, "day0", adapter_path=self.adapter
        )

        self.assertEqual(result["courseId"], "go-backend")
        self.assertEqual(result["lessonId"], "intro")
        self.assertEqual(result["day"], "day0")
        self.assertEqual(result["course"], (self.workspace / "docs/intro.md").resolve())
        self.assertEqual(result["notes"], (self.workspace / "exercise/day0/notes.md").resolve())
        self.assertEqual(
            result["evaluation"],
            (self.workspace / "exercise/day0/notes-eval.md").resolve(),
        )
        self.assertEqual(result["adapter"], self.adapter.resolve())

        legacy_evaluation = (
            "# Legacy Evaluation\n\n- 状态：未开始\n- 参考分数：待评测\n"
        )
        result["evaluation"].write_text(legacy_evaluation, encoding="utf-8")
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
                "--adapter",
                str(result["adapter"]),
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
                resolve_day(self.workspace, day, adapter_path=self.adapter)
        with self.assertRaisesRegex(ResolutionError, "mapping"):
            resolve_day(self.workspace, "day1", adapter_path=self.adapter)
        (self.workspace / "exercise/day0/notes.md").unlink()
        with self.assertRaisesRegex(ResolutionError, "notes"):
            resolve_day(self.workspace, "day0", adapter_path=self.adapter)
        os.symlink(
            self.workspace / "docs/intro.md",
            self.workspace / "exercise/day0/notes.md",
        )
        with self.assertRaisesRegex(ResolutionError, "symlink"):
            resolve_day(self.workspace, "day0", adapter_path=self.adapter)


class GoLegacyMappingContractTest(unittest.TestCase):
    def test_committed_mapping_is_explicit_complete_and_unique(self):
        adapter = (
            Path(__file__).resolve().parents[1]
            / "references/go-backend-legacy-adapter.json"
        )
        value = json.loads(adapter.read_text(encoding="utf-8"))
        lessons = value["lessons"]

        self.assertEqual(value["courseId"], "go-backend")
        self.assertEqual([lesson["day"] for lesson in lessons], list(range(37)))
        self.assertEqual(len({lesson["lessonId"] for lesson in lessons}), 37)
        self.assertEqual(
            [lesson["recordPath"] for lesson in lessons],
            [f"exercise/day{day}" for day in range(37)],
        )


if __name__ == "__main__":
    unittest.main()
