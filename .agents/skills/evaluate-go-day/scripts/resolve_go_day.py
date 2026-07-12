#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from pathlib import Path


DAY_PATTERN = re.compile(r"^day(?:[0-9]|[12][0-9]|3[0-6])$")


class ResolutionError(ValueError):
    pass


def _ensure_within_workspace(workspace: Path, path: Path) -> None:
    workspace_real = workspace.resolve()
    path_real = path.resolve()
    if os.path.commonpath((str(workspace_real), str(path_real))) != str(workspace_real):
        raise ResolutionError(f"path escapes workspace: {path}")


def resolve_day(workspace: Path, day: str) -> dict[str, object]:
    if not DAY_PATTERN.fullmatch(day):
        raise ResolutionError("day must be explicit and canonical: day0 through day36")

    workspace = workspace.resolve()
    if not workspace.is_dir():
        raise ResolutionError(f"workspace does not exist: {workspace}")

    number = int(day[3:])
    lessons_dir = workspace / "docs/go-learning/daily-lessons"
    matches = sorted(lessons_dir.glob(f"day-{number:02d}-*.md"))
    if len(matches) != 1:
        raise ResolutionError(
            f"expected exactly one course file for {day}, found {len(matches)}"
        )

    exercise_dir = workspace / "exercise" / f"day{number}"
    notes = exercise_dir / "notes.md"
    evaluation = exercise_dir / "notes-eval.md"
    if not notes.is_file():
        raise ResolutionError(f"required learner file is missing: {notes}")

    for path in (matches[0], notes, evaluation.parent):
        _ensure_within_workspace(workspace, path)

    return {
        "day": f"day{number}",
        "number": number,
        "course": matches[0],
        "notes": notes,
        "evaluation": evaluation,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Resolve one explicit Go course day without reading adjacent days."
    )
    parser.add_argument("day", help="Canonical day argument: day0 through day36")
    parser.add_argument("--workspace", default=".", help="Repository root")
    args = parser.parse_args()

    try:
        result = resolve_day(Path(args.workspace), args.day)
    except ResolutionError as error:
        print(str(error), file=sys.stderr)
        return 2

    print(json.dumps({key: str(value) for key, value in result.items()}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
