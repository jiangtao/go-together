#!/usr/bin/env python3
"""Run a constrained Codex review for one private learner-answer Issue."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional, Sequence


ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
VALID_STATUSES = {"passed", "revision-needed", "blocked"}


class ReviewerError(ValueError):
    pass


def _read_request() -> dict[str, Any]:
    try:
        value = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        raise ReviewerError("审核请求不是有效 JSON") from error
    if not isinstance(value, dict):
        raise ReviewerError("审核请求必须是 JSON 对象")
    expected = {
        "schemaVersion",
        "repository",
        "issueNumber",
        "courseId",
        "lessonId",
        "workspace",
    }
    if set(value) != expected or value["schemaVersion"] != 1:
        raise ReviewerError("审核请求字段不符合协议")
    if not isinstance(value["repository"], str) or not REPOSITORY_PATTERN.fullmatch(
        value["repository"]
    ):
        raise ReviewerError("审核请求的 repository 无效")
    if not isinstance(value["issueNumber"], int) or value["issueNumber"] <= 0:
        raise ReviewerError("审核请求的 issueNumber 无效")
    for key in ("courseId", "lessonId"):
        if not isinstance(value[key], str) or not ID_PATTERN.fullmatch(value[key]):
            raise ReviewerError(f"审核请求的 {key} 无效")
    if not isinstance(value["workspace"], str):
        raise ReviewerError("审核请求的 workspace 无效")
    return value


def _resolve_workspace(value: str, expected: Path) -> Path:
    requested = Path(value).expanduser().resolve()
    if requested != expected.expanduser().resolve():
        raise ReviewerError("审核请求 workspace 与本机审核器不一致")
    if not requested.is_dir():
        raise ReviewerError("本机审核 workspace 不存在")
    return requested


def _find_codex(explicit_path: Optional[str]) -> str:
    candidates: list[Optional[str]] = [explicit_path, os.environ.get("CODEX_BIN")]
    candidates.append(shutil.which("codex"))
    candidates.append("/Applications/ChatGPT.app/Contents/Resources/codex")
    for candidate in candidates:
        if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return str(Path(candidate).resolve())
    raise ReviewerError("未找到可执行的 Codex CLI")


def _prompt(request: dict[str, Any]) -> str:
    return "\n".join(
        [
            "你是私有课程答题 Issue 的受限审核器。",
            "只审核当前请求指定的一个稳定学习身份，不得读取或评测其他 Lesson。",
            f"目标仓库：{request['repository']}。",
            f"目标 Issue：#{request['issueNumber']}。",
            f"稳定学习身份：({request['courseId']}, {request['lessonId']})。",
            "请使用只读命令读取该 Issue、对应 Course manifest、Lesson 正文与课程评测政策。",
            "判断学习者的回答和最小证据是否足以通过本轮审核；不能确认时使用 revision-needed，协议/访问/安全问题使用 blocked。",
            "严禁编辑 GitHub Issue、文件、课程、评测记录或 crontab。",
            "严禁输出、复述、润色或补全学习者回答，严禁提供标准答案、提示、代码或推导。",
            "最终回复必须且只能是 JSON 对象：{\"status\":\"passed\"}、{\"status\":\"revision-needed\"} 或 {\"status\":\"blocked\"}。",
        ]
    )


def review(
    request: dict[str, Any], workspace: Path, codex_binary: Optional[str] = None
) -> dict[str, str]:
    workspace = _resolve_workspace(request["workspace"], workspace)
    codex = _find_codex(codex_binary)
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["status"],
        "properties": {
            "status": {
                "type": "string",
                "enum": sorted(VALID_STATUSES),
            }
        },
    }
    with tempfile.TemporaryDirectory(prefix="go-together-answer-review-") as directory:
        temporary_directory = Path(directory)
        schema_path = temporary_directory / "response-schema.json"
        output_path = temporary_directory / "response.json"
        schema_path.write_text(json.dumps(schema), encoding="utf-8")
        command = [
            codex,
            "exec",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--cd",
            str(workspace),
            "--output-schema",
            str(schema_path),
            "--output-last-message",
            str(output_path),
            _prompt(request),
        ]
        try:
            result = subprocess.run(
                command,
                text=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                timeout=900,
            )
        except subprocess.TimeoutExpired as error:
            raise ReviewerError("Codex 审核超时") from error
        if result.returncode != 0 or not output_path.is_file():
            raise ReviewerError("Codex 审核未产生可信结论")
        try:
            output = json.loads(output_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise ReviewerError("Codex 审核结论不是有效 JSON") from error
    if not isinstance(output, dict) or set(output) != {"status"}:
        raise ReviewerError("Codex 审核结论字段不合法")
    status = output.get("status")
    if status not in VALID_STATUSES:
        raise ReviewerError("Codex 审核结论状态不受支持")
    return {"status": status}


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Constrained semantic reviewer for one private learner-answer GitHub Issue."
    )
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--codex-bin")
    args = parser.parse_args(argv)
    try:
        result = review(_read_request(), args.workspace, args.codex_bin)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        return 0
    except ReviewerError as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
