import base64
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation_core import (
    EvaluationError,
    _linux_sandbox_command,
    command_isolation_available,
    current_progress,
    execute_command,
    load_evaluation,
    plan_command,
    prepare_lesson,
    record_outcome,
    record_security_stop,
    resolve_lesson,
    scan_sensitive_inputs,
    start_cycle,
)


class EvaluationCoreFixture(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        self.course_root = self.workspace / "courses/go-backend"
        (self.course_root / "lessons").mkdir(parents=True)
        (self.course_root / "evaluation").mkdir()
        (self.course_root / "exercise-templates/intro").mkdir(parents=True)
        (self.workspace / "courses/catalog.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "defaultCourseId": "go-backend",
                    "courses": [
                        {
                            "courseId": "go-backend",
                            "title": "Go Course",
                            "language": {"id": "go", "label": "Go"},
                            "lifecycle": "published",
                            "replacementCourseId": None,
                            "manifestPath": "courses/go-backend/course.json",
                        }
                    ],
                }
            )
            + "\n",
            encoding="utf-8",
        )
        self.course = {
            "schemaVersion": 1,
            "courseId": "go-backend",
            "title": "Go Course",
            "description": "Fixture",
            "language": {"id": "go", "label": "Go"},
            "lifecycle": "published",
            "replacementCourseId": None,
            "evaluationPolicyPath": "evaluation/policy.md",
            "commandProfilePath": "evaluation/command-profile.json",
            "publicResources": [],
            "internalResources": [],
            "tracks": [
                {
                    "trackId": "fundamentals",
                    "title": "Fundamentals",
                    "description": "Fixture",
                    "stages": [
                        {
                            "stageId": "start",
                            "title": "Start",
                            "description": "Fixture",
                            "lessons": [
                                {
                                    "lessonId": "intro",
                                    "lifecycle": "active",
                                    "day": 0,
                                    "title": "Intro",
                                    "objective": "Understand the trade-off.",
                                    "goals": ["Explain the mechanism", "Provide evidence"],
                                    "contentPath": "lessons/intro.md",
                                    "exerciseTemplatePath": "exercise-templates/intro/main.go",
                                    "evaluation": {
                                        "competencies": [
                                            {
                                                "competencyId": "mechanism",
                                                "title": "Explain mechanism",
                                            },
                                            {
                                                "competencyId": "evidence",
                                                "title": "Provide evidence",
                                            },
                                        ],
                                        "requiredEvidence": ["notes", "exercise"],
                                        "scoringBasis": ["accurate", "verifiable"],
                                    },
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        (self.course_root / "course.json").write_text(
            json.dumps(self.course) + "\n", encoding="utf-8"
        )
        (self.course_root / "lessons/intro.md").write_text(
            "# Intro\n\nCourse content.\n\n```bash\ngo test ./...\n```\n",
            encoding="utf-8",
        )
        (self.course_root / "evaluation/policy.md").write_text(
            "# Policy\n\nOnly lesson evidence.\n", encoding="utf-8"
        )
        (self.course_root / "evaluation/command-profile.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "profileId": "go-local",
                    "environment": {
                        "GOENV": "off",
                        "GOPROXY": "off",
                        "GOSUMDB": "off",
                    },
                    "commands": [
                        {
                            "commandId": "go-test",
                            "argvTemplate": ["go", "test", "{package}"],
                            "variables": {"package": "workspace-path"},
                            "timeoutSeconds": 30,
                        },
                        {
                            "commandId": "go-test-race",
                            "argvTemplate": ["go", "test", "-race", "{package}"],
                            "variables": {"package": "workspace-path"},
                            "timeoutSeconds": 60,
                        },
                        {
                            "commandId": "go-vet",
                            "argvTemplate": ["go", "vet", "{package}"],
                            "variables": {"package": "workspace-path"},
                            "timeoutSeconds": 30,
                        },
                        {
                            "commandId": "go-bench",
                            "argvTemplate": [
                                "go",
                                "test",
                                "-bench={benchmark}",
                                "{package}",
                            ],
                            "variables": {
                                "benchmark": "selector",
                                "package": "workspace-path",
                            },
                            "timeoutSeconds": 60,
                        },
                    ],
                }
            )
            + "\n",
            encoding="utf-8",
        )
        (self.course_root / "exercise-templates/intro/main.go").write_text(
            "package intro\n", encoding="utf-8"
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def resolved(self):
        return resolve_lesson(self.workspace, "go-backend", "intro")


class ExplicitIdentityTest(EvaluationCoreFixture):
    def test_resolves_only_catalog_and_manifest_owned_identity(self):
        resolved = self.resolved()

        self.assertEqual((resolved.course_id, resolved.lesson_id), ("go-backend", "intro"))
        self.assertEqual(resolved.day, 0)
        self.assertEqual(
            resolved.notes,
            self.workspace.resolve()
            / "learning-records/go-backend/lessons/intro/notes.md",
        )
        self.assertEqual(
            resolved.evaluation,
            self.workspace.resolve()
            / "learning-records/go-backend/lessons/intro/evaluation.md",
        )
        self.assertRegex(resolved.evaluation_revision, r"^sha256:[a-f0-9]{64}$")

        for course_id, lesson_id in (
            ("unknown", "intro"),
            ("go-backend", "day-0"),
            ("", "intro"),
        ):
            with self.subTest(course_id=course_id, lesson_id=lesson_id):
                with self.assertRaises(EvaluationError):
                    resolve_lesson(self.workspace, course_id, lesson_id)
        self.assertFalse((self.workspace / "learning-records").exists())

    def test_rejects_retired_lesson_for_new_cycle(self):
        self.course["tracks"][0]["stages"][0]["lessons"][0]["lifecycle"] = "retired"
        (self.course_root / "course.json").write_text(
            json.dumps(self.course), encoding="utf-8"
        )
        resolved = resolve_lesson(self.workspace, "go-backend", "intro")
        with self.assertRaisesRegex(EvaluationError, "Retired"):
            prepare_lesson(resolved)
        with self.assertRaisesRegex(EvaluationError, "Retired"):
            start_cycle(resolved)

    def test_resolves_a_course_whose_lesson_has_no_day_alias(self):
        self.course["tracks"][0]["stages"][0]["lessons"][0]["day"] = None
        (self.course_root / "course.json").write_text(
            json.dumps(self.course) + "\n", encoding="utf-8"
        )

        resolved = self.resolved()

        self.assertIsNone(resolved.day)
        self.assertEqual(resolved.course_id, "go-backend")
        self.assertEqual(resolved.lesson_id, "intro")

    def test_rejects_an_exercise_template_not_owned_by_the_lesson_identity(self):
        wrong_template = self.course_root / "exercise-templates/other/main.go"
        wrong_template.parent.mkdir(parents=True)
        wrong_template.write_text("package other\n", encoding="utf-8")
        self.course["tracks"][0]["stages"][0]["lessons"][0][
            "exerciseTemplatePath"
        ] = "exercise-templates/other/main.go"
        (self.course_root / "course.json").write_text(
            json.dumps(self.course) + "\n", encoding="utf-8"
        )

        with self.assertRaisesRegex(EvaluationError, "identity"):
            self.resolved()
        self.assertFalse((self.workspace / "learning-records").exists())


class PreparationTest(EvaluationCoreFixture):
    def test_prepares_notes_exclusively_and_only_initializes_exercise_when_explicit(self):
        resolved = self.resolved()
        first = prepare_lesson(resolved)

        self.assertEqual(first.notes_status, "created")
        self.assertFalse(resolved.evaluation.exists())
        self.assertFalse(resolved.exercise.exists())
        notes = resolved.notes.read_text(encoding="utf-8")
        self.assertIn("go-backend / intro", notes)
        self.assertNotIn("Course content.", notes)
        with self.assertRaisesRegex(EvaluationError, "already exists"):
            prepare_lesson(resolved)

        initialized = prepare_lesson(
            resolved, force_notes=True, initialize_exercise=True
        )
        self.assertEqual(initialized.exercise_status, "created")
        self.assertEqual(
            (resolved.exercise / "main.go").read_text(encoding="utf-8"),
            "package intro\n",
        )
        with self.assertRaisesRegex(EvaluationError, "already exists"):
            prepare_lesson(
                resolved, force_notes=True, initialize_exercise=True
            )


class StateMachineTest(EvaluationCoreFixture):
    def test_enforces_three_attempts_four_states_and_pass_terminal(self):
        resolved = self.resolved()
        start_cycle(resolved)
        self.assertEqual(current_progress(load_evaluation(resolved.evaluation), resolved), ("未开始", None))

        for attempt in range(1, 4):
            record = record_outcome(
                resolved,
                "mechanism",
                2,
                problem_type="机制缺失",
                evidence_location="回答 1",
                review_section="机制",
            )
            expected = "重新学习" if attempt == 3 else "定向回炉"
            self.assertEqual(current_progress(record, resolved)[0], expected)
        with self.assertRaisesRegex(EvaluationError, "新评测周期"):
            record_outcome(
                resolved,
                "mechanism",
                3,
                problem_type="已达标",
                evidence_location="回答 2",
                review_section="机制",
            )

        start_cycle(resolved)
        record_outcome(
            resolved,
            "mechanism",
            4,
            problem_type="已达标",
            evidence_location="回答 3",
            review_section="机制",
        )
        passed = record_outcome(
            resolved,
            "evidence",
            3,
            problem_type="已达标",
            evidence_location="验证证据",
            review_section="实践",
        )
        self.assertEqual(current_progress(passed, resolved), ("通过", 88))
        with self.assertRaisesRegex(EvaluationError, "通过.*终态"):
            start_cycle(resolved)

        persisted = resolved.evaluation.read_text(encoding="utf-8")
        self.assertIn("evaluation-record", persisted)
        self.assertNotIn("标准答案", persisted)

    def test_revision_mismatch_is_unstarted_without_erasing_history(self):
        resolved = self.resolved()
        start_cycle(resolved)
        record_outcome(
            resolved,
            "mechanism",
            3,
            problem_type="已达标",
            evidence_location="回答",
            review_section="机制",
        )
        before = load_evaluation(resolved.evaluation)

        (self.course_root / "evaluation/policy.md").write_text(
            "# Policy\n\nChanged contract.\n", encoding="utf-8"
        )
        changed = self.resolved()
        self.assertNotEqual(changed.evaluation_revision, resolved.evaluation_revision)
        self.assertEqual(current_progress(before, changed), ("未开始", None))
        start_cycle(changed)
        after = load_evaluation(changed.evaluation)
        self.assertEqual(len(after["cycles"]), 2)

    def test_passed_revision_remains_terminal_after_an_intervening_revision(self):
        resolved_a = self.resolved()
        start_cycle(resolved_a)
        record_outcome(
            resolved_a,
            "mechanism",
            4,
            problem_type="已达标",
            evidence_location="回答",
            review_section="机制",
        )
        record_outcome(
            resolved_a,
            "evidence",
            4,
            problem_type="已达标",
            evidence_location="证据",
            review_section="实践",
        )
        original_policy = resolved_a.evaluation_policy.read_text(encoding="utf-8")
        resolved_a.evaluation_policy.write_text(
            original_policy + "\nRevision B.\n", encoding="utf-8"
        )
        resolved_b = self.resolved()
        start_cycle(resolved_b)
        resolved_b.evaluation_policy.write_text(original_policy, encoding="utf-8")
        restored_a = self.resolved()
        before = restored_a.evaluation.read_bytes()

        with self.assertRaisesRegex(EvaluationError, "通过.*终态"):
            start_cycle(restored_a)

        self.assertEqual(restored_a.evaluation.read_bytes(), before)

    def test_rejects_tampered_snapshot_scores_attempts_and_event_payloads(self):
        resolved = self.resolved()
        start_cycle(resolved)
        record_outcome(
            resolved,
            "mechanism",
            2,
            problem_type="机制缺失",
            evidence_location="回答",
            review_section="机制",
        )
        valid = load_evaluation(resolved.evaluation)

        tampered_records = []
        wrong_reference = json.loads(json.dumps(valid))
        wrong_reference["cycles"][0]["referenceScore"] = 100
        tampered_records.append(wrong_reference)

        wrong_attempts = json.loads(json.dumps(valid))
        wrong_attempts["cycles"][0]["competencies"][0]["attempts"] = 2
        tampered_records.append(wrong_attempts)

        answer_payload = json.loads(json.dumps(valid))
        answer_payload["events"][1]["answer"] = "must never persist"
        tampered_records.append(answer_payload)

        unknown_competency = json.loads(json.dumps(valid))
        unknown_competency["events"][1]["competencyId"] = "invented"
        tampered_records.append(unknown_competency)

        wrong_current = json.loads(json.dumps(valid))
        wrong_current["cycles"][0]["currentCompetencyId"] = "evidence"
        tampered_records.append(wrong_current)

        wrong_contract = json.loads(json.dumps(valid))
        wrong_contract["cycles"][0]["competencies"][0][
            "competencyId"
        ] = "invented"
        wrong_contract["cycles"][0]["currentCompetencyId"] = "invented"
        wrong_contract["events"][1]["competencyId"] = "invented"
        tampered_records.append(wrong_contract)

        invalid_restart = json.loads(json.dumps(valid))
        invalid_restart["cycles"].append(
            {
                "cycle": 2,
                "evaluationRevision": resolved.evaluation_revision,
                "status": "未开始",
                "referenceScore": None,
                "currentCompetencyId": "mechanism",
                "competencies": [
                    {"competencyId": "mechanism", "score": 0, "attempts": 0},
                    {"competencyId": "evidence", "score": 0, "attempts": 0},
                ],
            }
        )
        invalid_restart["events"].append(
            {"sequence": 3, "type": "cycle-started", "cycle": 2}
        )
        tampered_records.append(invalid_restart)

        for candidate in tampered_records:
            with self.subTest(candidate=candidate), self.assertRaises(EvaluationError):
                current_progress(candidate, resolved)

    def test_imports_only_an_unstarted_legacy_markdown_record_and_preserves_bytes(self):
        resolved = self.resolved()
        resolved.evaluation.parent.mkdir(parents=True)
        legacy = (
            "# Day 0 评测记录\n\n## 当前状态\n\n"
            "- 状态：未开始\n- 参考分数：待评测\n- 当前问题：无\n\n"
            "## 能力项\n\n| ID | 课程依据 | 等级 | 状态 | 尝试次数 |\n"
            "|---|---|---:|---|---:|\n\n## 评测历史\n\n尚未开始评测。\n"
        )
        resolved.evaluation.write_text(legacy, encoding="utf-8")

        record = load_evaluation(resolved.evaluation, resolved)
        self.assertEqual(
            base64.b64decode(record["legacySourceBase64"]),
            legacy.encode("utf-8"),
        )
        self.assertEqual(current_progress(record, resolved), ("未开始", None))
        before = resolved.evaluation.read_bytes()
        with self.assertRaisesRegex(EvaluationError, "迁移"):
            start_cycle(resolved)
        self.assertEqual(resolved.evaluation.read_bytes(), before)

        resolved.evaluation.write_text(
            legacy.replace("状态：未开始", "状态：通过"), encoding="utf-8"
        )
        with self.assertRaisesRegex(EvaluationError, "迁移"):
            start_cycle(resolved)

    def test_rejects_multiple_structured_record_blocks(self):
        resolved = self.resolved()
        start_cycle(resolved)
        source = resolved.evaluation.read_text(encoding="utf-8")
        resolved.evaluation.write_text(
            source + '\n```evaluation-record\n{"schemaVersion":2}\n```\n',
            encoding="utf-8",
        )

        with self.assertRaisesRegex(EvaluationError, "exactly one"):
            load_evaluation(resolved.evaluation, resolved)


class SafetyAndCommandTest(EvaluationCoreFixture):
    def test_sensitive_stop_appends_only_redacted_event_and_preserves_pass(self):
        resolved = self.resolved()
        prepare_lesson(resolved)
        start_cycle(resolved)
        record_outcome(
            resolved,
            "mechanism",
            4,
            problem_type="已达标",
            evidence_location="回答",
            review_section="机制",
        )
        record_outcome(
            resolved,
            "evidence",
            4,
            problem_type="已达标",
            evidence_location="证据",
            review_section="实践",
        )
        token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"
        resolved.notes.write_text(f"token: {token}\n", encoding="utf-8")
        self.assertEqual(scan_sensitive_inputs(resolved), "sensitive-content")

        before = current_progress(load_evaluation(resolved.evaluation), resolved)
        record_security_stop(resolved, "sensitive-content")
        source = resolved.evaluation.read_text(encoding="utf-8")
        self.assertEqual(current_progress(load_evaluation(resolved.evaluation), resolved), before)
        self.assertNotIn(token, source)
        self.assertIn("security-stop", source)

    def test_command_profile_is_argv_only_fixed_cwd_minimal_env_and_fail_closed(self):
        resolved = self.resolved()
        resolved.exercise.mkdir(parents=True)
        plan = plan_command(resolved, ["go", "test", "./..."])

        self.assertEqual(plan.argv, ("go", "test", "./..."))
        self.assertEqual(plan.workspace, self.workspace.resolve())
        self.assertEqual(plan.cwd, resolved.exercise)
        self.assertEqual(plan.timeout_seconds, 30)
        self.assertTrue(plan.network_denied)
        self.assertTrue(plan.shadow_workspace)
        self.assertEqual(
            set(plan.environment),
            {
                "PATH",
                "HOME",
                "TMPDIR",
                "GOENV",
                "GOPROXY",
                "GOSUMDB",
            },
        )
        self.assertNotIn(str(Path.home()), plan.environment["PATH"])

        rejected = (
            ["go", "test", "./...", "&&", "curl", "https://example.com"],
            ["curl", "https://example.com"],
            ["go", "test", "../../..."],
            "go test ./...",
        )
        for argv in rejected:
            with self.subTest(argv=argv), self.assertRaises(EvaluationError):
                plan_command(resolved, argv)

        resolved.command_profile.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "profileId": "malicious-go",
                    "environment": {},
                    "commands": [
                        {
                            "commandId": "go-exec",
                            "argvTemplate": ["go", "test", "-exec={package}"],
                            "variables": {"package": "workspace-path"},
                            "timeoutSeconds": 30,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        with self.assertRaises(EvaluationError):
            plan_command(resolved, ["go", "test", "-exec=./..."])

        resolved.command_profile.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "profileId": "python-local",
                    "environment": {"PYTHONNOUSERSITE": "1"},
                    "commands": [
                        {
                            "commandId": "python-pytest",
                            "argvTemplate": [
                                "python3",
                                "-m",
                                "pytest",
                                "{target}",
                            ],
                            "variables": {"target": "workspace-path"},
                            "timeoutSeconds": 30,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        resolved.content.write_text(
            "# Intro\n\npython3 -m pytest ./...\n", encoding="utf-8"
        )
        python_plan = plan_command(
            self.resolved(), ["python3", "-m", "pytest", "./..."]
        )
        self.assertEqual(python_plan.command_id, "python-pytest")
        self.assertEqual(python_plan.environment["PYTHONNOUSERSITE"], "1")

    def test_linux_isolation_hides_home_and_the_original_exercise(self):
        resolved = self.resolved()
        resolved.exercise.mkdir(parents=True)
        runtime_directory = tempfile.TemporaryDirectory()
        self.addCleanup(runtime_directory.cleanup)
        runtime = Path(runtime_directory.name)
        shadow = runtime / "workspace"
        shadow.mkdir(parents=True)

        with patch("evaluation_core.shutil.which", return_value="/usr/bin/bwrap"):
            command = _linux_sandbox_command(
                "/usr/local/go/bin/go",
                ("go", "test", "./..."),
                resolved.workspace,
                resolved.exercise,
                shadow,
                runtime,
            )

        hidden = [
            command[index + 1]
            for index, value in enumerate(command[:-1])
            if value == "--tmpfs"
        ]
        self.assertIn(str(Path.home().resolve()), hidden)
        self.assertIn(str(resolved.workspace.resolve()), hidden)

    def test_scans_only_notes_explicit_current_exercise_evidence_and_rejects_escape(self):
        resolved = self.resolved()
        prepare_lesson(resolved)
        resolved.exercise.mkdir(parents=True)
        token = "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"
        (resolved.exercise / "result.txt").write_text(token, encoding="utf-8")
        resolved.notes.write_text(
            "# Notes\n\n- 产物路径：`result.txt`\n", encoding="utf-8"
        )
        self.assertEqual(scan_sensitive_inputs(resolved), "sensitive-content")

        resolved.notes.write_text(
            "# Notes\n\n- 产物路径：`../outside.txt`\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(EvaluationError, "evidence"):
            scan_sensitive_inputs(resolved)

        outside = self.workspace / "outside.txt"
        outside.write_text("safe", encoding="utf-8")
        linked = resolved.exercise / "linked.txt"
        os.symlink(outside, linked)
        resolved.notes.write_text(
            "# Notes\n\n- 产物路径：`linked.txt`\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(EvaluationError, "symlink"):
            scan_sensitive_inputs(resolved)

    def test_executes_only_in_a_network_denied_shadow_without_mutating_exercise(self):
        resolved = self.resolved()
        resolved.exercise.mkdir(parents=True)
        source_secret = resolved.exercise / "source-secret.txt"
        source_secret.write_text("must-not-be-readable", encoding="utf-8")
        (resolved.exercise / "go.mod").write_text(
            "module example.com/evaluation-fixture\n\ngo 1.22\n",
            encoding="utf-8",
        )
        (resolved.exercise / "shadow_test.go").write_text(
            """package fixture

import (
    "net"
    "os"
    "testing"
    "time"
)

func TestShadowAndNoNetwork(t *testing.T) {
    if err := os.WriteFile("mutation.txt", []byte("shadow"), 0o600); err != nil {
        t.Fatal(err)
    }
    if _, err := os.ReadFile(%s); err == nil {
        t.Fatal("original Exercise Workspace unexpectedly readable")
    }
    if _, err := os.ReadDir(%s); err == nil {
        t.Fatal("user home unexpectedly readable")
    }
    connection, err := net.DialTimeout("tcp", "example.com:80", time.Second)
    if err == nil {
        connection.Close()
        t.Fatal("network unexpectedly available")
    }
}
""" % (json.dumps(str(source_secret)), json.dumps(str(Path.home()))),
            encoding="utf-8",
        )
        plan = plan_command(resolved, ["go", "test", "./..."])
        if not command_isolation_available():
            with self.assertRaisesRegex(EvaluationError, "isolation"):
                execute_command(plan)
            return

        result = execute_command(plan)

        self.assertEqual(result.exit_code, 0, result.stderr)
        self.assertIn("ok", result.stdout)
        self.assertFalse((resolved.exercise / "mutation.txt").exists())

    def test_run_command_cli_returns_redacted_structured_result(self):
        resolved = self.resolved()
        prepare_lesson(resolved)
        resolved.exercise.mkdir(parents=True)
        (resolved.exercise / "go.mod").write_text(
            "module example.com/evaluation-cli\n\ngo 1.22\n", encoding="utf-8"
        )
        (resolved.exercise / "cli_test.go").write_text(
            'package fixture\nimport "testing"\nfunc TestCLI(t *testing.T) {}\n',
            encoding="utf-8",
        )
        if not command_isolation_available():
            self.skipTest("platform isolation is unavailable")

        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).with_name("evaluation_core.py")),
                "run-command",
                "go-backend",
                "intro",
                "--workspace",
                str(self.workspace),
                "--argv-json",
                '["go", "test", "./..."]',
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(output["commandId"], "go-test")
        self.assertEqual(output["exitCode"], 0)
        self.assertIn("ok", output["stdout"])
        self.assertEqual(output["stderr"], "")

    def test_stops_a_running_command_at_the_output_limit(self):
        resolved = self.resolved()
        resolved.exercise.mkdir(parents=True)
        (resolved.exercise / "go.mod").write_text(
            "module example.com/evaluation-output\n\ngo 1.22\n", encoding="utf-8"
        )
        (resolved.exercise / "large_output_test.go").write_text(
            """package fixture

import (
    "fmt"
    "strings"
    "testing"
)

func TestLargeOutput(t *testing.T) {
    fmt.Print(strings.Repeat("x", 1200000))
    t.Fail()
}
""",
            encoding="utf-8",
        )
        if not command_isolation_available():
            self.skipTest("platform isolation is unavailable")

        with self.assertRaisesRegex(EvaluationError, "output exceeds"):
            execute_command(plan_command(resolved, ["go", "test", "./..."]))

    def test_applies_one_output_budget_across_stdout_and_stderr(self):
        resolved = self.resolved()
        resolved.exercise.mkdir(parents=True)
        (resolved.exercise / "emit.py").write_text(
            'import sys\nsys.stdout.write("x" * 600000)\nsys.stderr.write("y" * 600000)\n',
            encoding="utf-8",
        )
        resolved.content.write_text(
            "# Intro\n\npython3 ./emit.py\n", encoding="utf-8"
        )
        resolved.command_profile.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "profileId": "python-local",
                    "environment": {"PYTHONNOUSERSITE": "1"},
                    "commands": [
                        {
                            "commandId": "python-output",
                            "argvTemplate": ["python3", "{script}"],
                            "variables": {"script": "workspace-path"},
                            "timeoutSeconds": 30,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        if not command_isolation_available():
            self.skipTest("platform isolation is unavailable")

        with self.assertRaisesRegex(EvaluationError, "output exceeds"):
            execute_command(
                plan_command(self.resolved(), ["python3", "./emit.py"])
            )

    def test_cli_security_preflight_preserves_terminal_progress(self):
        resolved = self.resolved()
        prepare_lesson(resolved)
        start_cycle(resolved)
        record_outcome(
            resolved,
            "mechanism",
            4,
            problem_type="已达标",
            evidence_location="回答",
            review_section="机制",
        )
        record_outcome(
            resolved,
            "evidence",
            4,
            problem_type="已达标",
            evidence_location="证据",
            review_section="实践",
        )
        resolved.notes.write_text(
            "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456\n", encoding="utf-8"
        )

        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).with_name("evaluation_core.py")),
                "start",
                "go-backend",
                "intro",
                "--workspace",
                str(self.workspace),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertTrue(output["securityStop"])
        self.assertEqual(output["status"], "通过")
        self.assertEqual(output["referenceScore"], 100)
        self.assertNotIn("ghp_", result.stdout)


if __name__ == "__main__":
    unittest.main()
