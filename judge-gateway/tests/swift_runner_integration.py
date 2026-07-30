#!/usr/bin/env python3
"""Smoke-test the trusted Swift compile/run wrapper inside a Linux Swift image.

This is intentionally separate from the TypeScript unit suite: the local
developer environment may not have Swift or the POSIX process controls used by
the production image.
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path("/workspace")
JUDGE = Path("/tmp/judge")
RUNNER = Path(__file__).resolve().parents[1] / "runner" / "judge_runner.py"


def run(mode: str, target: str, stdin: str = "", timeout_ms: int = 5_000, output_limit: int = 4_096) -> dict[str, object]:
    completed = subprocess.run(
        [sys.executable, str(RUNNER), mode, target, str(timeout_ms), str(output_limit)],
        input=stdin.encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        raise AssertionError(f"runner protocol failed: {completed.stderr.decode(errors='replace')}")
    return json.loads(completed.stdout)


def decoded(response: dict[str, object], field: str) -> str:
    value = response[field]
    assert isinstance(value, str)
    return base64.b64decode(value).decode()


def main() -> int:
    assert shutil.which("swiftc"), "Swift compiler is required for this integration test"
    ROOT.mkdir(parents=True, exist_ok=True)
    JUDGE.mkdir(parents=True, exist_ok=True)
    (JUDGE / "module-cache").mkdir(parents=True, exist_ok=True)
    os.chmod(JUDGE, 0o777)
    os.chmod(JUDGE / "module-cache", 0o777)

    (ROOT / "main.swift").write_text(
        'import Foundation\n@main\nstruct Main {\n    static func main() {\n        let value = readLine() ?? ""\n        print(value.uppercased())\n    }\n}\n',
        encoding="utf-8",
    )
    compile_response = run("swift-compile", "/workspace/main.swift", timeout_ms=20_000)
    assert compile_response["exitCode"] == 0, decoded(compile_response, "stderr")
    execute_response = run("swift-run", "/tmp/judge/submission", "ghost\n")
    assert execute_response["exitCode"] == 0
    assert decoded(execute_response, "stdout") == "GHOST\n"

    (ROOT / "main.swift").write_text("import Foundation\nlet broken =\n", encoding="utf-8")
    compile_error = run("swift-compile", "/workspace/main.swift", timeout_ms=20_000)
    assert compile_error["exitCode"] != 0
    assert decoded(compile_error, "stderr")

    (ROOT / "main.swift").write_text("@main\nstruct Main {\n    static func main() { while true {} }\n}\n", encoding="utf-8")
    compile_response = run("swift-compile", "/workspace/main.swift", timeout_ms=20_000)
    assert compile_response["exitCode"] == 0, decoded(compile_response, "stderr")
    timeout = run("swift-run", "/tmp/judge/submission", timeout_ms=300)
    assert timeout["timedOut"] is True

    (ROOT / "main.swift").write_text("@main\nstruct Main {\n    static func main() { for _ in 0..<100000 { print(\"x\") } }\n}\n", encoding="utf-8")
    compile_response = run("swift-compile", "/workspace/main.swift", timeout_ms=20_000)
    assert compile_response["exitCode"] == 0, decoded(compile_response, "stderr")
    output_limited = run("swift-run", "/tmp/judge/submission", output_limit=1_024)
    assert output_limited["outputLimited"] is True
    print("Swift runner integration passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
