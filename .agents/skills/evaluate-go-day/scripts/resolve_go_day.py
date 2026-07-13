#!/usr/bin/env python3
import argparse
import json
import re
import stat
import sys
from pathlib import Path
from typing import Optional, Union


CORE_SCRIPTS = (
    Path(__file__).resolve().parents[2] / "evaluate-course-lesson/scripts"
)
if str(CORE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(CORE_SCRIPTS))

from evaluation_core import EvaluationError, resolve_lesson  # noqa: E402


DAY_PATTERN = re.compile(r"^day(?:[0-9]|[12][0-9]|3[0-6])$")
DEFAULT_ADAPTER = (
    Path(__file__).resolve().parents[1]
    / "references/go-backend-legacy-adapter.json"
)


class ResolutionError(ValueError):
    pass


def _read_adapter(path: Path) -> dict:
    try:
        metadata = path.lstat()
    except FileNotFoundError as error:
        raise ResolutionError(f"Go Course mapping is missing: {path}") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise ResolutionError("Go Course mapping must be a regular non-symlink file")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ResolutionError("Go Course mapping is invalid JSON") from error
    if not isinstance(value, dict) or value.get("courseId") != "go-backend":
        raise ResolutionError("Go Course mapping identity is invalid")
    if value.get("schemaVersion") != 1 or not isinstance(value.get("lessons"), list):
        raise ResolutionError("Go Course mapping schema is invalid")
    return value


def resolve_day(
    workspace: Union[str, Path],
    day: str,
    *,
    adapter_path: Optional[Union[str, Path]] = None,
    require_notes: bool = True,
) -> dict:
    if not DAY_PATTERN.fullmatch(day):
        raise ResolutionError("day must be explicit and canonical: day0 through day36")
    number = int(day[3:])
    adapter = Path(adapter_path) if adapter_path is not None else DEFAULT_ADAPTER
    mapping = _read_adapter(adapter)
    matches = [
        item
        for item in mapping["lessons"]
        if isinstance(item, dict) and item.get("day") == number
    ]
    if len(matches) != 1 or not isinstance(matches[0].get("lessonId"), str):
        raise ResolutionError(f"expected one explicit Go Day mapping for {day}")
    lesson_id = matches[0]["lessonId"]
    try:
        resolved = resolve_lesson(
            workspace,
            "go-backend",
            lesson_id,
            adapter_path=adapter,
        )
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
        "adapter": adapter.resolve(),
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
        description="Route one explicit Go Day to go-backend and the shared Evaluation Core."
    )
    parser.add_argument("day", help="Canonical day argument: day0 through day36")
    parser.add_argument("--workspace", default=".", help="Repository root")
    parser.add_argument("--adapter", help=argparse.SUPPRESS)
    parser.add_argument("--allow-missing-notes", action="store_true")
    args = parser.parse_args()
    try:
        result = resolve_day(
            Path(args.workspace),
            args.day,
            adapter_path=args.adapter,
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
