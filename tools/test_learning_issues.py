import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
TOOL = REPOSITORY_ROOT / "tools" / "learning_issues.py"


class LearningIssuesCliTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temporary_directory.name)
        self.config = self.workspace / "answer-issues.json"
        self.gh_log = self.workspace / "gh-log.jsonl"
        self.fake_bin = self.workspace / "bin"
        self.fake_bin.mkdir()
        self._write_course_fixture()
        self._write_config()
        self._write_fake_gh()

    def tearDown(self):
        self.temporary_directory.cleanup()

    def _write_course_fixture(self):
        course_directory = self.workspace / "courses" / "algorithm-review"
        course_directory.mkdir(parents=True)
        (course_directory / "course.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "courseId": "algorithm-review",
                    "lifecycle": "published",
                    "tracks": [
                        {
                            "trackId": "core",
                            "stages": [
                                {
                                    "stageId": "arrays",
                                    "lessons": [
                                        {
                                            "lessonId": "arrays-strings-matrices",
                                            "lifecycle": "active",
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

    def _write_config(self, reviewer_command=None):
        payload = {
            "schemaVersion": 1,
            "targetRepository": "learner/private-answers",
        }
        if reviewer_command is not None:
            payload["reviewerCommand"] = reviewer_command
        self.config.write_text(json.dumps(payload), encoding="utf-8")

    def _write_fake_gh(self):
        fake_gh = self.fake_bin / "gh"
        fake_gh.write_text(
            """#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

args = sys.argv[1:]
log_path = Path(os.environ["LEARNING_ISSUES_FAKE_GH_LOG"])
with log_path.open("a", encoding="utf-8") as stream:
    stream.write(json.dumps(args, ensure_ascii=False) + "\\n")

if args[:2] == ["auth", "status"]:
    raise SystemExit(0)
if args[:2] == ["repo", "view"]:
    print(os.environ.get("LEARNING_ISSUES_FAKE_REPOSITORY", json.dumps({"nameWithOwner": "learner/private-answers", "isPrivate": True, "hasIssuesEnabled": True})))
    raise SystemExit(0)
if args[:2] == ["label", "create"]:
    raise SystemExit(0)
if args[:2] == ["issue", "list"]:
    print(os.environ.get("LEARNING_ISSUES_FAKE_ISSUES", "[]"))
    raise SystemExit(0)
if args[:2] == ["issue", "create"]:
    print("https://github.com/learner/private-answers/issues/42")
    raise SystemExit(0)
if args[:2] == ["issue", "view"]:
    print(os.environ["LEARNING_ISSUES_FAKE_VIEW"])
    raise SystemExit(0)
if args[:2] in (["issue", "edit"], ["issue", "comment"]):
    raise SystemExit(0)
raise SystemExit(91)
""",
            encoding="utf-8",
        )
        fake_gh.chmod(fake_gh.stat().st_mode | stat.S_IXUSR)
        fake_crontab = self.fake_bin / "crontab"
        fake_crontab.write_text(
            """#!/usr/bin/env python3
import os
import sys
from pathlib import Path

path = Path(os.environ["LEARNING_ISSUES_FAKE_CRONTAB"])
if sys.argv[1:] == ["-l"]:
    if path.exists():
        sys.stdout.write(path.read_text(encoding="utf-8"))
        raise SystemExit(0)
    raise SystemExit(1)
if sys.argv[1:] == ["-"]:
    path.write_text(sys.stdin.read(), encoding="utf-8")
    raise SystemExit(0)
raise SystemExit(91)
""",
            encoding="utf-8",
        )
        fake_crontab.chmod(fake_crontab.stat().st_mode | stat.S_IXUSR)

    def _environment(self, **extra):
        environment = os.environ.copy()
        environment.update(
            {
                "PATH": f"{self.fake_bin}{os.pathsep}{environment['PATH']}",
                "LEARNING_ISSUES_FAKE_GH_LOG": str(self.gh_log),
                "LEARNING_ISSUES_FAKE_CRONTAB": str(self.workspace / "crontab"),
            }
        )
        environment.update(extra)
        return environment

    def _run(self, *arguments, environment=None):
        return subprocess.run(
            [sys.executable, str(TOOL), *arguments],
            cwd=self.workspace,
            env=environment or self._environment(),
            text=True,
            capture_output=True,
            check=False,
        )

    def _gh_calls(self):
        if not self.gh_log.exists():
            return []
        return [
            json.loads(line)
            for line in self.gh_log.read_text(encoding="utf-8").splitlines()
        ]

    def _issue(self, *, number=42, status="answer:open", answer=""):
        metadata = {
            "schemaVersion": 1,
            "courseId": "algorithm-review",
            "lessonId": "arrays-strings-matrices",
            "status": status,
        }
        labels = [status]
        return {
            "number": number,
            "url": f"https://github.com/learner/private-answers/issues/{number}",
            "body": (
                "<!-- go-together-answer: "
                + json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
                + " -->\n\n## 学习者回答\n"
                + answer
            ),
            "labels": [{"name": label} for label in labels],
        }

    def test_open_validates_stable_identity_and_creates_a_protocol_issue(self):
        result = self._run(
            "open",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--course-id",
            "algorithm-review",
            "--lesson-id",
            "arrays-strings-matrices",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["action"], "created")
        self.assertEqual(payload["issueNumber"], 42)
        calls = self._gh_calls()
        create_call = next(call for call in calls if call[:2] == ["issue", "create"])
        body = create_call[create_call.index("--body") + 1]
        self.assertIn('"courseId":"algorithm-review"', body)
        self.assertIn('"lessonId":"arrays-strings-matrices"', body)
        self.assertIn("## 学习者回答", body)
        self.assertNotIn("标准答案", body)

    def test_open_reuses_the_only_matching_active_issue(self):
        issue = self._issue()
        result = self._run(
            "open",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--course-id",
            "algorithm-review",
            "--lesson-id",
            "arrays-strings-matrices",
            environment=self._environment(
                LEARNING_ISSUES_FAKE_ISSUES=json.dumps([issue], ensure_ascii=False)
            ),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["action"], "reused")
        self.assertFalse(
            any(call[:2] == ["issue", "create"] for call in self._gh_calls())
        )

    def test_open_ignores_unrelated_issues_in_the_configured_private_repository(self):
        unrelated_issue = {
            "number": 7,
            "url": "https://github.com/learner/private-answers/issues/7",
            "body": "# 私人备忘\n\n不是课程答题 Issue。",
            "labels": [{"name": "question"}],
        }
        result = self._run(
            "open",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--course-id",
            "algorithm-review",
            "--lesson-id",
            "arrays-strings-matrices",
            environment=self._environment(
                LEARNING_ISSUES_FAKE_ISSUES=json.dumps(
                    [unrelated_issue], ensure_ascii=False
                )
            ),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["action"], "created")

    def test_invalid_lesson_stops_before_calling_github(self):
        result = self._run(
            "open",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--course-id",
            "algorithm-review",
            "--lesson-id",
            "not-a-lesson",
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("lessonId", result.stderr)
        self.assertEqual(self._gh_calls(), [])

    def test_other_courses_are_not_enabled_without_an_explicit_course_policy_opt_in(self):
        other_course = self.workspace / "courses" / "another-course"
        other_course.mkdir(parents=True)
        (other_course / "course.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "courseId": "another-course",
                    "lifecycle": "published",
                    "tracks": [
                        {
                            "trackId": "core",
                            "stages": [
                                {
                                    "stageId": "start",
                                    "lessons": [
                                        {"lessonId": "intro", "lifecycle": "active"}
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        result = self._run(
            "open",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--course-id",
            "another-course",
            "--lesson-id",
            "intro",
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("algorithm-review", result.stderr)
        self.assertEqual(self._gh_calls(), [])

    def test_public_target_repository_stops_before_creating_labels_or_issues(self):
        result = self._run(
            "open",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--course-id",
            "algorithm-review",
            "--lesson-id",
            "arrays-strings-matrices",
            environment=self._environment(
                LEARNING_ISSUES_FAKE_REPOSITORY=json.dumps(
                    {
                        "nameWithOwner": "learner/private-answers",
                        "isPrivate": False,
                        "hasIssuesEnabled": True,
                    }
                )
            ),
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("私有", result.stderr)
        self.assertFalse(
            any(call[:2] == ["label", "create"] for call in self._gh_calls())
        )
        self.assertFalse(
            any(call[:2] == ["issue", "create"] for call in self._gh_calls())
        )

    def test_submit_returns_a_revision_issue_to_the_review_queue(self):
        issue = self._issue(status="review:revision-needed")
        result = self._run(
            "submit",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--issue",
            "42",
            environment=self._environment(
                LEARNING_ISSUES_FAKE_VIEW=json.dumps(issue, ensure_ascii=False)
            ),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["action"], "submitted")
        edit_call = next(call for call in self._gh_calls() if call[:2] == ["issue", "edit"])
        self.assertIn("review:revision-needed", edit_call)
        self.assertIn("review:pending", edit_call)

    def test_submit_rejects_an_issue_for_a_course_without_issue_workflow_opt_in(self):
        issue = self._issue()
        issue["body"] = issue["body"].replace(
            "algorithm-review", "another-course"
        )
        result = self._run(
            "submit",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            "--issue",
            "42",
            environment=self._environment(
                LEARNING_ISSUES_FAKE_VIEW=json.dumps(issue, ensure_ascii=False)
            ),
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("algorithm-review", result.stderr)
        self.assertFalse(
            any(call[:2] == ["issue", "edit"] for call in self._gh_calls())
        )

    def test_review_marks_a_pending_issue_without_echoing_its_answer(self):
        reviewer = self.workspace / "reviewer.py"
        reviewer.write_text(
            "import json\nimport sys\njson.load(sys.stdin)\nprint(json.dumps({'status': 'passed'}))\n",
            encoding="utf-8",
        )
        issue = self._issue(status="review:pending", answer="不可写入输出的学习者回答")
        self._write_config([sys.executable, str(reviewer)])
        result = self._run(
            "review-all",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
            environment=self._environment(
                LEARNING_ISSUES_FAKE_ISSUES=json.dumps([issue], ensure_ascii=False)
            ),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["passed"], [42])
        self.assertNotIn("不可写入输出的学习者回答", result.stdout)
        calls = self._gh_calls()
        self.assertTrue(any(call[:2] == ["issue", "edit"] for call in calls))
        comment_call = next(call for call in calls if call[:2] == ["issue", "comment"])
        comment = comment_call[comment_call.index("--body") + 1]
        self.assertNotIn("不可写入输出的学习者回答", comment)

    def test_schedule_preview_renders_an_isolated_daily_2200_crontab_entry(self):
        result = self._run(
            "schedule-preview",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        entry = json.loads(result.stdout)["entry"]
        self.assertTrue(entry.startswith("0 22 * * * "))
        self.assertIn("review-all", entry)
        self.assertIn("go-together-answer-review", entry)
        self.assertIn(str(self.config), entry)

    def test_schedule_install_and_uninstall_preserve_unrelated_crontab_entries(self):
        crontab = self.workspace / "crontab"
        original_entry = "0 23 * * * /usr/local/bin/other-task\n"
        crontab.write_text(original_entry, encoding="utf-8")

        installed = self._run(
            "schedule-install",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
        )

        self.assertEqual(installed.returncode, 0, installed.stderr)
        installed_contents = crontab.read_text(encoding="utf-8")
        self.assertIn(original_entry, installed_contents)
        self.assertEqual(installed_contents.count("go-together-answer-review"), 1)
        self.assertIn("0 22 * * *", installed_contents)

        removed = self._run(
            "schedule-uninstall",
            "--config",
            str(self.config),
            "--workspace",
            str(self.workspace),
        )

        self.assertEqual(removed.returncode, 0, removed.stderr)
        self.assertEqual(json.loads(removed.stdout)["action"], "removed")
        self.assertEqual(crontab.read_text(encoding="utf-8"), original_entry)


if __name__ == "__main__":
    unittest.main()
