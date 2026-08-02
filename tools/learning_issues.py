#!/usr/bin/env python3
"""Manage private GitHub Issues used as learner-authored Course answers."""

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence


ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
METADATA_PATTERN = re.compile(
    r"<!--\s*go-together-answer:\s*(?P<metadata>\{.*?\})\s*-->", re.DOTALL
)
STATUS_LABELS = (
    "answer:open",
    "review:pending",
    "review:passed",
    "review:revision-needed",
    "review:blocked",
)
STATUS_LABEL_DETAILS = {
    "answer:open": ("5319E7", "学习者正在撰写回答"),
    "review:pending": ("FBCA04", "等待本机审核"),
    "review:passed": ("0E8A16", "审核通过"),
    "review:revision-needed": ("D93F0B", "需要学习者修订"),
    "review:blocked": ("B60205", "审核被安全或运行条件阻断"),
}
ENABLED_COURSE_IDS = frozenset({"algorithm-review"})
SCHEDULE_MARKER = "# go-together-answer-review"


class WorkflowError(ValueError):
    """A safe, user-actionable error in the answer-issue workflow."""


@dataclass(frozen=True)
class AnswerConfig:
    path: Path
    target_repository: str
    reviewer_command: Optional[tuple[str, ...]]


@dataclass(frozen=True)
class LessonIdentity:
    course_id: str
    lesson_id: str


@dataclass(frozen=True)
class RemoteIssue:
    number: int
    url: str
    body: str
    labels: frozenset[str]
    identity: LessonIdentity


def _require_id(value: str, field: str) -> str:
    if not ID_PATTERN.fullmatch(value):
        raise WorkflowError(f"{field} 必须是显式 kebab-case 稳定 ID")
    return value


def _read_regular(path: Path, description: str) -> str:
    try:
        metadata = path.lstat()
    except FileNotFoundError as error:
        raise WorkflowError(f"{description} 不存在") from error
    if not path.is_file() or path.is_symlink():
        raise WorkflowError(f"{description} 必须是普通文件，不能是符号链接")
    if metadata.st_size > 1_000_000:
        raise WorkflowError(f"{description} 过大")
    return path.read_text(encoding="utf-8")


def _read_json(path: Path, description: str) -> dict[str, Any]:
    try:
        value = json.loads(_read_regular(path, description))
    except json.JSONDecodeError as error:
        raise WorkflowError(f"{description} 不是有效 JSON") from error
    if not isinstance(value, dict):
        raise WorkflowError(f"{description} 必须是 JSON 对象")
    return value


def load_config(path: Path) -> AnswerConfig:
    resolved_path = path.expanduser().resolve()
    value = _read_json(resolved_path, "答题 Issue 配置")
    allowed_keys = {"schemaVersion", "targetRepository", "reviewerCommand"}
    unknown_keys = set(value).difference(allowed_keys)
    missing_keys = {"schemaVersion", "targetRepository"}.difference(value)
    if unknown_keys or missing_keys:
        raise WorkflowError("答题 Issue 配置字段不符合协议")
    if value["schemaVersion"] != 1:
        raise WorkflowError("答题 Issue 配置 schemaVersion 必须为 1")
    target_repository = value["targetRepository"]
    if not isinstance(target_repository, str) or not REPOSITORY_PATTERN.fullmatch(
        target_repository
    ):
        raise WorkflowError("targetRepository 必须为 owner/repository")
    reviewer_value = value.get("reviewerCommand")
    reviewer_command: Optional[tuple[str, ...]] = None
    if reviewer_value is not None:
        if (
            not isinstance(reviewer_value, list)
            or not reviewer_value
            or not all(isinstance(item, str) and item and "\n" not in item for item in reviewer_value)
        ):
            raise WorkflowError("reviewerCommand 必须是非空字符串参数数组")
        reviewer_command = tuple(reviewer_value)
    return AnswerConfig(resolved_path, target_repository, reviewer_command)


def resolve_active_lesson(
    workspace: Path, course_id: str, lesson_id: str
) -> LessonIdentity:
    course_id = _require_id(course_id, "courseId")
    lesson_id = _require_id(lesson_id, "lessonId")
    workspace = workspace.expanduser().resolve()
    course_path = workspace / "courses" / course_id / "course.json"
    course = _read_json(course_path, "Course manifest")
    if course.get("courseId") != course_id:
        raise WorkflowError("Course manifest 的 courseId 不匹配")
    if course.get("lifecycle") != "published":
        raise WorkflowError("只有 Published Course 可以创建答题 Issue")
    matches: list[dict[str, Any]] = []
    tracks = course.get("tracks")
    if not isinstance(tracks, list):
        raise WorkflowError("Course manifest 缺少 tracks")
    for track in tracks:
        if not isinstance(track, dict) or not isinstance(track.get("stages"), list):
            raise WorkflowError("Course manifest 的 tracks 不合法")
        for stage in track["stages"]:
            if not isinstance(stage, dict) or not isinstance(stage.get("lessons"), list):
                raise WorkflowError("Course manifest 的 stages 不合法")
            for lesson in stage["lessons"]:
                if isinstance(lesson, dict) and lesson.get("lessonId") == lesson_id:
                    matches.append(lesson)
    if len(matches) != 1:
        raise WorkflowError("lessonId 必须在当前 Course manifest 中唯一存在")
    if matches[0].get("lifecycle") != "active":
        raise WorkflowError("只有 Active Lesson 可以创建答题 Issue")
    return LessonIdentity(course_id, lesson_id)


def _run_command(
    argv: Sequence[str], *, input_text: Optional[str] = None, timeout: int = 60
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            list(argv),
            input=input_text,
            text=True,
            capture_output=True,
            check=False,
            timeout=timeout,
        )
    except FileNotFoundError as error:
        raise WorkflowError(f"所需命令不可用：{argv[0]}") from error
    except subprocess.TimeoutExpired as error:
        raise WorkflowError(f"所需命令超时：{argv[0]}") from error


def _run_gh(arguments: Sequence[str], *, input_text: Optional[str] = None) -> str:
    result = _run_command(["gh", *arguments], input_text=input_text)
    if result.returncode != 0:
        raise WorkflowError("GitHub CLI 调用失败；请检查认证、仓库权限和网络")
    return result.stdout


def _parse_json_output(value: str, description: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError as error:
        raise WorkflowError(f"{description} 返回了无效 JSON") from error


def verify_target_repository(config: AnswerConfig) -> None:
    _run_gh(["auth", "status"])
    response = _parse_json_output(
        _run_gh(
            [
                "repo",
                "view",
                config.target_repository,
                "--json",
                "nameWithOwner,isPrivate,hasIssuesEnabled",
            ]
        ),
        "目标仓库验证",
    )
    if not isinstance(response, dict):
        raise WorkflowError("目标仓库验证结果不合法")
    if response.get("nameWithOwner") != config.target_repository:
        raise WorkflowError("目标仓库与配置不一致")
    if response.get("isPrivate") is not True:
        raise WorkflowError("答题目标仓库必须为私有仓库")
    if response.get("hasIssuesEnabled") is not True:
        raise WorkflowError("答题目标仓库未启用 Issues")


def ensure_labels(config: AnswerConfig) -> None:
    for label, (color, description) in STATUS_LABEL_DETAILS.items():
        _run_gh(
            [
                "label",
                "create",
                label,
                "--repo",
                config.target_repository,
                "--color",
                color,
                "--description",
                description,
                "--force",
            ]
        )


def _metadata_from_body(body: object) -> LessonIdentity:
    if not isinstance(body, str):
        raise WorkflowError("答题 Issue 缺少正文")
    match = METADATA_PATTERN.search(body)
    if match is None:
        raise WorkflowError("答题 Issue 缺少协议元数据")
    try:
        value = json.loads(match.group("metadata"))
    except json.JSONDecodeError as error:
        raise WorkflowError("答题 Issue 协议元数据无效") from error
    if not isinstance(value, dict):
        raise WorkflowError("答题 Issue 协议元数据无效")
    if value.get("schemaVersion") != 1:
        raise WorkflowError("答题 Issue 协议版本不受支持")
    course_id = value.get("courseId")
    lesson_id = value.get("lessonId")
    if not isinstance(course_id, str) or not isinstance(lesson_id, str):
        raise WorkflowError("答题 Issue 协议缺少稳定学习身份")
    return LessonIdentity(_require_id(course_id, "courseId"), _require_id(lesson_id, "lessonId"))


def _labels_from_value(value: object) -> frozenset[str]:
    if not isinstance(value, list):
        raise WorkflowError("答题 Issue 标签无效")
    labels: set[str] = set()
    for item in value:
        if isinstance(item, str):
            labels.add(item)
        elif isinstance(item, dict) and isinstance(item.get("name"), str):
            labels.add(item["name"])
        else:
            raise WorkflowError("答题 Issue 标签无效")
    return frozenset(labels)


def _remote_issue(value: object) -> RemoteIssue:
    if not isinstance(value, dict):
        raise WorkflowError("GitHub Issue 列表项无效")
    number = value.get("number")
    url = value.get("url")
    if not isinstance(number, int) or number <= 0 or not isinstance(url, str):
        raise WorkflowError("GitHub Issue 标识无效")
    return RemoteIssue(
        number=number,
        url=url,
        body=value.get("body", ""),
        labels=_labels_from_value(value.get("labels", [])),
        identity=_metadata_from_body(value.get("body", "")),
    )


def list_open_issues(config: AnswerConfig, label: Optional[str] = None) -> list[RemoteIssue]:
    arguments = [
        "issue",
        "list",
        "--repo",
        config.target_repository,
        "--state",
        "open",
        "--limit",
        "1000",
        "--json",
        "number,url,body,labels",
    ]
    if label is not None:
        arguments.extend(["--label", label])
    response = _parse_json_output(_run_gh(arguments), "GitHub Issue 列表")
    if not isinstance(response, list):
        raise WorkflowError("GitHub Issue 列表无效")
    issues: list[RemoteIssue] = []
    for item in response:
        try:
            issues.append(_remote_issue(item))
        except WorkflowError:
            # The configured private repository can host unrelated Issues. Only
            # Issues carrying this protocol's metadata are workflow candidates.
            continue
    return issues


def _answer_metadata(identity: LessonIdentity) -> str:
    return json.dumps(
        {
            "schemaVersion": 1,
            "courseId": identity.course_id,
            "lessonId": identity.lesson_id,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _answer_body(identity: LessonIdentity) -> str:
    return "\n".join(
        [
            f"<!-- go-together-answer: {_answer_metadata(identity)} -->",
            "",
            f"# 学习作答：{identity.course_id}/{identity.lesson_id}",
            "",
            "## 学习者回答",
            "",
            "仅由学习者填写。自动化不会代写、润色或覆盖本节内容。",
            "",
            "## 证据链接",
            "",
            "只添加当前 Lesson 要求的最小证据；不得提交令牌、Cookie、连接串或私密数据。",
        ]
    )


def create_or_reuse_issue(config: AnswerConfig, identity: LessonIdentity) -> dict[str, Any]:
    if identity.course_id not in ENABLED_COURSE_IDS:
        raise WorkflowError(
            "当前答题 Issue 流程仅为 algorithm-review 启用；其他 Course 必须先显式接入"
        )
    verify_target_repository(config)
    ensure_labels(config)
    matching = [
        issue
        for issue in list_open_issues(config)
        if issue.identity == identity
    ]
    if len(matching) > 1:
        raise WorkflowError("同一稳定学习身份存在多个活跃答题 Issue，必须先人工消除冲突")
    if matching:
        issue = matching[0]
        return {"action": "reused", "issueNumber": issue.number, "issueUrl": issue.url}
    response = _run_gh(
        [
            "issue",
            "create",
            "--repo",
            config.target_repository,
            "--title",
            f"学习作答：{identity.course_id}/{identity.lesson_id}",
            "--label",
            "answer:open",
            "--body",
            _answer_body(identity),
        ]
    ).strip()
    issue_number_match = re.search(r"/issues/(?P<number>[1-9][0-9]*)/?$", response)
    if issue_number_match is None:
        raise WorkflowError("GitHub 未返回新建答题 Issue 的 URL")
    return {
        "action": "created",
        "issueNumber": int(issue_number_match.group("number")),
        "issueUrl": response,
    }


def _load_issue(config: AnswerConfig, number: int) -> RemoteIssue:
    response = _parse_json_output(
        _run_gh(
            [
                "issue",
                "view",
                str(number),
                "--repo",
                config.target_repository,
                "--json",
                "number,url,body,labels",
            ]
        ),
        "GitHub Issue",
    )
    return _remote_issue(response)


def _current_status(issue: RemoteIssue) -> str:
    matches = [label for label in STATUS_LABELS if label in issue.labels]
    if len(matches) != 1:
        raise WorkflowError("答题 Issue 必须恰有一个协议状态标签")
    return matches[0]


def _set_status(config: AnswerConfig, issue: RemoteIssue, target_status: str) -> bool:
    if target_status not in STATUS_LABELS:
        raise WorkflowError("未知答题 Issue 状态")
    current_status = _current_status(issue)
    if current_status == target_status:
        return False
    arguments = ["issue", "edit", str(issue.number), "--repo", config.target_repository]
    for label in STATUS_LABELS:
        if label != target_status and label in issue.labels:
            arguments.extend(["--remove-label", label])
    arguments.extend(["--add-label", target_status])
    _run_gh(arguments)
    return True


def submit_issue(
    config: AnswerConfig, number: int, workspace: Path
) -> dict[str, Any]:
    verify_target_repository(config)
    issue = _load_issue(config, number)
    if issue.identity.course_id not in ENABLED_COURSE_IDS:
        raise WorkflowError(
            "当前答题 Issue 流程仅为 algorithm-review 启用；其他 Course 必须先显式接入"
        )
    resolve_active_lesson(workspace, issue.identity.course_id, issue.identity.lesson_id)
    current_status = _current_status(issue)
    if current_status not in {
        "answer:open",
        "review:revision-needed",
        "review:blocked",
    }:
        raise WorkflowError("当前答题 Issue 状态不能提交审核")
    _set_status(config, issue, "review:pending")
    return {"action": "submitted", "issueNumber": issue.number, "issueUrl": issue.url}


def _generic_review_comment(status: str) -> str:
    comments = {
        "review:passed": "自动审核完成：请在本机 Evaluation Record 中继续完成正式评测。",
        "review:revision-needed": "自动审核发现当前回答或证据仍需修订；请按课程流程继续。",
        "review:blocked": "自动审核无法安全完成；请检查协议与本机审核环境后重试。",
    }
    return comments[status]


def _review_status(config: AnswerConfig, issue: RemoteIssue, workspace: Path) -> str:
    if config.reviewer_command is None:
        raise WorkflowError("未配置 reviewerCommand，不能进行语义审核")
    request = json.dumps(
        {
            "schemaVersion": 1,
            "repository": config.target_repository,
            "issueNumber": issue.number,
            "courseId": issue.identity.course_id,
            "lessonId": issue.identity.lesson_id,
            "workspace": str(workspace),
        },
        ensure_ascii=False,
    )
    result = _run_command(config.reviewer_command, input_text=request, timeout=900)
    if result.returncode != 0:
        raise WorkflowError("审核器执行失败")
    response = _parse_json_output(result.stdout, "审核器")
    if not isinstance(response, dict) or set(response) != {"status"}:
        raise WorkflowError("审核器必须只返回 status")
    statuses = {
        "passed": "review:passed",
        "revision-needed": "review:revision-needed",
        "blocked": "review:blocked",
    }
    status = response.get("status")
    if status not in statuses:
        raise WorkflowError("审核器返回了未知状态")
    return statuses[status]


def _review_lock(config: AnswerConfig) -> Path:
    return config.path.parent / ".go-together-answer-review.lock"


def review_all(config: AnswerConfig, workspace: Path) -> dict[str, list[int]]:
    verify_target_repository(config)
    lock = _review_lock(config)
    try:
        lock.mkdir()
    except FileExistsError as error:
        raise WorkflowError("已有答题 Issue 审核任务正在运行") from error
    result = {
        "passed": [],
        "revisionNeeded": [],
        "blocked": [],
        "pending": [],
        "skipped": [],
    }
    try:
        for issue in list_open_issues(config, label="review:pending"):
            try:
                if _current_status(issue) != "review:pending":
                    result["skipped"].append(issue.number)
                    continue
                resolve_active_lesson(
                    workspace, issue.identity.course_id, issue.identity.lesson_id
                )
                if issue.identity.course_id not in ENABLED_COURSE_IDS:
                    raise WorkflowError("该 Course 尚未接入答题 Issue 审核流程")
                target_status = _review_status(config, issue, workspace)
                changed = _set_status(config, issue, target_status)
                if changed:
                    _run_gh(
                        [
                            "issue",
                            "comment",
                            str(issue.number),
                            "--repo",
                            config.target_repository,
                            "--body",
                            _generic_review_comment(target_status),
                        ]
                    )
                if target_status == "review:passed":
                    result["passed"].append(issue.number)
                elif target_status == "review:revision-needed":
                    result["revisionNeeded"].append(issue.number)
                else:
                    result["blocked"].append(issue.number)
            except WorkflowError:
                result["pending"].append(issue.number)
        return result
    finally:
        lock.rmdir()


def _default_config_path() -> Path:
    return Path.home() / ".config" / "go-together" / "answer-issues.json"


def _cron_entry(config: AnswerConfig, workspace: Path) -> str:
    workspace = workspace.expanduser().resolve()
    log_path = config.path.parent / "logs" / "answer-issue-review.log"
    if any("%" in str(path) for path in (workspace, config.path, log_path)):
        raise WorkflowError("计划任务路径不能包含百分号")
    tool = Path(__file__).resolve()
    gh_path = shutil.which("gh")
    if gh_path is None:
        raise WorkflowError("GitHub CLI 不可用，不能生成计划任务")
    command = [
        sys.executable,
        str(tool),
        "review-all",
        "--workspace",
        str(workspace),
        "--config",
        str(config.path),
    ]
    command_text = " ".join(shlex.quote(item) for item in command)
    path_value = ":".join(
        [str(Path(gh_path).resolve().parent), "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
    )
    return (
        f"0 22 * * * PATH={shlex.quote(path_value)} {command_text} "
        f">> {shlex.quote(str(log_path))} 2>&1 {SCHEDULE_MARKER}"
    )


def schedule_preview(config: AnswerConfig, workspace: Path) -> dict[str, str]:
    return {"entry": _cron_entry(config, workspace)}


def _read_crontab() -> str:
    result = _run_command(["crontab", "-l"])
    if result.returncode == 0:
        return result.stdout
    if result.returncode == 1:
        return ""
    raise WorkflowError("无法读取当前 crontab")


def _write_crontab(content: str) -> None:
    result = _run_command(["crontab", "-"], input_text=content)
    if result.returncode != 0:
        raise WorkflowError("无法更新 crontab")


def _without_schedule_entry(content: str) -> list[str]:
    return [line for line in content.splitlines() if not line.rstrip().endswith(SCHEDULE_MARKER)]


def schedule_install(config: AnswerConfig, workspace: Path) -> dict[str, str]:
    log_directory = config.path.parent / "logs"
    log_directory.mkdir(parents=True, exist_ok=True)
    lines = _without_schedule_entry(_read_crontab())
    lines.append(_cron_entry(config, workspace))
    _write_crontab("\n".join(lines) + "\n")
    return {"action": "installed", "entry": lines[-1]}


def schedule_uninstall() -> dict[str, str]:
    content = _read_crontab()
    lines = _without_schedule_entry(content)
    if len(lines) == len(content.splitlines()):
        return {"action": "absent"}
    replacement = "\n".join(lines)
    if replacement:
        replacement += "\n"
    _write_crontab(replacement)
    return {"action": "removed"}


def _print(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Use a configured private GitHub repository for learner-authored Course answers."
    )
    subparsers = parser.add_subparsers(dest="action", required=True)

    def add_common_arguments(command_parser: argparse.ArgumentParser) -> None:
        command_parser.add_argument(
            "--config", type=Path, default=_default_config_path()
        )
        command_parser.add_argument("--workspace", type=Path, default=Path("."))

    config_template_parser = subparsers.add_parser("config-template")
    add_common_arguments(config_template_parser)
    init_parser = subparsers.add_parser("init")
    add_common_arguments(init_parser)
    open_parser = subparsers.add_parser("open")
    add_common_arguments(open_parser)
    open_parser.add_argument("--course-id", required=True)
    open_parser.add_argument("--lesson-id", required=True)
    submit_parser = subparsers.add_parser("submit")
    add_common_arguments(submit_parser)
    submit_parser.add_argument("--issue", type=int, required=True)
    review_parser = subparsers.add_parser("review-all")
    add_common_arguments(review_parser)
    schedule_preview_parser = subparsers.add_parser("schedule-preview")
    add_common_arguments(schedule_preview_parser)
    schedule_install_parser = subparsers.add_parser("schedule-install")
    add_common_arguments(schedule_install_parser)
    schedule_uninstall_parser = subparsers.add_parser("schedule-uninstall")
    add_common_arguments(schedule_uninstall_parser)
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.action == "config-template":
            _print(
                {
                    "schemaVersion": 1,
                    "targetRepository": "owner/private-learning-answers",
                    "reviewerCommand": ["/absolute/path/to/reviewer"],
                }
            )
            return 0
        if args.action == "schedule-uninstall":
            _print(schedule_uninstall())
            return 0
        config = load_config(args.config)
        if args.action == "init":
            verify_target_repository(config)
            ensure_labels(config)
            _print({"action": "initialized", "targetRepository": config.target_repository})
            return 0
        if args.action == "open":
            identity = resolve_active_lesson(
                args.workspace, args.course_id, args.lesson_id
            )
            _print(create_or_reuse_issue(config, identity))
            return 0
        if args.action == "submit":
            if args.issue <= 0:
                raise WorkflowError("Issue 编号必须为正整数")
            _print(submit_issue(config, args.issue, args.workspace))
            return 0
        if args.action == "review-all":
            _print(review_all(config, args.workspace.expanduser().resolve()))
            return 0
        if args.action == "schedule-preview":
            _print(schedule_preview(config, args.workspace))
            return 0
        if args.action == "schedule-install":
            _print(schedule_install(config, args.workspace))
            return 0
        raise WorkflowError("未知操作")
    except WorkflowError as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
