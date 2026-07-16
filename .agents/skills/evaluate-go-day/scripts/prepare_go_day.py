#!/usr/bin/env python3
import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Union

from resolve_go_day import ResolutionError, resolve_day


CORE_SCRIPTS = (
    Path(__file__).resolve().parents[2] / "evaluate-course-lesson/scripts"
)
if str(CORE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(CORE_SCRIPTS))

from evaluation_core import (  # noqa: E402
    EvaluationError,
    prepare_lesson,
    render_notes,
    resolve_lesson,
)


DAY_CANDIDATE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])day(?:[ \t]*-[ \t]*|[ \t]*)([0-9]+)(?![A-Za-z0-9_])",
    re.IGNORECASE,
)
DAY_REFERENCE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])day(?:[ \t]*-[ \t]*|[ \t]*)([0-9]{1,2})(?![A-Za-z0-9_])",
    re.IGNORECASE,
)
AMBIGUOUS_DAY_SEQUENCE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9_])day(?:[ \t]*-[ \t]*|[ \t]*)([0-9]{1,2})"
    r"[ \t]*(?:[-–—~～/&,，、]|to\b|and\b|or\b|至|到|和|与|或)[ \t]*"
    r"(?:day(?:[ \t]*-[ \t]*|[ \t]*))?[0-9]+(?![A-Za-z0-9_])",
    re.IGNORECASE,
)


class PreparationError(ValueError):
    pass


@dataclass(frozen=True)
class PreparationResult:
    day: int
    course_id: str
    lesson_id: str
    course: Path
    notes: Path
    content: str
    status: str
    exercise_status: str


def parse_day(request: str) -> int:
    candidates = [
        int(match.group(1)) for match in DAY_CANDIDATE_PATTERN.finditer(request)
    ]
    if any(day > 36 for day in candidates):
        raise PreparationError("day must be between 0 and 36")
    matches = [
        int(match.group(1)) for match in DAY_REFERENCE_PATTERN.finditer(request)
    ]
    if not matches:
        raise PreparationError("request must contain exactly one explicit Day reference")
    if AMBIGUOUS_DAY_SEQUENCE_PATTERN.search(request) or len(set(matches)) != 1:
        raise PreparationError("request contains ambiguous Day references")
    return matches[0]


def prepare_notes(
    workspace: Union[str, Path],
    request: str,
    *,
    force: bool = False,
    dry_run: bool = False,
    initialize_exercise: bool = False,
    force_exercise: bool = False,
) -> PreparationResult:
    day = parse_day(request)
    try:
        route = resolve_day(
            workspace,
            f"day{day}",
            require_notes=False,
        )
        resolved = resolve_lesson(
            workspace,
            "go-backend",
            str(route["lessonId"]),
        )
        content = render_notes(resolved)
        if dry_run:
            status = "preview"
            exercise_status = "not-requested"
        else:
            prepared = prepare_lesson(
                resolved,
                force_notes=force,
                initialize_exercise=initialize_exercise,
                force_exercise=force_exercise,
            )
            status = prepared.notes_status
            exercise_status = prepared.exercise_status
    except (EvaluationError, ResolutionError) as error:
        raise PreparationError(str(error)) from error
    return PreparationResult(
        day=day,
        course_id="go-backend",
        lesson_id=resolved.lesson_id,
        course=resolved.content,
        notes=resolved.notes,
        content=content,
        status=status,
        exercise_status=exercise_status,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Route one explicit Go Day into the shared Course/Lesson prepare flow."
    )
    parser.add_argument("request", help="Original request containing exactly one Day")
    parser.add_argument("--workspace", default=".", help="Repository root")
    parser.add_argument("--force", action="store_true", help="Replace existing Notes")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--initialize-exercise", action="store_true")
    parser.add_argument("--force-exercise", action="store_true")
    args = parser.parse_args()
    try:
        result = prepare_notes(
            Path(args.workspace),
            args.request,
            force=args.force,
            dry_run=args.dry_run,
            initialize_exercise=args.initialize_exercise,
            force_exercise=args.force_exercise,
        )
    except PreparationError as error:
        print(str(error), file=sys.stderr)
        return 2
    if args.dry_run:
        print(result.content, end="")
    else:
        print(
            json.dumps(
                {
                    "courseId": result.course_id,
                    "lessonId": result.lesson_id,
                    "day": result.day,
                    "course": str(result.course),
                    "notes": str(result.notes),
                    "notesStatus": result.status,
                    "exerciseStatus": result.exercise_status,
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
