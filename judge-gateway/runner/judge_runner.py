#!/usr/bin/env python3
"""Trusted, bounded wrapper around one stdin/stdout Python program execution."""

from __future__ import annotations

import json
import base64
from contextlib import suppress
import os
import resource
import selectors
import signal
import subprocess
import sys
import time


def positive_int(value: str, low: int, high: int) -> int:
    parsed = int(value)
    if parsed < low or parsed > high:
        raise ValueError(f"value outside {low}..{high}")
    return parsed


def child_limits(timeout_ms: int) -> None:
    os.setsid()
    seconds = max(1, (timeout_ms + 999) // 1000)
    resource.setrlimit(resource.RLIMIT_CPU, (seconds, seconds + 1))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    # The Cloudflare base image currently starts exec commands as root. Drop the
    # contestant process only; the wrapper remains able to kill its process group.
    if os.geteuid() == 0:
        os.setgroups([])
        os.setgid(65534)
        os.setuid(65534)


def kill_group(proc: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def main() -> int:
    if len(sys.argv) != 5 or sys.argv[1] != "python3":
        raise ValueError("usage: judge_runner.py python3 SOURCE TIMEOUT_MS OUTPUT_BYTES")
    source = sys.argv[2]
    if source != "/workspace/submission.py":
        raise ValueError("unsupported source path")
    timeout_ms = positive_int(sys.argv[3], 100, 30_000)
    output_limit = positive_int(sys.argv[4], 1_024, 262_144)
    stdin_data = sys.stdin.buffer.read(65_537)
    if len(stdin_data) > 65_536:
        raise ValueError("stdin exceeds runner limit")

    env = {
        "HOME": "/tmp/judge",
        "LANG": "C.UTF-8",
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "PYTHONHASHSEED": "0",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    started = time.monotonic()
    proc = subprocess.Popen(
        [sys.executable, "-I", source],
        cwd="/workspace",
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=lambda: child_limits(timeout_ms),
    )
    assert proc.stdin is not None and proc.stdout is not None and proc.stderr is not None
    try:
        proc.stdin.write(stdin_data)
    except (BrokenPipeError, OSError):
        # An early-exiting contestant is still an ordinary runtime result.
        pass
    finally:
        with suppress(BrokenPipeError, OSError):
            proc.stdin.close()
    os.set_blocking(proc.stdout.fileno(), False)
    os.set_blocking(proc.stderr.fileno(), False)
    selector = selectors.DefaultSelector()
    selector.register(proc.stdout, selectors.EVENT_READ, "stdout")
    selector.register(proc.stderr, selectors.EVENT_READ, "stderr")
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    timed_out = False
    output_limited = False

    while selector.get_map():
        remaining = timeout_ms / 1000 - (time.monotonic() - started)
        if remaining <= 0:
            timed_out = True
            kill_group(proc)
            break
        for key, _ in selector.select(min(remaining, 0.05)):
            chunk = os.read(key.fileobj.fileno(), 8192)
            if not chunk:
                selector.unregister(key.fileobj)
                continue
            target = buffers[key.data]
            room = output_limit - len(target)
            if room > 0:
                target.extend(chunk[:room])
            if len(chunk) > room:
                output_limited = True
                kill_group(proc)
                break
        if output_limited:
            break

    try:
        exit_code = proc.wait(timeout=1)
    except subprocess.TimeoutExpired:
        kill_group(proc)
        exit_code = proc.wait(timeout=1)

    response = {
        "version": 1,
        "exitCode": exit_code,
        "timedOut": timed_out,
        "outputLimited": output_limited,
        "stdoutBase64": base64.b64encode(buffers["stdout"]).decode("ascii"),
        "stderrBase64": base64.b64encode(buffers["stderr"]).decode("ascii"),
    }
    sys.stdout.write(json.dumps(response, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # Protocol errors belong to the trusted wrapper.
        sys.stderr.write(f"judge runner error: {type(exc).__name__}: {exc}\n")
        raise SystemExit(70)
