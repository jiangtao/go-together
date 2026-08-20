import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
REVIEWER = REPOSITORY_ROOT / "tools" / "codex_issue_reviewer.py"


class CodexIssueReviewerTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temporary_directory.name) / "workspace"
        self.workspace.mkdir()
        self.fake_codex = Path(self.temporary_directory.name) / "codex"
        self.fake_codex.write_text(
            """#!/usr/bin/env python3
import json
import sys
from pathlib import Path

arguments = sys.argv[1:]
output_path = Path(arguments[arguments.index("--output-last-message") + 1])
output_path.write_text(json.dumps({"status": "revision-needed"}), encoding="utf-8")
""",
            encoding="utf-8",
        )
        self.fake_codex.chmod(self.fake_codex.stat().st_mode | stat.S_IXUSR)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_returns_only_a_validated_status_from_codex(self):
        request = {
            "schemaVersion": 1,
            "repository": "learner/private-answers",
            "issueNumber": 42,
            "courseId": "algorithm",
            "lessonId": "arrays-strings-matrices",
            "workspace": str(self.workspace),
        }
        result = subprocess.run(
            [
                sys.executable,
                str(REVIEWER),
                "--workspace",
                str(self.workspace),
                "--codex-bin",
                str(self.fake_codex),
            ],
            input=json.dumps(request, ensure_ascii=False),
            text=True,
            capture_output=True,
            check=False,
            env=os.environ.copy(),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {"status": "revision-needed"})
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main()
