#!/usr/bin/env python3
import argparse
import json
import re
import stat
import sys
from pathlib import Path
from typing import Union


CORE_SCRIPTS = (
    Path(__file__).resolve().parents[2] / "evaluate-course-lesson/scripts"
)
if str(CORE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(CORE_SCRIPTS))

from evaluation_core import EvaluationError, resolve_lesson  # noqa: E402


DAY_PATTERN = re.compile(r"^day(?:[0-9]|[12][0-9]|3[0-6])$")


class ResolutionError(ValueError):
    pass


def _read_go_course(workspace: Path) -> dict:
    course_file = workspace / "courses/go-backend/course.json"
    try:
        metadata = course_file.lstat()
    except FileNotFoundError as error:
        raise ResolutionError("canonical Go Course is missing") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise ResolutionError("canonical Go Course must be a regular non-symlink file")
    try:
        value = json.loads(course_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ResolutionError("canonical Go Course is invalid JSON") from error
    if (
        not isinstance(value, dict)
        or value.get("schemaVersion") != 1
        or value.get("courseId") != "go-backend"
        or not isinstance(value.get("tracks"), list)
    ):
        raise ResolutionError("canonical Go Course identity or schema is invalid")
    return value


def _lesson_for_day(course: dict, number: int) -> str:
    matches = []
    for track in course["tracks"]:
        if not isinstance(track, dict) or not isinstance(track.get("stages"), list):
            raise ResolutionError("canonical Go Course track is invalid")
        for stage in track["stages"]:
            if not isinstance(stage, dict) or not isinstance(stage.get("lessons"), list):
                raise ResolutionError("canonical Go Course stage is invalid")
            for lesson in stage["lessons"]:
                if isinstance(lesson, dict) and lesson.get("day") == number:
                    matches.append(lesson.get("lessonId"))
    if (
        len(matches) != 1
        or not isinstance(matches[0], str)
        or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", matches[0])
    ):
        raise ResolutionError(f"expected one explicit Go Day mapping for day{number}")
    return matches[0]


def resolve_day(
    workspace: Union[str, Path],
    day: str,
    *,
    require_notes: bool = True,
) -> dict:
    if not DAY_PATTERN.fullmatch(day):
        raise ResolutionError("day must be explicit and canonical: day0 through day36")
    workspace_path = Path(workspace).resolve()
    number = int(day[3:])
    lesson_id = _lesson_for_day(_read_go_course(workspace_path), number)
    try:
        resolved = resolve_lesson(workspace_path, "go-backend", lesson_id)
    except EvaluationError as error:
        raise ResolutionError(str(error)) from error
    if require_notes:
        try:
            record_metadata = resolved.record_root.lstat()
            notes_metadata = resolved.notes.lstat()
        except FileNotFoundError as error:
            raise ResolutionError(
                f"required learner notes are missing: {resolved.notes}"
            ) from error
        if stat.S_ISLNK(record_metadata.st_mode) or not stat.S_ISDIR(
            record_metadata.st_mode
        ):
            raise ResolutionError("Learning Record directory must be a non-symlink")
        if stat.S_ISLNK(notes_metadata.st_mode) or not stat.S_ISREG(
            notes_metadata.st_mode
        ):
            raise ResolutionError("learner notes must be a regular non-symlink file")
        try:
            resolved.notes.resolve().relative_to(resolved.record_root.resolve())
        except ValueError as error:
            raise ResolutionError("learner notes escape the Learning Record") from error
    return {
        "courseId": "go-backend",
        "lessonId": lesson_id,
        "day": f"day{number}",
        "number": number,
        "course": resolved.content,
        "policy": resolved.evaluation_policy,
        "commandProfile": resolved.command_profile,
        "notes": resolved.notes,
        "evaluation": resolved.evaluation,
        "exercise": resolved.exercise,
        "evaluationRevision": resolved.evaluation_revision,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Route one explicit Go Day to the canonical go-backend Course."
    )
    parser.add_argument("day", help="Canonical day argument: day0 through day36")
    parser.add_argument("--workspace", default=".", help="Repository root")
    parser.add_argument("--allow-missing-notes", action="store_true")
    args = parser.parse_args()
    try:
        result = resolve_day(
            Path(args.workspace),
            args.day,
            require_notes=not args.allow_missing_notes,
        )
    except ResolutionError as error:
        print(str(error), file=sys.stderr)
        return 2
    print(
        json.dumps(
            {key: str(value) if isinstance(value, Path) else value for key, value in result.items()},
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
