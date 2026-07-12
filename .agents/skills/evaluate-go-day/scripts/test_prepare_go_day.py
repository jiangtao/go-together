import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from prepare_go_day import (
    DayPaths,
    PreparationError,
    discover_day_paths,
    extract_course_material,
    parse_day,
    prepare_notes,
    render_notes,
)


class ParseDayTest(unittest.TestCase):
    def test_accepts_supported_day_spellings_inside_commands(self):
        cases = {
            "开始 Day 13": 13,
            "创建 day1 笔记": 1,
            "把 day01 作业带到 notes": 1,
            "prepare DAY-01 notes": 1,
            "day-36": 36,
            "day00": 0,
        }

        for command, expected in cases.items():
            with self.subTest(command=command):
                self.assertEqual(parse_day(command), expected)

    def test_rejects_missing_out_of_range_or_ambiguous_day(self):
        cases = {
            "开始今天": "exactly one",
            "day37": "between 0 and 36",
            "day-1 and day02": "ambiguous",
            "day001": "exactly one",
        }

        for command, message in cases.items():
            with self.subTest(command=command), self.assertRaisesRegex(
                PreparationError, message
            ):
                parse_day(command)


class DiscoverDayPathsTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        self.lessons = self.workspace / "docs/go-learning/daily-lessons"
        self.lessons.mkdir(parents=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def write_course(self, day: int, suffix: str = "topic") -> Path:
        course = self.lessons / f"day-{day:02d}-{suffix}.md"
        course.write_text(f"# Day {day:02d}：Topic\n", encoding="utf-8")
        return course

    def test_discovers_every_supported_day_and_target_notes_path(self):
        courses = [self.write_course(day) for day in range(37)]

        for day, course in enumerate(courses):
            with self.subTest(day=day):
                paths = discover_day_paths(self.workspace, day)
                self.assertEqual(paths.course, course.resolve())
                self.assertEqual(
                    paths.notes,
                    (self.workspace / "exercise" / f"day{day}" / "notes.md").resolve(),
                )

    def test_requires_exactly_one_course_file(self):
        self.write_course(13, "first")
        self.write_course(13, "second")

        with self.assertRaisesRegex(PreparationError, "exactly one"):
            discover_day_paths(self.workspace, 13)

    def test_rejects_course_whose_heading_names_another_day(self):
        course = self.write_course(13)
        course.write_text("# Day 12：Wrong\n", encoding="utf-8")

        with self.assertRaisesRegex(PreparationError, "heading"):
            discover_day_paths(self.workspace, 13)


class ExtractAndRenderTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def write_course(self, day: int, source: str) -> DayPaths:
        lessons = self.workspace / "docs/go-learning/daily-lessons"
        lessons.mkdir(parents=True, exist_ok=True)
        course = lessons / f"day-{day:02d}-fixture.md"
        course.write_text(source, encoding="utf-8")
        return DayPaths(
            course=course.resolve(),
            notes=(self.workspace / "exercise" / f"day{day}" / "notes.md").resolve(),
        )

    def test_extracts_only_explicit_assignment_sections(self):
        paths = self.write_course(
            13,
            """# Day 13：Fixture

English title: **Fixture**

返回：[目录](README.md)

### 学习目标

掌握当天目标。

### Node.js 对照

不要复制的对照提示。

```text
### 实践步骤
代码围栏里的伪标题。
```

### Go 核心心智

不要复制的核心讲解。

### 实践步骤

1. 完成练习一。
2. 完成练习二。
   - 保存必要证据。

示例答案：

```go
func solved() {}
```

### 完成标准

- 两项练习均有证据。

### 建议文件

- `answer.go`：当天产物。

不要复制的文件提示。

### 测试/验证命令

```bash
go test ./...
```

命令失败时记录原因。

### 检索问题

- 为什么这样设计？

不要复制的问题提示。

### 常见误区

不要复制的答案提示。

## Day 7-13 阶段验收

不要复制的跨 Day 内容。
""",
        )

        material = extract_course_material(paths.course, 13)

        self.assertEqual(material.title, "Day 13：Fixture")
        self.assertEqual(
            [section.title for section in material.sections],
            [
                "学习目标",
                "实践步骤",
                "完成标准",
                "建议文件",
                "测试/验证命令",
                "检索问题",
            ],
        )
        self.assertEqual(
            material.sections[1].body,
            "1. 完成练习一。\n2. 完成练习二。\n   - 保存必要证据。",
        )

        rendered = render_notes(material, paths)
        self.assertIn("# Day 13 学习回答", rendered)
        self.assertIn(
            "课程：[Day 13：Fixture](../../docs/go-learning/daily-lessons/day-13-fixture.md)",
            rendered,
        )
        self.assertIn("## 回答记录", rendered)
        self.assertIn("## 当日产物与验证证据", rendered)
        for forbidden in (
            "伪标题",
            "对照提示",
            "核心讲解",
            "func solved",
            "文件提示",
            "问题提示",
            "答案提示",
            "跨 Day 内容",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, rendered)

    def test_extracts_day_zero_goal_and_retrieval_practice(self):
        paths = self.write_course(
            0,
            """# Day 00：Why Go

English title: **Why Go**

返回：[目录](README.md)

今天不写代码，目标是写清学习动机和判断标准。

## 教学正文

不要复制的教学内容。

## 今天的检索问题

不要看正文，自己回答：

- 为什么学习 Go？
- 哪些场景保留 Node.js？

不要复制的提示。
""",
        )

        material = extract_course_material(paths.course, 0)

        self.assertEqual(
            [(section.title, section.body) for section in material.sections],
            [
                ("学习目标", "今天不写代码，目标是写清学习动机和判断标准。"),
                (
                    "今天的检索问题",
                    "- 为什么学习 Go？\n- 哪些场景保留 Node.js？",
                ),
            ],
        )

    def test_keeps_day_36_capstone_evidence_table(self):
        paths = self.write_course(
            36,
            """# Day 36：Final Review

### 学习目标

完成复盘。

### 实践步骤

1. 冻结范围。

### 建议文件

- `review.md`

### 测试/验证命令

```bash
go test ./...
```

### 检索问题

- 哪项最弱？

### 常见误区

不要复制。

### Capstone rubric 对齐

| 维度 | 证据 |
|---|---|
| 测试 | `go test ./...` |
""",
        )

        material = extract_course_material(paths.course, 36)

        self.assertEqual(material.sections[-1].title, "Capstone rubric 对齐")
        self.assertIn("| 测试 | `go test ./...` |", material.sections[-1].body)


class PrepareNotesTest(unittest.TestCase):
    COURSE = """# Day 13：Fixture

### 学习目标

掌握当天目标。

### 实践步骤

1. 完成当天练习。

### 建议文件

- `answer.go`

### 测试/验证命令

```bash
go test ./...
```

### 检索问题

- 为什么这样设计？

### 常见误区

不要复制。
"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temp_dir.name)
        lessons = self.workspace / "docs/go-learning/daily-lessons"
        lessons.mkdir(parents=True)
        (lessons / "day-13-fixture.md").write_text(self.COURSE, encoding="utf-8")
        self.notes = self.workspace / "exercise/day13/notes.md"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_refuses_overwrite_by_default_and_force_is_deterministic(self):
        first = prepare_notes(self.workspace, "创建 day13 笔记")
        generated = self.notes.read_text(encoding="utf-8")
        self.assertEqual(first.status, "created")

        self.notes.write_text("learner content\n", encoding="utf-8")
        with self.assertRaisesRegex(PreparationError, "already exists"):
            prepare_notes(self.workspace, "开始 Day 13")
        self.assertEqual(self.notes.read_text(encoding="utf-8"), "learner content\n")

        forced = prepare_notes(self.workspace, "day-13", force=True)
        self.assertEqual(forced.status, "overwritten")
        self.assertEqual(self.notes.read_text(encoding="utf-8"), generated)

        prepare_notes(self.workspace, "day13", force=True)
        self.assertEqual(self.notes.read_text(encoding="utf-8"), generated)

    def test_dry_run_returns_content_without_creating_files(self):
        result = prepare_notes(self.workspace, "开始 Day 13", dry_run=True)

        self.assertEqual(result.status, "dry-run")
        self.assertIn("# Day 13 学习回答", result.content)
        self.assertFalse(self.notes.exists())
        self.assertFalse(self.notes.parent.exists())

    def test_dry_run_can_preview_without_replacing_existing_notes(self):
        self.notes.parent.mkdir(parents=True)
        self.notes.write_text("learner content\n", encoding="utf-8")

        result = prepare_notes(self.workspace, "Day 13", dry_run=True)

        self.assertEqual(result.status, "dry-run")
        self.assertIn("# Day 13 学习回答", result.content)
        self.assertEqual(self.notes.read_text(encoding="utf-8"), "learner content\n")

    def test_force_replaces_notes_symlink_without_touching_its_target(self):
        linked_notes = self.workspace / "exercise/day14/notes.md"
        linked_notes.parent.mkdir(parents=True)
        linked_notes.write_text("day14 learner content\n", encoding="utf-8")
        self.notes.parent.mkdir(parents=True)
        self.notes.symlink_to(Path("../day14/notes.md"))

        with self.assertRaisesRegex(PreparationError, "already exists"):
            prepare_notes(self.workspace, "day13")

        result = prepare_notes(self.workspace, "day13", force=True)

        self.assertEqual(result.status, "overwritten")
        self.assertFalse(self.notes.is_symlink())
        self.assertIn("# Day 13 学习回答", self.notes.read_text(encoding="utf-8"))
        self.assertEqual(
            linked_notes.read_text(encoding="utf-8"), "day14 learner content\n"
        )

    def test_cli_runs_end_to_end_in_temporary_workspace(self):
        script = Path(__file__).with_name("prepare_go_day.py")
        dry_run = subprocess.run(
            [
                sys.executable,
                str(script),
                "开始",
                "Day",
                "13",
                "--workspace",
                str(self.workspace),
                "--dry-run",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(dry_run.returncode, 0, dry_run.stderr)
        self.assertIn("# Day 13 学习回答", dry_run.stdout)
        self.assertFalse(self.notes.exists())

        created = subprocess.run(
            [
                sys.executable,
                str(script),
                "创建",
                "day13",
                "笔记",
                "--workspace",
                str(self.workspace),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(created.returncode, 0, created.stderr)
        self.assertEqual(json.loads(created.stdout)["status"], "created")
        self.assertTrue(self.notes.is_file())

        repeated = subprocess.run(
            [
                sys.executable,
                str(script),
                "day13",
                "--workspace",
                str(self.workspace),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(repeated.returncode, 2)
        self.assertIn("already exists", repeated.stderr)


if __name__ == "__main__":
    unittest.main()
