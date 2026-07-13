#!/usr/bin/env python3
import argparse
import base64
import hashlib
import json
import math
import os
import re
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple, Union


ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REVISION_PATTERN = re.compile(r"^sha256:[a-f0-9]{64}$")
SENSITIVE_PATTERNS = (
    re.compile(r"\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bAuthorization\s*:\s*\S+", re.IGNORECASE),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}\b", re.IGNORECASE),
    re.compile(r"\b(?:postgres|mysql|mongodb(?:\+srv)?|redis)://[^\s]+", re.IGNORECASE),
)
PROBLEM_TYPES = {"概念混淆", "机制缺失", "边界不清", "证据不足", "已达标"}
FORBIDDEN_ARGUMENT = re.compile(r"(?:&&|\|\||[;|<>`]|\$\(|\r|\n|\x00)")
EVALUATION_BLOCK = re.compile(
    r"```evaluation-record\n(?P<record>\{.*?\})\n```", re.DOTALL
)


class EvaluationError(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedLesson:
    workspace: Path
    course_id: str
    lesson_id: str
    day: Optional[int]
    title: str
    objective: str
    goals: Tuple[str, ...]
    course_lifecycle: str
    lifecycle: str
    content: Path
    evaluation_policy: Path
    command_profile: Path
    exercise_template: Optional[Path]
    record_root: Path
    notes: Path
    evaluation: Path
    exercise: Path
    evaluation_revision: str
    competencies: Tuple[Tuple[str, str], ...]


@dataclass(frozen=True)
class PreparationResult:
    notes_status: str
    exercise_status: str


@dataclass(frozen=True)
class CommandPlan:
    command_id: str
    argv: Tuple[str, ...]
    workspace: Path
    cwd: Path
    environment: Dict[str, str]
    timeout_seconds: int
    network_denied: bool
    shadow_workspace: bool


@dataclass(frozen=True)
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str


def _require_id(value: object, context: str) -> str:
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise EvaluationError(f"{context} must be an explicit kebab-case ID")
    return value


def _exact(value: object, keys: Iterable[str], context: str) -> dict:
    if not isinstance(value, dict):
        raise EvaluationError(f"{context} must be an object")
    expected = set(keys)
    actual = set(value)
    if actual != expected:
        raise EvaluationError(
            f"{context} fields differ: expected {sorted(expected)}, got {sorted(actual)}"
        )
    return value


def _read_regular(path: Path, context: str) -> str:
    try:
        metadata = path.lstat()
    except FileNotFoundError as error:
        raise EvaluationError(f"{context} is missing: {path}") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise EvaluationError(f"{context} must be a regular non-symlink file: {path}")
    return path.read_text(encoding="utf-8")


def _read_json(path: Path, context: str) -> dict:
    source = _read_regular(path, context)
    try:
        value = json.loads(source)
    except json.JSONDecodeError as error:
        raise EvaluationError(f"{context} is not valid JSON") from error
    if not isinstance(value, dict):
        raise EvaluationError(f"{context} must be a JSON object")
    return value


def _is_within(parent: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(parent)
        return True
    except ValueError:
        return False


def _require_non_symlink_chain(
    workspace: Path, candidate: Path, context: str
) -> None:
    workspace_root = workspace.resolve()
    logical_candidate = candidate.absolute()
    if not _is_within(workspace_root, logical_candidate):
        raise EvaluationError(f"{context} escapes workspace")
    current = workspace_root
    for part in logical_candidate.relative_to(workspace_root).parts:
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError as error:
            raise EvaluationError(f"{context} is missing: {current}") from error
        if stat.S_ISLNK(metadata.st_mode):
            raise EvaluationError(f"{context} ancestor must not be a symlink: {current}")
    if not _is_within(workspace_root, logical_candidate.resolve()):
        raise EvaluationError(f"{context} real path escapes workspace")


def _safe_relative(value: object, context: str) -> Path:
    if not isinstance(value, str) or not value or "\\" in value:
        raise EvaluationError(f"{context} must be a safe relative POSIX path")
    candidate = Path(value)
    if candidate.is_absolute() or any(part in ("", ".", "..") for part in candidate.parts):
        raise EvaluationError(f"{context} must be a safe relative POSIX path")
    return candidate


def _resolve_owned_file(
    workspace: Path, owner: Path, relative: object, context: str
) -> Path:
    candidate = owner / _safe_relative(relative, context)
    _require_non_symlink_chain(workspace, owner, f"{context} owner")
    _require_non_symlink_chain(workspace, candidate, context)
    resolved_workspace = workspace.resolve()
    resolved_owner = owner.resolve()
    resolved = candidate.resolve()
    if (
        not _is_within(resolved_workspace, resolved_owner)
        or not _is_within(resolved_workspace, resolved)
        or not _is_within(resolved_owner, resolved)
    ):
        raise EvaluationError(f"{context} escapes its owner")
    _read_regular(candidate, context)
    return candidate


def _canonical_json(value: object) -> str:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )


def _revision(value: object) -> str:
    return "sha256:" + hashlib.sha256(
        _canonical_json(value).encode("utf-8")
    ).hexdigest()


def _normalized_text(path: Path, context: str) -> str:
    return _read_regular(path, context).replace("\r\n", "\n")


def _evaluation_revision(
    evaluation: dict,
    policy: Path,
    profile: Path,
    template: Optional[Path],
) -> str:
    return _revision(
        {
            "evaluation": evaluation,
            "policy": _normalized_text(policy, "evaluation policy"),
            "commandProfile": _normalized_text(profile, "command profile"),
            "exerciseTemplate": (
                None
                if template is None
                else _normalized_text(template, "exercise template")
            ),
        }
    )


def _parse_evaluation_contract(value: object) -> Tuple[dict, Tuple[Tuple[str, str], ...]]:
    evaluation = _exact(
        value,
        ("competencies", "requiredEvidence", "scoringBasis"),
        "lesson.evaluation",
    )
    if not isinstance(evaluation["competencies"], list) or not evaluation["competencies"]:
        raise EvaluationError("lesson.evaluation.competencies must be non-empty")
    competencies: List[Tuple[str, str]] = []
    for index, candidate in enumerate(evaluation["competencies"]):
        item = _exact(candidate, ("competencyId", "title"), f"competency[{index}]")
        competency_id = _require_id(item["competencyId"], "competencyId")
        if not isinstance(item["title"], str) or not item["title"].strip():
            raise EvaluationError("competency title must be non-empty")
        competencies.append((competency_id, item["title"].strip()))
    if len({item[0] for item in competencies}) != len(competencies):
        raise EvaluationError("competency IDs must be unique")
    for key in ("requiredEvidence", "scoringBasis"):
        if not isinstance(evaluation[key], list) or not all(
            isinstance(item, str) and item.strip() for item in evaluation[key]
        ):
            raise EvaluationError(f"lesson.evaluation.{key} must contain strings")
    return evaluation, tuple(competencies)


def _find_manifest_lesson(course: dict, lesson_id: str) -> dict:
    found = []
    tracks = course.get("tracks")
    if not isinstance(tracks, list):
        raise EvaluationError("source Course tracks must be an array")
    seen_lessons = set()
    seen_days = set()
    for track in tracks:
        if not isinstance(track, dict) or not isinstance(track.get("stages"), list):
            raise EvaluationError("source Course track is invalid")
        for stage in track["stages"]:
            if not isinstance(stage, dict) or not isinstance(stage.get("lessons"), list):
                raise EvaluationError("source Course stage is invalid")
            for lesson in stage["lessons"]:
                if not isinstance(lesson, dict):
                    raise EvaluationError("source Course lesson is invalid")
                current_id = _require_id(lesson.get("lessonId"), "lessonId")
                if current_id in seen_lessons:
                    raise EvaluationError("source Course has duplicate lessonId")
                seen_lessons.add(current_id)
                day = lesson.get("day")
                if day is not None:
                    if not isinstance(day, int) or isinstance(day, bool) or day < 0:
                        raise EvaluationError("Day must be null or a non-negative integer")
                    if day in seen_days:
                        raise EvaluationError("source Course has duplicate Day")
                    seen_days.add(day)
                if current_id == lesson_id:
                    found.append(lesson)
    if len(found) != 1:
        raise EvaluationError(f"unknown Lesson for explicit identity: {lesson_id}")
    return found[0]


def _resolve_canonical(workspace: Path, course_id: str, lesson_id: str) -> ResolvedLesson:
    _require_non_symlink_chain(
        workspace, workspace / "courses/catalog.json", "Course Catalog"
    )
    catalog = _exact(
        _read_json(workspace / "courses/catalog.json", "Course Catalog"),
        ("schemaVersion", "defaultCourseId", "courses"),
        "Course Catalog",
    )
    if catalog["schemaVersion"] != 1 or not isinstance(catalog["courses"], list):
        raise EvaluationError("Course Catalog schema is invalid")
    matches = [
        item
        for item in catalog["courses"]
        if isinstance(item, dict) and item.get("courseId") == course_id
    ]
    if len(matches) != 1:
        raise EvaluationError(f"unknown Course for explicit identity: {course_id}")
    catalog_course = _exact(
        matches[0],
        (
            "courseId",
            "title",
            "language",
            "lifecycle",
            "replacementCourseId",
            "manifestPath",
        ),
        "Catalog Course",
    )
    expected_manifest = f"courses/{course_id}/course.json"
    if catalog_course["manifestPath"] != expected_manifest:
        raise EvaluationError("Catalog manifestPath cannot replace Course identity")
    course_root = workspace / "courses" / course_id
    _require_non_symlink_chain(
        workspace, course_root / "course.json", "Source Course"
    )
    course = _exact(
        _read_json(course_root / "course.json", "Source Course"),
        (
            "schemaVersion",
            "courseId",
            "title",
            "description",
            "language",
            "lifecycle",
            "replacementCourseId",
            "evaluationPolicyPath",
            "commandProfilePath",
            "publicResources",
            "internalResources",
            "tracks",
        ),
        "Source Course",
    )
    if course["schemaVersion"] != 1 or course["courseId"] != course_id:
        raise EvaluationError("Source Course identity or schema is invalid")
    if course["lifecycle"] != catalog_course["lifecycle"]:
        raise EvaluationError("Catalog and Source Course lifecycle differ")
    if course["lifecycle"] == "draft":
        raise EvaluationError("Draft Course cannot start learning")
    lesson = _find_manifest_lesson(course, lesson_id)
    required_lesson_keys = {
        "lessonId",
        "lifecycle",
        "day",
        "title",
        "objective",
        "goals",
        "contentPath",
        "exerciseTemplatePath",
        "evaluation",
    }
    if set(lesson) != required_lesson_keys:
        raise EvaluationError("Source Lesson fields differ from the contract")
    if lesson["contentPath"] != f"lessons/{lesson_id}.md":
        raise EvaluationError("contentPath cannot replace Lesson identity")
    content = _resolve_owned_file(
        workspace, course_root, lesson["contentPath"], "Lesson content"
    )
    policy = _resolve_owned_file(
        workspace,
        course_root,
        course["evaluationPolicyPath"],
        "Course Evaluation Policy",
    )
    profile = _resolve_owned_file(
        workspace,
        course_root,
        course["commandProfilePath"],
        "Command Profile",
    )
    template_value = lesson["exerciseTemplatePath"]
    if template_value is not None:
        template_relative = _safe_relative(
            template_value, "Lesson exerciseTemplatePath"
        )
        if (
            len(template_relative.parts) < 3
            or template_relative.parts[:2] != ("exercise-templates", lesson_id)
        ):
            raise EvaluationError(
                "Lesson exerciseTemplatePath must match its stable identity"
            )
    template = (
        None
        if template_value is None
        else _resolve_owned_file(
            workspace, course_root, template_value, "Exercise Template"
        )
    )
    evaluation, competencies = _parse_evaluation_contract(lesson["evaluation"])
    record_root = workspace / "learning-records" / course_id / "lessons" / lesson_id
    return ResolvedLesson(
        workspace=workspace,
        course_id=course_id,
        lesson_id=lesson_id,
        day=lesson["day"],
        title=str(lesson["title"]),
        objective=str(lesson["objective"]),
        goals=tuple(str(goal) for goal in lesson["goals"]),
        course_lifecycle=str(course["lifecycle"]),
        lifecycle=str(lesson["lifecycle"]),
        content=content,
        evaluation_policy=policy,
        command_profile=profile,
        exercise_template=template,
        record_root=record_root,
        notes=record_root / "notes.md",
        evaluation=record_root / "evaluation.md",
        exercise=record_root / "exercise",
        evaluation_revision=_evaluation_revision(evaluation, policy, profile, template),
        competencies=competencies,
    )


def resolve_lesson(
    workspace: Union[str, Path],
    course_id: str,
    lesson_id: str,
) -> ResolvedLesson:
    workspace_path = Path(workspace).resolve()
    if not workspace_path.is_dir():
        raise EvaluationError(f"workspace does not exist: {workspace_path}")
    course = _require_id(course_id, "courseId")
    lesson = _require_id(lesson_id, "lessonId")
    return _resolve_canonical(workspace_path, course, lesson)


def _ensure_safe_directory(workspace: Path, directory: Path) -> None:
    workspace = workspace.resolve()
    if not _is_within(workspace, directory.resolve()):
        raise EvaluationError(f"directory escapes workspace: {directory}")
    relative = directory.relative_to(workspace)
    current = workspace
    for part in relative.parts:
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            current.mkdir()
            continue
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise EvaluationError(f"directory must be non-symlink: {current}")


def _atomic_text(
    workspace: Path, target: Path, content: str, *, replace: bool
) -> None:
    _ensure_safe_directory(workspace, target.parent)
    if target.exists() or target.is_symlink():
        metadata = target.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
            raise EvaluationError(f"target must be a regular non-symlink file: {target}")
        if not replace:
            raise EvaluationError(f"file already exists: {target}")
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        if replace:
            os.replace(temporary, target)
        else:
            try:
                os.link(temporary, target)
            except FileExistsError as error:
                raise EvaluationError(f"file already exists: {target}") from error
            temporary.unlink()
    finally:
        if temporary.exists():
            temporary.unlink()


def render_notes(resolved: ResolvedLesson) -> str:
    goals = "\n".join(f"- {goal}" for goal in resolved.goals)
    return (
        f"# {resolved.title} 学习记录\n\n"
        f"稳定身份：`{resolved.course_id} / {resolved.lesson_id}`\n\n"
        f"课程：[{resolved.title}]({os.path.relpath(resolved.content, resolved.notes.parent).replace(os.sep, '/')})\n\n"
        "本文件只由学习者填写；评测不得代写、润色或提供答案。\n\n"
        f"## 学习目标\n\n{resolved.objective}\n\n{goals}\n\n"
        "## 回答记录\n\n"
        "每次只追加当前问题与自己的回答。\n\n"
        "## Exercise 与验证证据\n\n"
        "- 产物路径：\n- 验证命令：\n- 结果摘要：\n"
    )


def _copy_template(resolved: ResolvedLesson, *, force: bool) -> str:
    if resolved.exercise_template is None:
        raise EvaluationError("Lesson has no Exercise Template")
    target = resolved.exercise
    _ensure_safe_directory(resolved.workspace, target.parent)
    if target.exists() or target.is_symlink():
        metadata = target.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise EvaluationError(f"exercise target must be a non-symlink directory: {target}")
        if not force:
            raise EvaluationError(f"exercise already exists: {target}")
    temporary = Path(tempfile.mkdtemp(prefix=".exercise.", dir=target.parent))
    try:
        parts = resolved.exercise_template.parts
        markers = [
            index
            for index in range(len(parts) - 1)
            if parts[index] == "exercise-templates"
            and parts[index + 1] == resolved.lesson_id
        ]
        if len(markers) != 1 or markers[0] + 2 >= len(parts):
            raise EvaluationError("Exercise Template path differs from Lesson identity")
        relative = Path(*parts[markers[0] + 2 :])
        destination = temporary / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(resolved.exercise_template, destination)
        if target.exists():
            backup = target.parent / f".{target.name}.backup"
            if backup.exists():
                raise EvaluationError("stale exercise backup blocks replacement")
            target.rename(backup)
            try:
                temporary.rename(target)
            except Exception:
                backup.rename(target)
                raise
            shutil.rmtree(backup)
        else:
            temporary.rename(target)
        return "created" if not force else "replaced"
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def prepare_lesson(
    resolved: ResolvedLesson,
    *,
    force_notes: bool = False,
    initialize_exercise: bool = False,
    force_exercise: bool = False,
) -> PreparationResult:
    if resolved.course_lifecycle == "retired" or resolved.lifecycle == "retired":
        raise EvaluationError("Retired Course or Lesson cannot be prepared")
    _ensure_safe_directory(resolved.workspace, resolved.notes.parent)
    _atomic_text(
        resolved.workspace,
        resolved.notes,
        render_notes(resolved),
        replace=force_notes,
    )
    exercise_status = "not-requested"
    if initialize_exercise:
        exercise_status = _copy_template(resolved, force=force_exercise)
    return PreparationResult(
        notes_status="replaced" if force_notes else "created",
        exercise_status=exercise_status,
    )


def _new_record(resolved: ResolvedLesson) -> dict:
    return {
        "schemaVersion": 2,
        "courseId": resolved.course_id,
        "lessonId": resolved.lesson_id,
        "legacySourceBase64": None,
        "cycles": [],
        "events": [],
    }


def _validate_record(record: object) -> dict:
    value = _exact(
        record,
        (
            "schemaVersion",
            "courseId",
            "lessonId",
            "legacySourceBase64",
            "cycles",
            "events",
        ),
        "Evaluation Record",
    )
    if value["schemaVersion"] != 2:
        raise EvaluationError("Evaluation Record schemaVersion must be 2")
    _require_id(value["courseId"], "Evaluation courseId")
    _require_id(value["lessonId"], "Evaluation lessonId")
    legacy = value["legacySourceBase64"]
    if legacy is not None:
        if not isinstance(legacy, str) or len(legacy) > 2_000_000:
            raise EvaluationError("legacySourceBase64 is invalid")
        try:
            base64.b64decode(legacy, validate=True)
        except ValueError as error:
            raise EvaluationError("legacySourceBase64 is invalid") from error
    if not isinstance(value["cycles"], list) or not isinstance(value["events"], list):
        raise EvaluationError("Evaluation cycles and events must be arrays")
    cycle_competencies: Dict[int, Dict[str, dict]] = {}
    passed_revisions = set()
    for index, cycle in enumerate(value["cycles"]):
        parsed = _exact(
            cycle,
            (
                "cycle",
                "evaluationRevision",
                "status",
                "referenceScore",
                "currentCompetencyId",
                "competencies",
            ),
            f"Evaluation cycle[{index}]",
        )
        if parsed["cycle"] != index + 1 or not REVISION_PATTERN.fullmatch(
            str(parsed["evaluationRevision"])
        ):
            raise EvaluationError("Evaluation cycle sequence or revision is invalid")
        if parsed["status"] not in ("未开始", "定向回炉", "重新学习", "通过"):
            raise EvaluationError("Evaluation cycle contains an unknown status")
        if parsed["evaluationRevision"] in passed_revisions:
            raise EvaluationError("同一 evaluationRevision 的通过是终态")
        if not isinstance(parsed["competencies"], list) or not parsed["competencies"]:
            raise EvaluationError("Evaluation cycle competencies must be non-empty")
        competencies: Dict[str, dict] = {}
        for competency_index, candidate in enumerate(parsed["competencies"]):
            competency = _exact(
                candidate,
                ("competencyId", "score", "attempts"),
                f"Evaluation cycle[{index}].competencies[{competency_index}]",
            )
            competency_id = _require_id(
                competency["competencyId"], "Evaluation competencyId"
            )
            score = competency["score"]
            attempts = competency["attempts"]
            if (
                not isinstance(score, int)
                or isinstance(score, bool)
                or score < 0
                or score > 4
            ):
                raise EvaluationError("Evaluation competency score must be 0 through 4")
            if (
                not isinstance(attempts, int)
                or isinstance(attempts, bool)
                or attempts < 0
                or attempts > 3
            ):
                raise EvaluationError("Evaluation competency attempts must be 0 through 3")
            if competency_id in competencies:
                raise EvaluationError("Evaluation competency IDs must be unique per cycle")
            competencies[competency_id] = competency
        scores = [int(item["score"]) for item in competencies.values()]
        calculated = math.floor(sum(scores) * 100 / (len(scores) * 4) + 0.5)
        below = [
            item for item in competencies.values() if int(item["score"]) < 3
        ]
        status = parsed["status"]
        reference_score = parsed["referenceScore"]
        if status == "未开始":
            if reference_score is not None or any(
                int(item["score"]) != 0 or int(item["attempts"]) != 0
                for item in competencies.values()
            ):
                raise EvaluationError("Unstarted Evaluation cycle snapshot is invalid")
        elif (
            not isinstance(reference_score, int)
            or isinstance(reference_score, bool)
            or reference_score != calculated
        ):
            raise EvaluationError("Evaluation referenceScore differs from competency scores")
        if status == "通过" and below:
            raise EvaluationError("Passed Evaluation requires every competency at least 3")
        if status == "重新学习" and not any(
            int(item["attempts"]) == 3 for item in below
        ):
            raise EvaluationError("Relearning requires an exhausted failed competency")
        if status == "定向回炉" and (
            not below or any(int(item["attempts"]) == 3 for item in below)
        ):
            raise EvaluationError("Targeted review attempt snapshot is invalid")
        expected_current = below[0]["competencyId"] if below else None
        if parsed["currentCompetencyId"] != expected_current:
            raise EvaluationError("Evaluation currentCompetencyId is invalid")
        cycle_competencies[index + 1] = competencies
        if index > 0:
            previous = value["cycles"][index - 1]
            if (
                previous["evaluationRevision"] == parsed["evaluationRevision"]
                and previous["status"] != "重新学习"
            ):
                raise EvaluationError(
                    "A same-revision Evaluation cycle requires prior relearning"
                )
        if status == "通过":
            passed_revisions.add(parsed["evaluationRevision"])

    observed_attempts: Dict[Tuple[int, str], int] = {}
    observed_scores: Dict[Tuple[int, str], int] = {}
    active_cycle: Optional[int] = None
    for index, event in enumerate(value["events"]):
        if not isinstance(event, dict) or event.get("sequence") != index + 1:
            raise EvaluationError("Evaluation event sequence is invalid")
        event_type = event.get("type")
        if event_type == "cycle-started":
            parsed_event = _exact(
                event, ("sequence", "type", "cycle"), f"Evaluation event[{index}]"
            )
            cycle_number = parsed_event["cycle"]
            if (
                not isinstance(cycle_number, int)
                or isinstance(cycle_number, bool)
                or cycle_number != (active_cycle or 0) + 1
                or cycle_number not in cycle_competencies
            ):
                raise EvaluationError("Evaluation cycle-started event is invalid")
            active_cycle = cycle_number
            continue
        if event_type == "security-stop":
            parsed_event = _exact(
                event,
                ("sequence", "type", "cycle", "reason"),
                f"Evaluation event[{index}]",
            )
            if parsed_event["cycle"] != active_cycle:
                raise EvaluationError("Evaluation security-stop cycle is invalid")
            if parsed_event["reason"] != "sensitive-content":
                raise EvaluationError("Evaluation security-stop reason is invalid")
            continue
        if event_type == "outcome":
            parsed_event = _exact(
                event,
                (
                    "sequence",
                    "type",
                    "cycle",
                    "competencyId",
                    "score",
                    "attempt",
                    "problemType",
                    "evidenceLocation",
                    "reviewSection",
                ),
                f"Evaluation event[{index}]",
            )
            cycle_number = parsed_event["cycle"]
            if cycle_number != active_cycle or cycle_number not in cycle_competencies:
                raise EvaluationError("Evaluation outcome cycle is invalid")
            competency_id = _require_id(
                parsed_event["competencyId"], "Evaluation outcome competencyId"
            )
            if competency_id not in cycle_competencies[cycle_number]:
                raise EvaluationError("Evaluation outcome competency is not in its cycle")
            score = parsed_event["score"]
            attempt = parsed_event["attempt"]
            if (
                not isinstance(score, int)
                or isinstance(score, bool)
                or score < 0
                or score > 4
            ):
                raise EvaluationError("Evaluation outcome score must be 0 through 4")
            key = (cycle_number, competency_id)
            expected_attempt = observed_attempts.get(key, 0) + 1
            if (
                not isinstance(attempt, int)
                or isinstance(attempt, bool)
                or attempt != expected_attempt
                or attempt > 3
            ):
                raise EvaluationError("Evaluation outcome attempts must be continuous")
            if parsed_event["problemType"] not in PROBLEM_TYPES:
                raise EvaluationError("Evaluation outcome problemType is invalid")
            for field in ("evidenceLocation", "reviewSection"):
                locator = parsed_event[field]
                if (
                    not isinstance(locator, str)
                    or not locator.strip()
                    or len(locator) > 120
                    or re.search(r"[\r\n\x00]", locator)
                    or any(pattern.search(locator) for pattern in SENSITIVE_PATTERNS)
                ):
                    raise EvaluationError(f"Evaluation outcome {field} is invalid")
            observed_attempts[key] = attempt
            observed_scores[key] = score
            continue
        raise EvaluationError("Evaluation event type is invalid")
    if active_cycle != (len(value["cycles"]) or None):
        raise EvaluationError("Evaluation cycle-started history is incomplete")
    for cycle_number, competencies in cycle_competencies.items():
        for competency_id, competency in competencies.items():
            key = (cycle_number, competency_id)
            attempts = observed_attempts.get(key, 0)
            score = observed_scores.get(key, 0)
            if attempts != competency["attempts"] or score != competency["score"]:
                raise EvaluationError(
                    "Evaluation competency snapshot differs from outcome history"
                )
    return value


def load_evaluation(
    path: Path, resolved: Optional[ResolvedLesson] = None
) -> dict:
    source = _read_regular(path, "Evaluation Record")
    matches = list(EVALUATION_BLOCK.finditer(source))
    if not matches:
        raise EvaluationError("Evaluation Record lacks the evaluation-record block")
    if len(matches) != 1:
        raise EvaluationError("Evaluation Record must contain exactly one structured block")
    try:
        record = json.loads(matches[0].group("record"))
    except json.JSONDecodeError as error:
        raise EvaluationError("Evaluation Record block is invalid JSON") from error
    return _validate_record(record)


def _render_evaluation(record: dict) -> str:
    latest = record["cycles"][-1] if record["cycles"] else None
    status = latest["status"] if latest else "未开始"
    score = latest["referenceScore"] if latest else None
    rows = []
    if latest:
        for item in latest["competencies"]:
            rows.append(
                f"| {item['competencyId']} | {item['score']} | {item['attempts']} |"
            )
    history = []
    for event in record["events"]:
        if event["type"] == "security-stop":
            history.append(
                f"- #{event['sequence']} security-stop（{event['reason']}，状态与分数保持）"
            )
        elif event["type"] == "cycle-started":
            history.append(f"- #{event['sequence']} 开始第 {event['cycle']} 个评测周期")
        else:
            history.append(
                f"- #{event['sequence']} {event['competencyId']}：等级 {event['score']}，尝试 {event['attempt']}，{event['problemType']}"
            )
    return (
        "# Evaluation Record\n\n"
        "```evaluation-record\n"
        + json.dumps(record, ensure_ascii=False, indent=2)
        + "\n```\n\n"
        "## 当前状态\n\n"
        f"- 状态：{status}\n"
        f"- 参考分数：{'待评测' if score is None else score}\n\n"
        "## 能力项\n\n"
        "| ID | 等级 | 尝试次数 |\n|---|---:|---:|\n"
        + ("\n".join(rows) if rows else "")
        + "\n\n## 评测历史\n\n"
        + ("\n".join(history) if history else "尚未开始评测。")
        + "\n"
    )


def _save_record(resolved: ResolvedLesson, record: dict) -> None:
    _validate_record(record)
    if record["courseId"] != resolved.course_id or record["lessonId"] != resolved.lesson_id:
        raise EvaluationError("Evaluation Record stable identity differs from the resolved Lesson")
    _ensure_safe_directory(resolved.workspace, resolved.evaluation.parent)
    _atomic_text(
        resolved.workspace,
        resolved.evaluation,
        _render_evaluation(record),
        replace=resolved.evaluation.exists(),
    )


def _load_for_resolved(resolved: ResolvedLesson) -> dict:
    source = _read_regular(resolved.evaluation, "Evaluation Record")
    if not EVALUATION_BLOCK.search(source):
        raise EvaluationError("legacy Evaluation 必须由显式迁移事务转换后才能写入")
    record = load_evaluation(resolved.evaluation, resolved)
    if record["courseId"] != resolved.course_id or record["lessonId"] != resolved.lesson_id:
        raise EvaluationError("Evaluation Record stable identity mismatch")
    _assert_resolved_competencies(record, resolved)
    return record


def _assert_resolved_competencies(record: dict, resolved: ResolvedLesson) -> None:
    expected = tuple(competency_id for competency_id, _ in resolved.competencies)
    for cycle in record["cycles"]:
        if cycle["evaluationRevision"] != resolved.evaluation_revision:
            continue
        actual = tuple(
            competency["competencyId"] for competency in cycle["competencies"]
        )
        if actual != expected:
            raise EvaluationError(
                "Evaluation competencies differ from the current Lesson contract"
            )


def current_progress(record: dict, resolved: ResolvedLesson) -> Tuple[str, Optional[int]]:
    value = _validate_record(record)
    if value["courseId"] != resolved.course_id or value["lessonId"] != resolved.lesson_id:
        raise EvaluationError("Evaluation Record stable identity mismatch")
    _assert_resolved_competencies(value, resolved)
    if not value["cycles"]:
        return ("未开始", None)
    latest = value["cycles"][-1]
    if latest["evaluationRevision"] != resolved.evaluation_revision:
        return ("未开始", None)
    return (latest["status"], latest["referenceScore"])


def _assert_can_start(resolved: ResolvedLesson) -> None:
    if resolved.course_lifecycle == "retired" or resolved.lifecycle == "retired":
        raise EvaluationError("Retired Course or Lesson cannot start a new Evaluation")


def start_cycle(resolved: ResolvedLesson) -> dict:
    _assert_can_start(resolved)
    record = (
        _load_for_resolved(resolved)
        if resolved.evaluation.exists() or resolved.evaluation.is_symlink()
        else _new_record(resolved)
    )
    if any(
        cycle["evaluationRevision"] == resolved.evaluation_revision
        and cycle["status"] == "通过"
        for cycle in record["cycles"]
    ):
        raise EvaluationError("同一 evaluationRevision 的通过是终态")
    if record["cycles"]:
        latest = record["cycles"][-1]
        if latest["evaluationRevision"] == resolved.evaluation_revision:
            if latest["status"] == "通过":
                raise EvaluationError("同一 evaluationRevision 的通过是终态")
            if latest["status"] != "重新学习":
                raise EvaluationError("当前评测周期仍在进行")
    cycle_number = len(record["cycles"]) + 1
    record["cycles"].append(
        {
            "cycle": cycle_number,
            "evaluationRevision": resolved.evaluation_revision,
            "status": "未开始",
            "referenceScore": None,
            "currentCompetencyId": resolved.competencies[0][0],
            "competencies": [
                {"competencyId": competency_id, "score": 0, "attempts": 0}
                for competency_id, _ in resolved.competencies
            ],
        }
    )
    record["events"].append(
        {"sequence": len(record["events"]) + 1, "type": "cycle-started", "cycle": cycle_number}
    )
    _save_record(resolved, record)
    return record


def _safe_locator(value: str, context: str) -> str:
    if (
        not isinstance(value, str)
        or not value.strip()
        or len(value) > 120
        or re.search(r"[\r\n\x00]", value)
        or any(pattern.search(value) for pattern in SENSITIVE_PATTERNS)
    ):
        raise EvaluationError(f"{context} must be a short non-sensitive locator")
    return value.strip()


def _reference_score(competencies: Sequence[dict]) -> int:
    raw = sum(int(item["score"]) for item in competencies) * 100 / (len(competencies) * 4)
    return math.floor(raw + 0.5)


def record_outcome(
    resolved: ResolvedLesson,
    competency_id: str,
    score: int,
    *,
    problem_type: str,
    evidence_location: str,
    review_section: str,
) -> dict:
    if not isinstance(score, int) or isinstance(score, bool) or score < 0 or score > 4:
        raise EvaluationError("score must be an integer from 0 through 4")
    if problem_type not in PROBLEM_TYPES:
        raise EvaluationError("problemType is not allowed")
    evidence = _safe_locator(evidence_location, "evidenceLocation")
    section = _safe_locator(review_section, "reviewSection")
    record = _load_for_resolved(resolved)
    if not record["cycles"]:
        raise EvaluationError("start an Evaluation cycle before recording an outcome")
    cycle = record["cycles"][-1]
    if cycle["evaluationRevision"] != resolved.evaluation_revision:
        raise EvaluationError("start a new Evaluation cycle for the current revision")
    if cycle["status"] == "通过":
        raise EvaluationError("同一 evaluationRevision 的通过是终态")
    if cycle["status"] == "重新学习":
        raise EvaluationError("必须显式开始新评测周期")
    matches = [
        item for item in cycle["competencies"] if item["competencyId"] == competency_id
    ]
    if len(matches) != 1:
        raise EvaluationError("unknown competency for the resolved Lesson")
    competency = matches[0]
    if competency["score"] >= 3:
        raise EvaluationError("competency already passed in the current cycle")
    competency["attempts"] += 1
    competency["score"] = score
    all_passed = all(item["score"] >= 3 for item in cycle["competencies"])
    exhausted = any(
        item["score"] < 3 and item["attempts"] >= 3
        for item in cycle["competencies"]
    )
    cycle["status"] = "通过" if all_passed else "重新学习" if exhausted else "定向回炉"
    cycle["referenceScore"] = _reference_score(cycle["competencies"])
    cycle["currentCompetencyId"] = next(
        (
            item["competencyId"]
            for item in cycle["competencies"]
            if item["score"] < 3
        ),
        None,
    )
    record["events"].append(
        {
            "sequence": len(record["events"]) + 1,
            "type": "outcome",
            "cycle": cycle["cycle"],
            "competencyId": competency_id,
            "score": score,
            "attempt": competency["attempts"],
            "problemType": problem_type,
            "evidenceLocation": evidence,
            "reviewSection": section,
        }
    )
    _save_record(resolved, record)
    return record


def record_security_stop(resolved: ResolvedLesson, reason: str) -> dict:
    if reason != "sensitive-content":
        raise EvaluationError("security stop reason is not allowed")
    record = (
        _load_for_resolved(resolved)
        if resolved.evaluation.exists() or resolved.evaluation.is_symlink()
        else _new_record(resolved)
    )
    record["events"].append(
        {
            "sequence": len(record["events"]) + 1,
            "type": "security-stop",
            "cycle": record["cycles"][-1]["cycle"] if record["cycles"] else None,
            "reason": "sensitive-content",
        }
    )
    _save_record(resolved, record)
    return record


def scan_sensitive_inputs(resolved: ResolvedLesson) -> Optional[str]:
    source = _read_regular(resolved.notes, "Notes")
    candidates = [source]
    for match in re.finditer(
        r"^[ \t]*-[ \t]*(?:产物路径|Evidence path)[：:][ \t]*`?([^`\s]+)`?[ \t]*$",
        source,
        re.IGNORECASE | re.MULTILINE,
    ):
        relative = _safe_relative(match.group(1), "evidence path")
        evidence = resolved.exercise / relative
        try:
            evidence_metadata = evidence.lstat()
        except FileNotFoundError as error:
            raise EvaluationError(f"evidence file is missing: {relative}") from error
        if stat.S_ISLNK(evidence_metadata.st_mode):
            raise EvaluationError("evidence file must not be a symlink")
        exercise_root = resolved.exercise.resolve()
        if not _is_within(exercise_root, evidence.resolve()):
            raise EvaluationError("evidence path escapes the current Exercise Workspace")
        content = _read_regular(evidence, "evidence file")
        if len(content.encode("utf-8")) > 1_000_000:
            raise EvaluationError("evidence file exceeds the 1 MiB safety limit")
        candidates.append(content)
    if any(
        pattern.search(candidate)
        for candidate in candidates
        for pattern in SENSITIVE_PATTERNS
    ):
        return "sensitive-content"
    return None


def _match_variable(kind: str, value: str) -> bool:
    if kind == "workspace-path":
        return bool(re.fullmatch(r"(?:\.|\./(?:\.\.\.|[a-zA-Z0-9_./-]+))", value)) and ".." not in value.replace("...", "")
    if kind == "selector":
        return bool(re.fullmatch(r"[A-Za-z0-9_.$^*+?-]+", value))
    return False


def _match_template(template: Sequence[str], variables: dict, argv: Sequence[str]) -> bool:
    if len(template) != len(argv):
        return False
    for expected, actual in zip(template, argv):
        placeholders = re.findall(r"\{([a-z][a-zA-Z0-9]*)\}", expected)
        pattern = re.escape(expected)
        for placeholder in placeholders:
            kind = variables.get(placeholder)
            if not isinstance(kind, str):
                return False
            marker = re.escape("{" + placeholder + "}")
            pattern = pattern.replace(marker, f"(?P<{placeholder}>.+)")
        match = re.fullmatch(pattern, actual)
        if match is None:
            return False
        for placeholder, value in match.groupdict().items():
            if not _match_variable(str(variables[placeholder]), value):
                return False
    return True


def _safe_executable_path() -> str:
    trusted_roots = tuple(
        Path(value).resolve()
        for value in ("/usr", "/opt", "/bin", "/sbin", "/Library/Developer")
        if Path(value).exists()
    )
    candidates = os.environ.get("PATH", "").split(os.pathsep) + [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ]
    safe: List[str] = []
    for candidate in candidates:
        path = Path(candidate)
        if not path.is_absolute():
            continue
        try:
            resolved = path.resolve(strict=True)
            metadata = resolved.stat()
        except OSError:
            continue
        if (
            not stat.S_ISDIR(metadata.st_mode)
            or metadata.st_mode & stat.S_IWOTH
            or not any(_is_within(root, resolved) for root in trusted_roots)
        ):
            continue
        value = str(resolved)
        if value not in safe:
            safe.append(value)
    if not safe:
        raise EvaluationError("no trusted executable search path is available")
    return os.pathsep.join(safe)


def plan_command(
    resolved: ResolvedLesson, argv: Union[str, Sequence[str]]
) -> CommandPlan:
    if isinstance(argv, str) or not isinstance(argv, Sequence) or not argv:
        raise EvaluationError("Command request must be a non-empty argv array")
    requested = tuple(argv)
    if not all(isinstance(item, str) and item for item in requested):
        raise EvaluationError("Command argv entries must be non-empty strings")
    if any(FORBIDDEN_ARGUMENT.search(item) for item in requested):
        raise EvaluationError("Command argv contains shell or control syntax")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]*", requested[0]):
        raise EvaluationError("Command executable must be a trusted PATH basename")
    command_line = " ".join(requested)
    lesson_lines = {
        line.strip()
        for line in _read_regular(resolved.content, "Lesson content").splitlines()
    }
    if command_line not in lesson_lines:
        raise EvaluationError("Command is not explicitly required by the current Lesson")
    try:
        metadata = resolved.exercise.lstat()
    except FileNotFoundError as error:
        raise EvaluationError("Exercise Workspace is missing") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise EvaluationError("Exercise Workspace must be a non-symlink directory")
    profile = _exact(
        _read_json(resolved.command_profile, "Command Profile"),
        ("schemaVersion", "profileId", "environment", "commands"),
        "Command Profile",
    )
    if profile["schemaVersion"] != 1 or not isinstance(profile["commands"], list):
        raise EvaluationError("Command Profile schema is invalid")
    profile_environment = profile["environment"]
    if not isinstance(profile_environment, dict) or len(profile_environment) > 16:
        raise EvaluationError("Command Profile environment must be a small object")
    environment: Dict[str, str] = {}
    reserved_environment = {"PATH", "HOME", "TMPDIR"}
    dangerous_environment = {
        "BASH_ENV",
        "ENV",
        "NODE_OPTIONS",
        "PERL5OPT",
        "PYTHONSTARTUP",
        "RUBYOPT",
        "SHELLOPTS",
    }
    for key, value in profile_environment.items():
        if (
            not isinstance(key, str)
            or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key)
            or key in reserved_environment
            or key in dangerous_environment
            or key.startswith(("LD_", "DYLD_"))
            or key.endswith("PATH")
            or not isinstance(value, str)
            or len(value) > 64
            or not re.fullmatch(r"[A-Za-z0-9_.:+-]*", value)
            or any(pattern.search(value) for pattern in SENSITIVE_PATTERNS)
        ):
            raise EvaluationError("Command Profile environment entry is unsafe")
        environment[key] = value
    matches = []
    for candidate in profile["commands"]:
        command = _exact(
            candidate,
            ("commandId", "argvTemplate", "variables", "timeoutSeconds"),
            "Command Profile command",
        )
        template = command["argvTemplate"]
        if (
            not isinstance(template, list)
            or not all(isinstance(item, str) and item for item in template)
            or not isinstance(command["variables"], dict)
        ):
            raise EvaluationError("Command Profile must use argv templates")
        if _match_template(template, command["variables"], requested):
            matches.append(command)
    if len(matches) != 1:
        raise EvaluationError("Command is not allowed by the Course Command Profile")
    command = matches[0]
    timeout = command["timeoutSeconds"]
    if not isinstance(timeout, int) or isinstance(timeout, bool) or not 1 <= timeout <= 300:
        raise EvaluationError("Command timeout must be from 1 through 300 seconds")
    runtime = resolved.record_root / ".evaluation-runtime"
    return CommandPlan(
        command_id=_require_id(command["commandId"], "commandId"),
        argv=requested,
        workspace=resolved.workspace,
        cwd=resolved.exercise,
        environment={
            "PATH": _safe_executable_path(),
            "HOME": str(runtime / "home"),
            "TMPDIR": str(runtime / "tmp"),
            **environment,
        },
        timeout_seconds=timeout,
        network_denied=True,
        shadow_workspace=True,
    )


def command_isolation_available() -> bool:
    if sys.platform == "darwin":
        return Path("/usr/bin/sandbox-exec").is_file()
    if sys.platform.startswith("linux"):
        return shutil.which("bwrap") is not None
    return False


def _copy_shadow_workspace(source: Path, destination: Path) -> None:
    excluded = {
        ".evaluation-runtime",
        ".git",
        "evaluation.md",
        "notes-eval.md",
        "notes.md",
    }
    total_size = 0
    for root, directory_names, file_names in os.walk(source, followlinks=False):
        root_path = Path(root)
        relative_root = root_path.relative_to(source)
        target_root = destination / relative_root
        target_root.mkdir(parents=True, exist_ok=True)
        retained_directories = []
        for name in directory_names:
            candidate = root_path / name
            metadata = candidate.lstat()
            if stat.S_ISLNK(metadata.st_mode):
                raise EvaluationError("Exercise Workspace must not contain symlinks")
            if not stat.S_ISDIR(metadata.st_mode):
                raise EvaluationError("Exercise Workspace contains a non-directory entry")
            if name not in excluded:
                retained_directories.append(name)
        directory_names[:] = retained_directories
        for name in file_names:
            if name in excluded:
                continue
            candidate = root_path / name
            metadata = candidate.lstat()
            if stat.S_ISLNK(metadata.st_mode):
                raise EvaluationError("Exercise Workspace must not contain symlinks")
            if not stat.S_ISREG(metadata.st_mode):
                raise EvaluationError("Exercise Workspace contains a non-regular file")
            total_size += metadata.st_size
            if total_size > 50 * 1024 * 1024:
                raise EvaluationError("Exercise Workspace exceeds the 50 MiB execution limit")
            target = target_root / name
            shutil.copyfile(candidate, target)
            target.chmod(stat.S_IMODE(metadata.st_mode) & 0o755)


def _darwin_sandbox_command(
    executable: str,
    argv: Tuple[str, ...],
    workspace: Path,
    source: Path,
    shadow: Path,
    runtime: Path,
) -> List[str]:
    del shadow
    home = Path.home().resolve()
    executable_path = Path(executable).resolve()
    runtime_path = runtime.resolve()
    workspace_path = workspace.resolve()
    source_path = source.resolve()
    if _is_within(home, executable_path) or _is_within(
        workspace_path, executable_path
    ):
        raise EvaluationError(
            "required command tool must be outside the user home for read isolation"
        )
    if _is_within(home, runtime_path):
        raise EvaluationError("isolated runtime must be outside the user home")
    if _is_within(workspace_path, runtime_path):
        raise EvaluationError("isolated runtime must be outside the source workspace")
    profile = runtime / "sandbox.sb"
    profile.write_text(
        "\n".join(
            (
                "(version 1)",
                "(allow default)",
                "(deny network*)",
                "(deny file-write* (require-all "
                f"(require-not (subpath {json.dumps(str(runtime_path))})) "
                '(require-not (literal "/dev/null"))))',
                f"(deny file-read* (subpath {json.dumps(str(home))}))",
                f"(deny file-read* (subpath {json.dumps(str(workspace_path))}))",
                f"(deny file-read* (subpath {json.dumps(str(source_path))}))",
            )
        )
        + "\n",
        encoding="utf-8",
    )
    return ["/usr/bin/sandbox-exec", "-f", str(profile), executable, *argv[1:]]


def _linux_sandbox_command(
    executable: str,
    argv: Tuple[str, ...],
    workspace: Path,
    source: Path,
    shadow: Path,
    runtime: Path,
) -> List[str]:
    bubblewrap = shutil.which("bwrap")
    if bubblewrap is None:
        raise EvaluationError("network/write isolation is unavailable")
    home = Path.home().resolve()
    workspace_path = workspace.resolve()
    source_path = source.resolve()
    runtime_path = runtime.resolve()
    executable_path = Path(executable).resolve()
    if _is_within(home, executable_path) or _is_within(
        workspace_path, executable_path
    ):
        raise EvaluationError(
            "required command tool must be outside the user home for read isolation"
        )
    hidden_roots: List[Path] = []
    for candidate in (home, workspace_path, source_path):
        if not any(_is_within(hidden, candidate) for hidden in hidden_roots):
            hidden_roots.append(candidate)
    if any(_is_within(hidden, runtime_path) for hidden in hidden_roots):
        raise EvaluationError("isolated runtime overlaps a hidden source path")
    command = [
        bubblewrap,
        "--die-with-parent",
        "--unshare-net",
        "--ro-bind",
        "/",
        "/",
    ]
    for hidden_root in hidden_roots:
        command.extend(("--tmpfs", str(hidden_root)))
    command.extend(
        [
            "--bind",
            str(shadow),
            str(shadow),
            "--bind",
            str(runtime),
            str(runtime),
            "--chdir",
            str(shadow),
            executable,
            *argv[1:],
        ]
    )
    return command


def _kill_process_group(process: subprocess.Popen) -> None:
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def execute_command(plan: CommandPlan) -> CommandResult:
    if not plan.network_denied or not plan.shadow_workspace:
        raise EvaluationError("Command plan lacks mandatory isolation")
    if not command_isolation_available():
        raise EvaluationError("network/write isolation is unavailable")
    try:
        metadata = plan.cwd.lstat()
    except FileNotFoundError as error:
        raise EvaluationError("Exercise Workspace is missing") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise EvaluationError("Exercise Workspace must be a non-symlink directory")
    executable = shutil.which(plan.argv[0], path=plan.environment.get("PATH"))
    if executable is None:
        raise EvaluationError("required command tool is unavailable")
    runtime_parent = (
        Path("/private/tmp")
        if sys.platform == "darwin" and Path("/private/tmp").is_dir()
        else Path("/tmp")
    )
    with tempfile.TemporaryDirectory(
        prefix="evaluation-command-", dir=runtime_parent
    ) as temporary:
        runtime = Path(temporary).resolve()
        shadow = runtime / "workspace"
        shadow.mkdir()
        _copy_shadow_workspace(plan.cwd, shadow)
        environment = dict(plan.environment)
        environment.update(
            {
                "HOME": str(runtime / "home"),
                "TMPDIR": str(runtime / "tmp"),
            }
        )
        for directory in (environment["HOME"], environment["TMPDIR"]):
            Path(directory).mkdir(parents=True, exist_ok=True)
        if sys.platform == "darwin":
            command = _darwin_sandbox_command(
                executable,
                plan.argv,
                plan.workspace,
                plan.cwd,
                shadow,
                runtime,
            )
        elif sys.platform.startswith("linux"):
            command = _linux_sandbox_command(
                executable,
                plan.argv,
                plan.workspace,
                plan.cwd,
                shadow,
                runtime,
            )
        else:
            raise EvaluationError("network/write isolation is unavailable")
        try:
            process = subprocess.Popen(
                command,
                cwd=shadow,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True,
            )
        except OSError as error:
            raise EvaluationError("isolated command execution failed") from error
        if process.stdout is None or process.stderr is None:
            _kill_process_group(process)
            raise EvaluationError("isolated command output pipes are unavailable")
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ, "stdout")
        selector.register(process.stderr, selectors.EVENT_READ, "stderr")
        buffers = {"stdout": bytearray(), "stderr": bytearray()}
        total_output_bytes = 0
        deadline = time.monotonic() + plan.timeout_seconds
        try:
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    _kill_process_group(process)
                    raise EvaluationError(
                        "command timed out without changing Evaluation"
                    )
                for key, _ in selector.select(timeout=min(remaining, 0.1)):
                    chunk = os.read(key.fileobj.fileno(), 65_536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    buffer = buffers[str(key.data)]
                    buffer.extend(chunk)
                    total_output_bytes += len(chunk)
                    if total_output_bytes > 1_000_000:
                        _kill_process_group(process)
                        raise EvaluationError(
                            "command output exceeds the 1 MiB safety limit"
                        )
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                _kill_process_group(process)
                raise EvaluationError("command timed out without changing Evaluation")
            process.wait(timeout=remaining)
        except subprocess.TimeoutExpired as error:
            _kill_process_group(process)
            raise EvaluationError(
                "command timed out without changing Evaluation"
            ) from error
        except OSError as error:
            _kill_process_group(process)
            raise EvaluationError("isolated command execution failed") from error
        finally:
            selector.close()
            process.stdout.close()
            process.stderr.close()
        output = buffers["stdout"].decode("utf-8", errors="replace")
        errors = buffers["stderr"].decode("utf-8", errors="replace")
        if any(
            pattern.search(candidate)
            for candidate in (output, errors)
            for pattern in SENSITIVE_PATTERNS
        ):
            raise EvaluationError("command output contained sensitive content and was suppressed")
        return CommandResult(
            exit_code=process.returncode,
            stdout=output,
            stderr=errors,
        )


def _resolved_json(resolved: ResolvedLesson) -> dict:
    return {
        "courseId": resolved.course_id,
        "lessonId": resolved.lesson_id,
        "day": resolved.day,
        "content": str(resolved.content),
        "policy": str(resolved.evaluation_policy),
        "commandProfile": str(resolved.command_profile),
        "notes": str(resolved.notes),
        "evaluation": str(resolved.evaluation),
        "exercise": str(resolved.exercise),
        "evaluationRevision": resolved.evaluation_revision,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Resolve and operate one explicit Course/Lesson Evaluation identity."
    )
    parser.add_argument(
        "action",
        choices=(
            "resolve",
            "prepare",
            "status",
            "start",
            "outcome",
            "scan",
            "security-stop",
            "plan-command",
            "run-command",
        ),
    )
    parser.add_argument("course_id")
    parser.add_argument("lesson_id")
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--force-notes", action="store_true")
    parser.add_argument("--initialize-exercise", action="store_true")
    parser.add_argument("--force-exercise", action="store_true")
    parser.add_argument("--competency-id")
    parser.add_argument("--score", type=int)
    parser.add_argument("--problem-type")
    parser.add_argument("--evidence-location")
    parser.add_argument("--review-section")
    parser.add_argument("--reason", default="sensitive-content")
    parser.add_argument("--argv-json")
    args = parser.parse_args()
    try:
        resolved = resolve_lesson(args.workspace, args.course_id, args.lesson_id)
        output = _resolved_json(resolved)
        if args.action in ("start", "outcome", "run-command"):
            preflight_reason = scan_sensitive_inputs(resolved)
            if preflight_reason is not None:
                record = record_security_stop(resolved, preflight_reason)
                status, score = current_progress(record, resolved)
                output.update(
                    {
                        "securityStop": True,
                        "reason": preflight_reason,
                        "status": status,
                        "referenceScore": score,
                    }
                )
                print(json.dumps(output, ensure_ascii=False))
                return 0
        if args.action == "prepare":
            result = prepare_lesson(
                resolved,
                force_notes=args.force_notes,
                initialize_exercise=args.initialize_exercise,
                force_exercise=args.force_exercise,
            )
            output.update(
                {
                    "notesStatus": result.notes_status,
                    "exerciseStatus": result.exercise_status,
                }
            )
        if args.action == "status":
            if resolved.evaluation.exists():
                status, score = current_progress(
                    load_evaluation(resolved.evaluation, resolved), resolved
                )
            else:
                status, score = ("未开始", None)
            output.update({"status": status, "referenceScore": score})
        if args.action == "start":
            record = start_cycle(resolved)
            status, score = current_progress(record, resolved)
            output.update({"status": status, "referenceScore": score})
        if args.action == "outcome":
            if (
                args.competency_id is None
                or args.score is None
                or args.problem_type is None
                or args.evidence_location is None
                or args.review_section is None
            ):
                raise EvaluationError("outcome requires competency, score, problem type, evidence locator, and review section")
            record = record_outcome(
                resolved,
                args.competency_id,
                args.score,
                problem_type=args.problem_type,
                evidence_location=args.evidence_location,
                review_section=args.review_section,
            )
            status, score = current_progress(record, resolved)
            output.update({"status": status, "referenceScore": score})
        if args.action == "scan":
            reason = scan_sensitive_inputs(resolved)
            if reason is not None:
                record = record_security_stop(resolved, reason)
                status, score = current_progress(record, resolved)
                output.update(
                    {
                        "securityStop": True,
                        "reason": reason,
                        "status": status,
                        "referenceScore": score,
                    }
                )
            else:
                output.update({"securityStop": False})
        if args.action == "security-stop":
            record = record_security_stop(resolved, args.reason)
            status, score = current_progress(record, resolved)
            output.update(
                {
                    "securityStop": True,
                    "reason": "sensitive-content",
                    "status": status,
                    "referenceScore": score,
                }
            )
        if args.action in ("plan-command", "run-command"):
            if args.argv_json is None:
                raise EvaluationError(f"{args.action} requires --argv-json")
            try:
                requested_argv = json.loads(args.argv_json)
            except json.JSONDecodeError as error:
                raise EvaluationError("--argv-json must be valid JSON") from error
            plan = plan_command(resolved, requested_argv)
            output.update(
                {
                    "commandId": plan.command_id,
                    "argv": list(plan.argv),
                    "cwd": str(plan.cwd),
                    "environment": plan.environment,
                    "timeoutSeconds": plan.timeout_seconds,
                    "networkDenied": plan.network_denied,
                    "shadowWorkspace": plan.shadow_workspace,
                }
            )
            if args.action == "run-command":
                result = execute_command(plan)
                output.update(
                    {
                        "exitCode": result.exit_code,
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                    }
                )
        print(json.dumps(output, ensure_ascii=False))
        return 0
    except EvaluationError as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
