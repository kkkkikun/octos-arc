"""Local acceptance testing for the ARC adapter.

Runs the public (or container-provided) Playwright specs that belong to one
requirement node against the generated app, and turns failures into the
compact four-field summary (Feature / Failed at / Observation / Steps) fed back
to the model. Spec discovery, spec->node mapping and report parsing are pure
functions covered by arc/tests/test_acceptance.py; process handling lives in
`AcceptanceRunner`.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_SPEC_ID = re.compile(r"^(REQ-\d+(?:\.\d+)*)(?=[.\-_ ]|$)")


def spec_node_id(rel_path: str) -> str | None:
    """`REQ-1.2-user-login.spec.ts` -> `REQ-1.2`; non-spec files -> None."""
    name = Path(rel_path).name
    if not name.endswith(".spec.ts"):
        return None
    m = _SPEC_ID.match(name)
    return m.group(1) if m else None


def _version_key(req_id: str) -> tuple:
    return tuple(int(p) for p in re.findall(r"\d+", req_id))


def map_specs_to_nodes(spec_paths: list[str], node_ids: list[str]) -> tuple[dict, dict]:
    """Assign spec files to requirement nodes.

    Returns (mapping, aliases): mapping[node_id] -> [spec paths] with the key
    None holding specs that belong to no single node (regression set);
    aliases[spec_id] -> node_id for spec ids that are not literal node ids.

    Order of preference: literal id match; when the remaining distinct spec
    ids and the remaining nodes have the same count, pair them in numeric /
    document order; otherwise attach `REQ-1.x` to an existing `REQ-1` parent.
    """
    mapping: dict = {nid: [] for nid in node_ids}
    mapping[None] = []
    aliases: dict[str, str] = {}
    by_spec_id: dict[str, list[str]] = {}
    for path in spec_paths:
        sid = spec_node_id(path)
        if sid is None:
            continue
        by_spec_id.setdefault(sid, []).append(path)
    unmatched_ids = []
    for sid in sorted(by_spec_id, key=_version_key):
        if sid in mapping:
            mapping[sid].extend(by_spec_id[sid])
        else:
            unmatched_ids.append(sid)
    free_nodes = [nid for nid in node_ids if not mapping[nid]]
    if unmatched_ids and len(unmatched_ids) == len(free_nodes):
        for sid, nid in zip(unmatched_ids, free_nodes):
            mapping[nid].extend(by_spec_id[sid])
            aliases[sid] = nid
        return mapping, aliases
    for sid in unmatched_ids:
        parent = sid
        target = None
        while "." in parent:
            parent = parent.rsplit(".", 1)[0]
            if parent in mapping:
                target = parent
                break
        if target is None:
            mapping[None].extend(by_spec_id[sid])
        else:
            mapping[target].extend(by_spec_id[sid])
            aliases[sid] = target
    return mapping, aliases


@dataclass
class TestOutcome:
    title: str
    ok: bool
    status: str
    duration_ms: int
    file: str = ""
    line: int | None = None
    message: str = ""
    steps: list[str] = field(default_factory=list)


@dataclass
class RunSummary:
    passed: int = 0
    total: int = 0
    results: list[TestOutcome] = field(default_factory=list)
    stdout_tail: str = ""
    error: str | None = None  # infrastructure error (no report)

    def slow(self, threshold_ms: int) -> list[str]:
        return [r.title for r in self.results if r.duration_ms >= threshold_ms]

    @property
    def all_passed(self) -> bool:
        return self.total > 0 and self.passed == self.total


def summarize_report(report: dict) -> RunSummary:
    """Collapse a Playwright JSON report into per-test outcomes."""
    summary = RunSummary()

    def walk(suites, parent_file=""):
        for suite in suites or []:
            file = suite.get("file") or parent_file
            for spec in suite.get("specs", []):
                tests = spec.get("tests", [])
                results = [r for t in tests for r in t.get("results", [])]
                last = results[-1] if results else {}
                ok = bool(tests) and all(t.get("status") == "expected" or t.get("ok") for t in tests)
                err = last.get("error") or (last.get("errors") or [{}])[0] or {}
                loc = err.get("location") or {}
                steps = [s.get("title", "") for s in last.get("steps", []) if s.get("title")]
                summary.results.append(TestOutcome(
                    title=spec.get("title", "?"), ok=ok, status=last.get("status", "unknown"),
                    duration_ms=int(sum(r.get("duration", 0) for r in results)),
                    file=Path(loc.get("file") or spec.get("file") or file or "").name,
                    line=loc.get("line"), message=_ANSI.sub("", str(err.get("message") or "")),
                    steps=steps))
            walk(suite.get("suites", []), file)

    walk(report.get("suites", []))
    summary.total = len(summary.results)
    summary.passed = sum(1 for r in summary.results if r.ok)
    return summary


def _call_log_steps(message: str) -> list[str]:
    """Playwright's `Call log:` lines are the closest thing to a step trace
    when the spec has no test.step() blocks."""
    steps = []
    seen = False
    for line in message.splitlines():
        if line.strip().lower().startswith("call log"):
            seen = True
            continue
        if seen:
            stripped = line.strip().lstrip("-").strip()
            if not stripped:
                break
            steps.append(stripped[:120])
    return steps


def failure_summaries(summary: RunSummary, max_steps: int = 8, max_observation: int = 500) -> str:
    """Four-field digest of every failed test — the only thing the model sees."""
    blocks = []
    for r in summary.results:
        if r.ok:
            continue
        observation = r.message.strip() or f"status {r.status}"
        if r.status == "timedOut" or "timeout" in observation.lower()[:120]:
            observation = (f"TIMED OUT after {r.duration_ms} ms (the grader kills a test at 10 s; the "
                           f"page or a request never settled). " + observation)
        observation = observation[:max_observation]
        where = f"{r.file}:{r.line}" if r.line else (r.file or "?")
        steps_src = r.steps or _call_log_steps(r.message)
        steps = " -> ".join(steps_src[-max_steps:]) if steps_src else "(no step trace)"
        blocks.append(f"- Feature: {r.title}\n  Failed at: {where}\n  Observation: {observation}\n  Steps: {steps}")
    return "\n".join(blocks)


# ---------------------------------------------------------------- processes

def find_playwright_root(candidates: list[Path]) -> Path | None:
    """First directory that has @playwright/test installed."""
    for cand in candidates:
        if cand and (cand / "node_modules" / "@playwright" / "test").is_dir():
            return cand.resolve()
    return None


def acceptance_work_dir(root: Path) -> Path:
    """A writable scratch dir under the Playwright root (module resolution),
    falling back to the system temp dir."""
    preferred = root / ".octos-acceptance" / f"run-{os.getpid()}"
    try:
        preferred.mkdir(parents=True, exist_ok=True)
        return preferred
    except OSError:
        return Path(tempfile.mkdtemp(prefix="octos-acceptance-")) / "run"


def playwright_candidates(bundle_dir: Path, tests_dir: Path | None, output_dir: Path) -> list[Path]:
    cands: list[Path] = []
    env_root = os.environ.get("OCTOS_ARC_PLAYWRIGHT_ROOT")
    if env_root:
        cands.append(Path(env_root))
    cands.append(bundle_dir / "local-grader")
    if tests_dir:
        cands.extend([tests_dir, *tests_dir.parents][:4])
    cands.extend([output_dir, Path("/workspace"), Path.home() / ".octos-arc-playwright"])
    return cands


def ensure_playwright(install_root: Path, log: Callable[[str], None], timeout: int = 540) -> Path | None:
    """Best-effort install of @playwright/test + chromium via the China mirrors."""
    install_root.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ,
               npm_config_registry="https://registry.npmmirror.com",
               PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright")
    t0 = time.time()
    steps = [
        ["npm", "init", "-y"],
        ["npm", "install", "--no-audit", "--no-fund", "@playwright/test"],
        ["npx", "playwright", "install", "chromium"],
    ]
    for cmd in steps:
        remaining = timeout - (time.time() - t0)
        if remaining <= 0:
            log("[acceptance] playwright install timed out")
            return None
        try:
            r = subprocess.run(cmd, cwd=install_root, env=env, capture_output=True, text=True, timeout=remaining)
        except (subprocess.TimeoutExpired, OSError) as exc:
            log(f"[acceptance] playwright install step {cmd[:2]} failed: {exc}")
            return None
        if r.returncode != 0:
            log(f"[acceptance] playwright install step {cmd[:2]} rc={r.returncode}: {(r.stderr or r.stdout)[-300:]}")
            return None
    log(f"[acceptance] playwright installed into {install_root} in {time.time()-t0:.0f}s")
    return find_playwright_root([install_root])


def free_port(port: int) -> None:
    try:
        pids = subprocess.run(["lsof", "-ti", f":{port}"], capture_output=True, text=True, timeout=15).stdout.split()
    except (OSError, subprocess.TimeoutExpired):
        return
    for pid in pids:
        try:
            os.kill(int(pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError, ValueError):
            pass


def port_open(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


def snapshot_worktree(git_run: Callable[[list[str]], object]) -> None:
    """Stage everything so `restore_worktree` can undo what a test run mutates
    (persisted JSON stores, uploaded files) without losing the model's edits."""
    git_run(["add", "-A"])


def restore_worktree(git_run: Callable[[list[str]], object], parts: tuple[str, ...] = ("frontend", "backend")) -> None:
    """Return tracked files to the staged snapshot and drop files a test run
    created; ignored build outputs (node_modules, dist) are left alone."""
    git_run(["checkout", "--", "."])
    git_run(["clean", "-fdq", "-e", "node_modules", "-e", "dist", "--", *parts])


class AppServer:
    """Build the frontend once and run the backend on the smoke port."""

    def __init__(self, project: Path, port: int, log: Callable[[str], None], env_extra: dict | None = None):
        self.project = project
        self.port = port
        self.log = log
        self.env_extra = env_extra or {}
        self.proc: subprocess.Popen | None = None
        self.log_file: Path | None = None

    def _run(self, cmd: list[str], cwd: Path, timeout: int) -> tuple[int, str]:
        try:
            r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                               env=dict(os.environ, **self.env_extra))
        except subprocess.TimeoutExpired:
            return 124, f"timeout after {timeout}s"
        except OSError as exc:
            return 127, str(exc)
        return r.returncode, ((r.stdout or "") + "\n" + (r.stderr or "")).strip()[-1500:]

    def build(self) -> str | None:
        frontend, backend = self.project / "frontend", self.project / "backend"
        if not (frontend / "package.json").is_file() or not (backend / "package.json").is_file():
            return "frontend/package.json or backend/package.json missing"
        for part in (frontend, backend):
            deps = {}
            try:
                deps = json.loads((part / "package.json").read_text()).get("dependencies") or {}
            except Exception:  # noqa: BLE001
                pass
            if deps and not (part / "node_modules").is_dir():
                rc, out = self._run(["npm", "install", "--no-audit", "--no-fund"], part, 600)
                if rc != 0:
                    return f"{part.name} `npm install` failed:\n{out}"
        rc, out = self._run(["npm", "run", "build"], frontend, 600)
        if rc != 0:
            return f"frontend `npm run build` failed:\n{out}"
        return None

    def start(self, wait_seconds: int = 45) -> str | None:
        free_port(self.port)
        self.log_file = Path(tempfile.mkstemp(prefix="octos-app-", suffix=".log")[1])
        env = dict(os.environ, PORT=str(self.port), ARC_EXTRA_PORTS="0", **self.env_extra)
        try:
            fh = open(self.log_file, "w")
            self.proc = subprocess.Popen(["npm", "start"], cwd=self.project / "backend", env=env,
                                         stdout=fh, stderr=subprocess.STDOUT, start_new_session=True)
        except OSError as exc:
            return f"backend `npm start` could not launch: {exc}"
        deadline = time.time() + wait_seconds
        while time.time() < deadline:
            if self.proc.poll() is not None:
                return (f"backend `npm start` exited early (rc={self.proc.returncode}):\n"
                        f"{self.log_file.read_text(errors='replace')[-1500:]}")
            if port_open(self.port):
                return None
            time.sleep(0.5)
        self.stop()
        return f"backend did not bind port {self.port} within {wait_seconds}s:\n" + \
            (self.log_file.read_text(errors="replace")[-1500:] if self.log_file else "")

    def tail(self, n: int = 1500) -> str:
        try:
            return self.log_file.read_text(errors="replace")[-n:] if self.log_file else ""
        except OSError:
            return ""

    def stop(self) -> None:
        if self.proc is not None:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                pass
            self.proc = None
        free_port(self.port)
        if self.log_file:
            try:
                self.log_file.unlink()
            except OSError:
                pass
            self.log_file = None


class AcceptanceRunner:
    """Run selected spec files from `tests_dir` with the Playwright install at `root`."""

    def __init__(self, root: Path, tests_dir: Path, work_dir: Path, log: Callable[[str], None],
                 timeout_ms: int = 10000, workers: int = 2):
        self.root = root
        self.tests_dir = tests_dir
        self.work_dir = work_dir
        self.log = log
        self.timeout_ms = timeout_ms
        self.workers = workers

    def _prepare(self) -> Path:
        # Specs `import '@playwright/test'`; Node resolves that upward from the
        # spec file, so the copied tree must sit under the Playwright install
        # (NODE_PATH is set as well for the case where it cannot).
        if self.work_dir.exists():
            shutil.rmtree(self.work_dir)
        shutil.copytree(self.tests_dir, self.work_dir / "tests",
                        ignore=shutil.ignore_patterns("node_modules", "test-results", "playwright-report"))
        (self.work_dir / "playwright.config.ts").write_text(
            "import { defineConfig } from '@playwright/test';\n"
            f"export default defineConfig({{ testDir: './tests', timeout: {self.timeout_ms}, retries: 0, "
            f"workers: {self.workers}, reporter: [['json', {{ outputFile: 'report.json' }}]], "
            "use: { headless: true, baseURL: process.env.E2E_BASE_URL, actionTimeout: 0 } });\n")
        return self.work_dir / "playwright.config.ts"

    def run(self, spec_rel_paths: list[str], base_url: str, wall_timeout: int = 900) -> RunSummary:
        config = self._prepare()
        report_path = self.work_dir / "report.json"
        cmd = [str(self.root / "node_modules" / ".bin" / "playwright"), "test", "-c", str(config)]
        cmd += [str(self.work_dir / "tests" / p) for p in spec_rel_paths]
        env = dict(os.environ, E2E_BASE_URL=base_url, CI="1",
                   NODE_PATH=str(self.root / "node_modules"))
        env.pop("FORCE_COLOR", None)
        t0 = time.time()
        try:
            r = subprocess.run(cmd, cwd=self.work_dir, env=env, capture_output=True, text=True, timeout=wall_timeout)
            tail = ((r.stdout or "") + (r.stderr or ""))[-2000:]
        except subprocess.TimeoutExpired:
            return RunSummary(error=f"playwright run exceeded {wall_timeout}s")
        except OSError as exc:
            return RunSummary(error=f"playwright could not start: {exc}")
        if not report_path.exists():
            return RunSummary(error=f"playwright produced no report (rc={r.returncode}): {_ANSI.sub('', tail)[-600:]}")
        try:
            summary = summarize_report(json.loads(report_path.read_text()))
        except (OSError, json.JSONDecodeError) as exc:
            return RunSummary(error=f"unreadable playwright report: {exc}")
        summary.stdout_tail = _ANSI.sub("", tail)
        self.log(f"[acceptance] {summary.passed}/{summary.total} passed in {time.time()-t0:.0f}s "
                 f"({', '.join(spec_rel_paths)})")
        return summary
