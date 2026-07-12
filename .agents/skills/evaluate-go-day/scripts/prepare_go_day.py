#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


DAY_REFERENCE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])day(?:[ \t]*-[ \t]*|[ \t]*)([0-9]{1,2})"
    r"(?![A-Za-z0-9_])",
    re.IGNORECASE,
)
COURSE_TITLE_PATTERN = re.compile(
    r"^#\s+Day\s+([0-9]{2})(?:\s*[：:].*)?$", re.IGNORECASE
)
ATX_HEADING_PATTERN = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t]*$")
FENCE_PATTERN = re.compile(r"^[ \t]{0,3}(`{3,}|~{3,})")
LIST_ITEM_PATTERN = re.compile(r"^[ \t]{0,3}(?:[-+*]|[0-9]+[.)])[ \t]+")

STANDARD_REQUIRED_SECTIONS = (
    "学习目标",
    "实践步骤",
    "建议文件",
    "测试/验证命令",
    "检索问题",
)
COMPLETION_SECTION_TITLES = ("完成标准", "完成条件", "完成定义", "验收标准")


class PreparationError(ValueError):
    pass


@dataclass(frozen=True)
class DayPaths:
    course: Path
    notes: Path


@dataclass(frozen=True)
class CourseSection:
    title: str
    body: str


@dataclass(frozen=True)
class CourseMaterial:
    day: int
    title: str
    sections: tuple


@dataclass(frozen=True)
class PreparationResult:
    day: int
    course: Path
    notes: Path
    content: str
    status: str


@dataclass(frozen=True)
class _Heading:
    line: int
    level: int
    title: str


def parse_day(request: str) -> int:
    matches = [int(match.group(1)) for match in DAY_REFERENCE_PATTERN.finditer(request)]
    if not matches:
        raise PreparationError(
            "request must contain exactly one explicit Day reference"
        )
    if any(day < 0 or day > 36 for day in matches):
        raise PreparationError("day must be between 0 and 36")

    days = set(matches)
    if len(days) != 1:
        raise PreparationError("request contains ambiguous Day references")
    return days.pop()


def _ensure_within_workspace(workspace: Path, path: Path) -> None:
    workspace_real = workspace.resolve()
    path_real = path.resolve()
    if os.path.commonpath((str(workspace_real), str(path_real))) != str(workspace_real):
        raise PreparationError(f"path escapes workspace: {path}")


def discover_day_paths(workspace: Path, day: int) -> DayPaths:
    if day < 0 or day > 36:
        raise PreparationError("day must be between 0 and 36")

    workspace = workspace.resolve()
    if not workspace.is_dir():
        raise PreparationError(f"workspace does not exist: {workspace}")

    lessons = workspace / "docs/go-learning/daily-lessons"
    matches = sorted(path for path in lessons.glob(f"day-{day:02d}-*.md") if path.is_file())
    if len(matches) != 1:
        raise PreparationError(
            f"expected exactly one course file for day{day}, found {len(matches)}"
        )

    course = matches[0].resolve()
    notes = workspace / "exercise" / f"day{day}" / "notes.md"
    _ensure_within_workspace(workspace, course)
    _ensure_within_workspace(workspace, notes)

    first_line = course.read_text(encoding="utf-8").splitlines()[:1]
    heading = COURSE_TITLE_PATTERN.fullmatch(first_line[0]) if first_line else None
    if heading is None or int(heading.group(1)) != day:
        raise PreparationError(f"course heading does not match day{day}: {course}")

    return DayPaths(course=course, notes=notes)


def _parse_headings(lines: list[str]) -> list[_Heading]:
    headings = []
    fence_character = None
    fence_length = 0

    for index, line in enumerate(lines):
        fence = FENCE_PATTERN.match(line)
        if fence_character is not None:
            marker = fence.group(1) if fence else ""
            if marker.startswith(fence_character) and len(marker) >= fence_length:
                fence_character = None
                fence_length = 0
            continue
        if fence:
            marker = fence.group(1)
            fence_character = marker[0]
            fence_length = len(marker)
            continue

        match = ATX_HEADING_PATTERN.match(line)
        if not match:
            continue
        title = re.sub(r"[ \t]+#+[ \t]*$", "", match.group(2)).strip()
        headings.append(_Heading(index, len(match.group(1)), title))

    return headings


def _section_bodies(lines: list[str], headings: list[_Heading]) -> dict[str, str]:
    bodies = {}
    for position, heading in enumerate(headings):
        end = len(lines)
        for following in headings[position + 1 :]:
            if following.level <= heading.level:
                end = following.line
                break
        body = "\n".join(lines[heading.line + 1 : end]).strip()
        if heading.title in bodies:
            raise PreparationError(f"duplicate course section: {heading.title}")
        bodies[heading.title] = body
    return bodies


def _extract_first_list(section_title: str, body: str) -> str:
    lines = body.splitlines()
    start = next(
        (index for index, line in enumerate(lines) if LIST_ITEM_PATTERN.match(line)),
        None,
    )
    if start is None:
        raise PreparationError(f"course section has no explicit list: {section_title}")

    selected = []
    for line in lines[start:]:
        if LIST_ITEM_PATTERN.match(line):
            selected.append(line.rstrip())
            continue
        if not line.strip() and selected:
            selected.append("")
            continue
        break

    while selected and not selected[-1]:
        selected.pop()
    return "\n".join(selected)


def _day_zero_goal(lines: list[str], headings: list[_Heading]) -> str:
    first_section_line = next(
        (heading.line for heading in headings[1:] if heading.level == 2), len(lines)
    )
    preamble = "\n".join(lines[1:first_section_line]).strip()
    blocks = [block.strip() for block in re.split(r"\n[ \t]*\n", preamble)]
    goal_blocks = [
        block
        for block in blocks
        if block
        and not block.startswith("English title:")
        and not block.startswith("返回：")
    ]
    if len(goal_blocks) != 1:
        raise PreparationError("expected exactly one Day 0 goal paragraph")
    return goal_blocks[0]


def extract_course_material(course: Path, day: int) -> CourseMaterial:
    lines = course.read_text(encoding="utf-8").splitlines()
    headings = _parse_headings(lines)
    if not headings or headings[0].line != 0 or headings[0].level != 1:
        raise PreparationError(f"course must start with one H1 heading: {course}")

    title_match = re.fullmatch(
        r"Day\s+([0-9]{2})(?:\s*[：:].*)?", headings[0].title, re.IGNORECASE
    )
    if title_match is None or int(title_match.group(1)) != day:
        raise PreparationError(f"course heading does not match day{day}: {course}")

    bodies = _section_bodies(lines, headings[1:])
    if day == 0:
        question_body = bodies.get("今天的检索问题")
        if question_body is None:
            raise PreparationError("missing required course section: 今天的检索问题")
        sections = (
            CourseSection("学习目标", _day_zero_goal(lines, headings)),
            CourseSection(
                "今天的检索问题",
                _extract_first_list("今天的检索问题", question_body),
            ),
        )
        return CourseMaterial(day=day, title=headings[0].title, sections=sections)

    missing = [title for title in STANDARD_REQUIRED_SECTIONS if title not in bodies]
    if missing:
        raise PreparationError(f"missing required course sections: {', '.join(missing)}")

    completion = [title for title in COMPLETION_SECTION_TITLES if title in bodies]
    if len(completion) > 1:
        raise PreparationError("course has ambiguous completion sections")

    sections = [
        CourseSection("学习目标", bodies["学习目标"]),
        CourseSection("实践步骤", _extract_first_list("实践步骤", bodies["实践步骤"])),
    ]
    if completion:
        title = completion[0]
        sections.append(CourseSection(title, bodies[title]))
    sections.extend(
        (
            CourseSection(
                "建议文件", _extract_first_list("建议文件", bodies["建议文件"])
            ),
            CourseSection("测试/验证命令", bodies["测试/验证命令"]),
            CourseSection(
                "检索问题", _extract_first_list("检索问题", bodies["检索问题"])
            ),
        )
    )
    if day == 36 and "Capstone rubric 对齐" in bodies:
        sections.append(
            CourseSection("Capstone rubric 对齐", bodies["Capstone rubric 对齐"])
        )

    return CourseMaterial(day=day, title=headings[0].title, sections=tuple(sections))


def render_notes(material: CourseMaterial, paths: DayPaths) -> str:
    course_link = os.path.relpath(paths.course, paths.notes.parent).replace(os.sep, "/")
    lines = [
        f"# Day {material.day} 学习回答",
        "",
        f"课程：[{material.title}]({course_link})",
        "",
        "本文件只由学习者填写。评测 Skill 只读取，不代写、不润色。",
        "",
        "## 当日要求（课程原文）",
        "",
    ]
    for section in material.sections:
        lines.extend((f"### {section.title}", "", section.body, ""))
    lines.extend(
        (
            "## 回答记录",
            "",
            "每次收到一道评测问题后，按顺序追加：",
            "",
            "```markdown",
            "### 回答 1",
            "",
            "- 问题：",
            "- 回答：",
            "```",
            "",
            "## 当日产物与验证证据",
            "",
            "- 产物路径：",
            "- 验证命令：",
            "- 结果摘要：",
        )
    )
    return "\n".join(lines).rstrip() + "\n"


def _write_atomic(target: Path, content: str, overwrite: bool) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{target.name}.", dir=str(target.parent)
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.chmod(0o644)

        if overwrite:
            os.replace(str(temporary), str(target))
        else:
            try:
                os.link(str(temporary), str(target))
            except FileExistsError as error:
                raise PreparationError(f"notes file already exists: {target}") from error
            temporary.unlink()
    finally:
        if temporary.exists():
            temporary.unlink()


def prepare_notes(
    workspace: Path, request: str, *, force: bool = False, dry_run: bool = False
) -> PreparationResult:
    day = parse_day(request)
    paths = discover_day_paths(Path(workspace), day)
    existed = os.path.lexists(str(paths.notes))
    if existed and not force and not dry_run:
        raise PreparationError(f"notes file already exists: {paths.notes}")

    material = extract_course_material(paths.course, day)
    content = render_notes(material, paths)
    if dry_run:
        return PreparationResult(day, paths.course, paths.notes, content, "dry-run")

    _write_atomic(paths.notes, content, overwrite=force)
    status = "overwritten" if existed else "created"
    return PreparationResult(day, paths.course, paths.notes, content, status)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="从指定 Day 的课程原文安全创建学习回答 notes.md。"
    )
    parser.add_argument(
        "request",
        nargs="+",
        help="包含唯一 Day 引用的命令，如：开始 Day 13",
    )
    parser.add_argument("--workspace", default=".", help="仓库根目录")
    parser.add_argument(
        "--dry-run", action="store_true", help="只输出内容，不创建目录或文件"
    )
    parser.add_argument(
        "--force", action="store_true", help="明确覆盖已存在的 notes.md"
    )
    args = parser.parse_args(argv)

    try:
        result = prepare_notes(
            Path(args.workspace),
            " ".join(args.request),
            force=args.force,
            dry_run=args.dry_run,
        )
    except (PreparationError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 2

    if args.dry_run:
        sys.stdout.write(result.content)
    else:
        print(
            json.dumps(
                {
                    "day": f"day{result.day}",
                    "course": str(result.course),
                    "notes": str(result.notes),
                    "status": result.status,
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
