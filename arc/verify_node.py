#!/usr/bin/env python3
"""Acceptance command for ONE requirement node -- the `command validator` a
pipeline `shell_check` node runs: build the app, serve it, run that node's
public Playwright specs, exit 0 (pass) / non-zero (fail). The DAG scheduler
turns that status into Pass/Fail and hands stdout+stderr to the implement node
over the failure back-edge, so everything printed here is what the model sees
on retry. Playwright's exit code IS the verdict; nothing re-derives it.

The app dir is the CWD = the pipeline run dir, the only place this node's
write_file calls land (its file tools are fenced there).

usage: verify_node.py <tests_dir> <port> [--tag ID --attempts N --deadline EPOCH --repair-window S --best 1] [spec.ts ...]
       verify_node.py --seed <deliverable_dir>

A failing run prints STOP when this tag has used its N attempts, has been
repairing for longer than its window, or the deadline has passed; the repair back-edge does not fire on that marker, so the
pipeline moves on instead of spending the budget of the requirements to come.
Every step has its own timeout below the node's, because a shell_check that
overruns its node timeout is an ERROR that aborts the whole pipeline.
"""
import json, os, re, shutil, signal, socket, subprocess, sys, tempfile, time
from pathlib import Path

STOP = "ARC_NO_MORE_REPAIRS"
PASSED = {"count": 0}               # tests the last check passed (for --best)
INSTALL = "npm install --no-audit --no-fund --no-package-lock"

# The harness owns the two manifests so the model never spends a turn on them
# (build copies src/* to dist; start runs server.js).
MANIFESTS = {
    "frontend/package.json": {"name": "f", "private": True, "scripts": {
        "build": "node -e \"const f=require('fs');f.rmSync('dist',{recursive:true,force:true});f.cpSync('src','dist',{recursive:true})\""}},
    "backend/package.json": {"name": "b", "private": True, "type": "commonjs",
                             "scripts": {"start": "node server.js"}},
}


def seed(src: Path) -> int:
    """Start the run dir from the existing app (evolution tasks, the platform
    template), else the bundle's own template: the model extends real files
    instead of rebuilding from nothing, and nothing stale survives collection."""
    out = Path.cwd()
    for base in (src, Path(__file__).resolve().parent / "template"):
        if (base / "frontend").is_dir() and not (out / "frontend").exists():
            for part in ("frontend", "backend"):
                if (base / part).is_dir():
                    shutil.copytree(base / part, out / part, dirs_exist_ok=True,
                                    ignore=shutil.ignore_patterns("node_modules", "dist", ".git"))
            print(f"[seed] workspace seeded from {base}")
    return 0


def free(port: int) -> bool:
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) != 0


def stop(proc) -> None:
    """Tolerant teardown: never die here and leave the app listening, or the
    next node's check would score this node's server."""
    if proc is None or proc.poll() is not None:
        return
    for attempt in (lambda: os.killpg(os.getpgid(proc.pid), signal.SIGTERM), proc.terminate,
                    lambda: os.killpg(os.getpgid(proc.pid), signal.SIGKILL), proc.kill):
        # SIGKILL must take the whole group: a pid-only kill leaves npm's
        # children holding the port, and every later boot scores a zombie.
        try:
            attempt(); proc.wait(timeout=10); return
        except (OSError, subprocess.TimeoutExpired):
            continue


def sh(cmd, cwd, env, timeout):
    try:
        r = subprocess.run(cmd, cwd=cwd, env=env, shell=isinstance(cmd, str),
                           capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired as exc:
        out = (exc.stdout or b"") + (exc.stderr or b"")
        return 124, (out.decode(errors="replace") if isinstance(out, bytes) else out) + f"\n[timed out after {timeout}s]"
    except FileNotFoundError as exc:      # a missing binary is a verdict, not a crash
        return 127, f"command not found: {exc}"


PLAYWRIGHT_VERSION = "1.63.0"   # never `latest`: an unpinned install broke cloud grading once


def playwright_root(env: dict) -> tuple[Path | None, dict]:
    """A directory holding node_modules/@playwright/test, plus the env its
    browsers need. The runner image ships one (/opt/arcbench on the platform,
    seen in every cloud run); a private pinned install through the mirrors is
    the fallback, cached for every later check."""
    private = Path(os.environ.get("TMPDIR", "/tmp")) / "arc-playwright"
    cands = [os.environ.get("OCTOS_ARC_PLAYWRIGHT_ROOT"), "/opt/arcbench", "/workspace", "/workspace/tests"]
    rc, npm_root = sh(["npm", "root", "-g"], "/", env, 20)
    if rc == 0 and npm_root.strip():
        cands.append(str(Path(npm_root.strip().splitlines()[-1]).parent))
    # The CLI file, not the package dir: a wiped cache once left an empty
    # @playwright/test behind, and every check then died on the dangling
    # .bin/playwright link -- a whole local keep run was verified by nothing.
    has = lambda root: (Path(root) / "node_modules" / "@playwright" / "test" / "cli.js").is_file()  # noqa: E731
    for cand in filter(None, cands):
        if has(cand):
            return Path(cand), {}
    browsers = {"PLAYWRIGHT_BROWSERS_PATH": str(private / "browsers")}
    if has(private):
        return private, browsers if (private / "browsers").is_dir() else {}
    rc, hits = sh(["find", "/", "-maxdepth", "6", "-type", "d", "-path", "*/node_modules/@playwright/test",
                   "-not", "-path", "/proc/*", "-not", "-path", "/sys/*"], "/", env, 25)
    for hit in sorted(hits.split(), key=len):
        # find's own "Permission denied" lines land here too; only real hits count.
        if hit.endswith("/node_modules/@playwright/test") and has(Path(hit).parents[2]):
            return Path(hit).parents[2], {}
    if os.environ.get("OCTOS_ARC_INSTALL_PLAYWRIGHT", "1") != "1":
        return None, {}
    private.mkdir(parents=True, exist_ok=True)
    (private / "package.json").write_text('{"name": "arc-verify", "private": true}')
    mirror = dict(env, npm_config_registry="https://registry.npmmirror.com",
                  PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright", **browsers)
    rc, log = sh(f"{INSTALL} @playwright/test@{PLAYWRIGHT_VERSION} && "
                 "./node_modules/.bin/playwright install chromium", private, mirror, 600)
    if rc:
        print(f"[verify] private Playwright install failed:\n{log[-800:]}")
    return (private, browsers) if rc == 0 else (None, {})


NO_BROWSER = "Executable doesn't exist"

TAG_RE = re.compile(r"<(a|button)\b([^>]*)>(.*?)</\1>", re.S | re.I)


def name_twins(pages: Path) -> list[str]:
    """Accessible names that one link AND one button both carry. Graders
    resolve controls by role plus name, and the github leg shipped a 'Sign in'
    link next to a handler-less button of the same name: every role-ordered
    click hit the dead twin and timed out. Same-tag repeats (a row of Delete
    buttons) are fine; the wound is the cross-tag collision."""
    by_name: dict[str, set[str]] = {}
    for page in pages.glob("*.html"):
        for tag, attrs, body in TAG_RE.findall(page.read_text(errors="replace")):
            label = re.search(r'aria-label="([^"]+)"', attrs)
            name = (label.group(1) if label else re.sub(r"<[^>]+>", " ", body)).strip()
            if name:
                by_name.setdefault(name.casefold(), set()).add(tag.casefold())
    return sorted(n for n, tags in by_name.items() if len(tags) > 1)[:8]

SPEC_ID_LINE = re.compile(r"(\S+\.spec\.ts:\d+):\d+")


def spec_ids(listing: str) -> list[str]:
    """Playwright `--list` prints one runnable filter per test. A positional
    filter matches file:line only -- the printed "› Title" suffix makes it
    match nothing -- so keep just that part. A suite that cannot be
    enumerated returns [] and the caller falls back to a whole-suite run."""
    ids: list[str] = []
    for ln in listing.splitlines():
        m = SPEC_ID_LINE.search(ln)
        if m and m.group(1) not in ids:
            ids.append(m.group(1))
    return ids


def state_snapshot(app: Path) -> dict[Path, bytes]:
    """The app's mutable data (a store the scenarios edit), so each test can
    start from the seed. Spec pairs are stateful -- the rename spec's first
    scenario renames the seeded workbook away and its second then cannot find
    it -- and one shared session makes every later GIVEN a lie the repair
    round can never fix (three generations burned on exactly that)."""
    return {p: p.read_bytes() for p in store_files(app)}


def store_files(app: Path) -> list[Path]:
    """The backend's mutable data files: store suffixes plus extensionless
    files (a SQLite sidecar `.db-wal` must ride with its `.db`, or a stale WAL
    replays the previous scenario's edits over the restored seed)."""
    suffixes = {".json", ".csv", ".db", ".sqlite", ".db-wal", ".db-shm", ".txt", ""}
    return [p for p in (app / "backend").rglob("*")
            if p.is_file() and "node_modules" not in p.parts and p.suffix in suffixes
            and not p.name.startswith(".") and p.name not in ("package.json", "package-lock.json")]


def drop_unseeded_stores(app: Path, seed: dict[Path, bytes]) -> None:
    """Delete data files a scenario CREATED that the seed never had -- records
    an earlier test added must not satisfy a later test's GIVEN (a false pass
    against fresh grading) nor poison it (a false fail)."""
    for p in store_files(app):
        if p not in seed:
            p.unlink(missing_ok=True)

ASSET_RE = re.compile(r'(?:src|href)="(/(?!/)[^"]+?\.(?:js|css)(?:\?[^"]*)?)"')
PAGE_RE = re.compile(r'href="(/[^"]+)"')


def asset_holes(pages: Path, port: int) -> list[str]:
    """Root-absolute .js/.css a page references but the server 404s -- a
    static-page whitelist that omitted /app.js shipped on the github leg and
    killed every page's JS while markup-only flows still passed their specs.
    Page links are covered too, but only where the built page exists: a
    served href="/signin" with dist/signin.html present must not 404 (the
    whitelist once matched the bare name and forgot the .html)."""
    import urllib.request
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    refs = {m.group(1) for p in pages.glob("*.html")
            for m in ASSET_RE.finditer(p.read_text(errors="replace"))}
    refs |= {m.group(1) for p in pages.glob("*.html")
             for m in PAGE_RE.finditer(p.read_text(errors="replace"))
             if (pages / (m.group(1).lstrip("/") + ".html")).is_file()}

    def hole(asset: str) -> bool:  # a 404 raises HTTPError, never compares
        try:
            return opener.open(f"http://127.0.0.1:{port}{asset}", timeout=10).status != 200
        except Exception:  # noqa: BLE001 -- refused/timeout/4xx/5xx alike
            return True
    return sorted(a for a in refs if hole(a))


def install_browser(pw: str, root: Path, env: dict) -> bool:
    """A Playwright whose browser build is missing (a wiped cache, a version
    bump) fails every spec in the same way -- a local run once burned 670
    nodes on that. Fetch chromium once, upstream then through the mirror."""
    for extra in ({}, {"PLAYWRIGHT_DOWNLOAD_HOST": "https://npmmirror.com/mirrors/playwright"}):
        rc, log = sh([pw, "install", "chromium"], root, dict(env, **extra), 600)
        if rc == 0:
            print("[verify] installed the missing Playwright browser")
            return True
    print(f"[verify] Playwright browser install failed:\n{log[-800:]}")
    return False


def check(tests: Path, port: int, specs: list[str]) -> int:
    out = Path.cwd()
    for rel, data in MANIFESTS.items():
        if not (out / rel).exists():
            (out / rel).parent.mkdir(parents=True, exist_ok=True)
            (out / rel).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    if not (out / "frontend" / "src").is_dir():
        print("[verify] no frontend/src: the implement node wrote nothing to verify")
        return 1
    env = os.environ.copy()
    env.pop("FORCE_COLOR", None)           # plain text for the model reading the failure
    if os.environ.get("NODE_BIN"):
        env["PATH"] = os.environ["NODE_BIN"] + ":" + env.get("PATH", "")
    # Verify a disposable copy: the specs create, edit and delete records, and
    # a store they leave behind in the workspace ships with the app -- the
    # grader then starts from test debris instead of the seeded state (keep:
    # 15 requirements passed their own checks, 6/32 at grading).
    app = Path(tempfile.mkdtemp(prefix="arc-app-"))
    for part in ("frontend", "backend"):
        if (out / part).is_dir():
            shutil.copytree(out / part, app / part, ignore=shutil.ignore_patterns("node_modules", "dist"))
    try:
        return run_app(app, out, env, tests, port, specs)
    finally:
        shutil.rmtree(app, ignore_errors=True)


def run_specs(app: Path, work: Path, root: Path, pw: str, env: dict,
              run_env: dict, port: int) -> tuple[int, str]:
    """Run the specs one test at a time, restoring the seeded data and
    rebooting the app between them, so a stateful pair scores what the app
    does rather than what an earlier scenario left behind. Falls back to one
    whole-suite run when the tests cannot be enumerated."""
    cfg = str(work / "playwright.config.ts")
    cap = int(os.environ.get("OCTOS_ARC_PLAYWRIGHT_TIMEOUT", "600"))
    one = lambda *args: sh([pw, "test", "-c", cfg, *args], work, run_env, cap)  # noqa: E731

    def boot():
        srv = subprocess.Popen("npm run start", cwd=app / "backend", env=dict(env, PORT=str(port)),
                               shell=True, stdout=(work / ".arc-server.log").open("w"),
                               stderr=subprocess.STDOUT, text=True, preexec_fn=os.setsid)
        for _ in range(60):
            if not free(port) or srv.poll() is not None:
                break
            time.sleep(0.5)
        return srv

    seed = state_snapshot(app)
    rc, listing = one("--list")
    ids = spec_ids(listing)
    # NO whole-suite bail for big suites at CHECK time: with regression specs
    # riding every node, the count crosses any small threshold early, and one
    # shared boot makes the official stateful pairs fail each other (S1
    # renames the workbook, S2 expects the original name) -- the run then
    # never passes a check again and .arc-good freezes on an early state (two
    # platform runs shipped 6/100 that way). Oversized suites are bounded by
    # the wall budget below, which finishes the remainder in one boot.
    if not ids:                                   # enumerate failed: run whole
        srv = boot()
        try:
            rc, log = one()
        finally:
            stop(srv)
        if rc and NO_BROWSER in log and install_browser(pw, root, run_env):
            rc, log = one()
        counts = re.findall(r"(\d+) passed", log)
        _write_score(f"{counts[-1] if counts else 0}p")
        return rc, log
    # Per-test boots multiply: a wall budget keeps the loop inside the node's
    # own timeout (the class of wedge the >20 cutoff already guards against).
    deadline = time.time() + float(os.environ.get("OCTOS_ARC_SPECS_BUDGET_MS", "900000")) / 1000.0
    install_tried = False
    rc, logs, passed = 0, [], 0
    i = 0
    while i < len(ids):
        tid = ids[i]
        for path, data in seed.items():
            path.write_bytes(data)
        drop_unseeded_stores(app, seed)
        srv = boot()
        try:
            if free(port):
                trc, tlog = 1, f"[verify] backend never bound port {port}; scenario {tid} unscored"
            else:
                trc, tlog = one(tid)
        finally:
            stop(srv)
        if trc and not install_tried and NO_BROWSER in tlog and install_browser(pw, root, run_env):
            # The whole-run path retries the install; the per-test path must
            # too, or a wiped cache burns the node with STOP: no browser.
            install_tried = True
            rc, logs, passed = 0, [], 0
            continue
        rc = rc or trc
        logs.append(tlog)
        counts = re.findall(r"(\d+) passed", tlog)
        passed += int(counts[-1]) if counts else 0
        i += 1
        if time.time() > deadline and i < len(ids):
            for path, data in seed.items():
                path.write_bytes(data)
            logs.append(f"[verify] per-test budget spent after {i}/{len(ids)} scenarios; "
                        "the rest share one boot")
            srv = boot()
            try:
                if free(port):
                    trc, tlog = 1, "[verify] backend never bound port for the shared boot"
                else:
                    trc, tlog = one(*ids[i:])
            finally:
                stop(srv)
            rc = rc or trc
            logs.append(tlog)
            break
    log = "\n".join(logs) + f"\n[verify] {passed} passed of {len(ids)} scenario(s), each from the seeded state"
    _write_score(f"{passed}/{len(ids)}")
    return rc, log


def js_syntax_errors(dist: Path, env: dict | None = None) -> list[str]:
    """node --check every built script: an unbalanced brace from a repair edit
    makes the whole file fail to parse, so the static shell renders while all
    dynamic behaviour dies -- Playwright then reports an empty list, a symptom
    far from the cause. This names file and line of the SyntaxError itself.
    Mode is chosen by content: node --check on an import/export-bearing .js
    silently returns success without checking (v22 verified: import + a
    broken brace -> rc 0), so those files are judged through an .mjs copy;
    plain scripts by the direct check. The node binary comes from the run's
    own PATH: a stale system node would reject modern syntax the browser
    accepts."""
    dist = dist.resolve()
    env = dict(env or os.environ)
    node = shutil.which("node", path=env.get("PATH")) or "node"
    errs = []
    for js in sorted(dist.rglob("*.js")) if dist.is_dir() else []:
        content = js.read_bytes()
        is_module = re.search(rb"^\s*(import|export)\s", content, re.M)
        if is_module:
            with tempfile.TemporaryDirectory(prefix="arc-modcheck-") as td:
                mjs = Path(td) / (js.stem + ".mjs")
                mjs.write_bytes(content)
                rc, log = sh([node, "--check", str(mjs)], Path(td), env, 30)
        else:
            rc, log = sh([node, "--check", str(js)], dist, env, 30)
        if not rc:
            continue
        where = re.search(r"^.*SyntaxError.*$", log, re.M)
        line = (re.search(rf"{re.escape(js.name)}:(\d+)", log)
                or re.search(rf"{re.escape(js.stem)}\.mjs:(\d+)", log))
        at = f"{js.relative_to(dist)}:{line.group(1)}" if line else js.relative_to(dist)
        errs.append(f"{at}: {(where.group(0).strip() if where else '') or 'syntax error'}")
    return errs


def run_app(app: Path, out: Path, env: dict, tests: Path, port: int, specs: list[str]) -> int:
    for cwd, step in ((app / "frontend", f"{INSTALL} && npm run build"), (app / "backend", INSTALL)):
        rc, log = sh(step, cwd, env, 240)
        if rc:
            print(f"[verify] {cwd.name}: {step!r} failed\n{log[-1500:]}")
            return 1
    broken = js_syntax_errors(app / "frontend" / "dist", env)
    if broken:
        print("[verify] the built app has scripts that do not parse; every dynamic "
              f"behaviour is dead while the markup still renders: {'; '.join(broken)}\n"
              "Fix the named syntax error(s) -- do not rewrite the file around them.")
        return 1
    if not free(port):
        print(f"[verify] port {port} already serving; refusing to score another process")
        return 1
    root, pw_env = playwright_root(env) if specs else (None, {})
    if specs and root is None:
        # Nothing the model can fix: stop, do not spend repair rounds on it.
        print(f"[verify] Playwright unavailable; cannot run the acceptance specs\n{STOP}: no test runner")
        return 1

    server_log = out / ".arc-server.log"      # a file, not a pipe: a chatty server never blocks
    srv = subprocess.Popen("npm run start", cwd=app / "backend", env=dict(env, PORT=str(port)),
                           shell=True, stdout=server_log.open("w"), stderr=subprocess.STDOUT,
                           text=True, preexec_fn=os.setsid)
    try:
        for _ in range(60):
            if not free(port) or srv.poll() is not None:
                break
            time.sleep(0.5)
        if free(port):
            stop(srv)
            print(f"[verify] backend never bound port {port}\n{server_log.read_text(errors='replace')[-1500:]}")
            return 1
        holes = asset_holes(app / "frontend" / "dist", port) + [
            f"'{n}' is both a link and a button" for n in name_twins(app / "frontend" / "dist")]
        if holes:
            stop(srv)
            print(f"[verify] dead controls or missing assets: {'; '.join(holes)}\n"
                  "Serve every file the built HTML references and give each named action exactly one element.")
            return 1
        if not specs:
            # No public example for this requirement: the app must still build,
            # boot and serve its home page.
            import urllib.request
            try:
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                code = opener.open(f"http://127.0.0.1:{port}/", timeout=30).status
            except Exception as exc:  # noqa: BLE001 -- any failure is the verdict
                code = exc
            print(f"[verify] no public spec; GET / -> {code}")
            return 0 if code == 200 else 1
        # Specs `import '@playwright/test'` and Node resolves that upward from
        # the spec, so the copy sits under the install when it is writable
        # (NODE_PATH covers the temp-dir fallback).
        work = root / ".octos-acceptance" / "run"
        scratch = None
        try:
            if work.exists():
                shutil.rmtree(work)
            (work / "tests").mkdir(parents=True)
        except OSError:
            scratch = Path(tempfile.mkdtemp(prefix="arc-verify-"))
            work = scratch / "run"                # cleaned in the finally below
            (work / "tests").mkdir(parents=True)
        # The node's specs plus the helpers they import (support/*.ts), at the
        # same relative paths so `../support/e2e` still resolves.
        helpers = [p.relative_to(tests) for p in tests.rglob("*")
                   if p.is_file() and "node_modules" not in p.parts and not p.name.endswith(".spec.ts")
                   and p.suffix in (".ts", ".js", ".mjs", ".cjs", ".json")]
        for rel in [*specs, *helpers]:
            if (tests / rel).is_file():
                (work / "tests" / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(tests / rel, work / "tests" / rel)
        # The per-test clock rides OCTOS_ARC_TEST_TIMEOUT_MS (the 40s the
        # helper-driven official specs need; grading itself uses the same).
        (work / "playwright.config.ts").write_text(
            "import { defineConfig } from '@playwright/test';\n"
            "export default defineConfig({ testDir: './tests', outputDir: './test-results', timeout: %s, retries: 0, workers: 4, "
            "reporter: [['list']], use: { headless: true, baseURL: process.env.E2E_BASE_URL } });\n"
            % os.environ.get("OCTOS_ARC_TEST_TIMEOUT_MS", "10000"))
        pw = str(root / "node_modules" / ".bin" / "playwright")
        run_env = dict(env, E2E_BASE_URL=f"http://127.0.0.1:{port}", CI="1",
                       NODE_PATH=str(root / "node_modules"), **pw_env)
        stop(srv)                      # each isolated test boots its own
        rc, log = run_specs(app, work, root, pw, env, run_env, port)
    finally:
        stop(srv)
        if scratch:                    # the mkdtemp fallback never self-cleans
            shutil.rmtree(scratch, ignore_errors=True)
    if rc and NO_BROWSER in log:
        # The runner has no browser and none could be installed: nothing the
        # model can fix, so do not spend repair rounds on it.
        print(f"[verify] Playwright has no browser to run the specs\n{log[-800:]}\n{STOP}: no browser")
        return 1
    # Playwright's exit code IS the verdict and its list reporter already names
    # every failing assertion; print that verbatim for the repair round.
    print(log[-6000:])
    counts = re.findall(r"(\d+) passed", log)
    PASSED["count"] = int(counts[-1]) if counts else 0
    if rc:
        # What the page actually showed when each test failed (Playwright's
        # ARIA snapshot): the difference between "not found" and why.
        for ctx in sorted((work / "test-results").rglob("error-context.md"))[:3]:
            page = ctx.read_text(errors="replace").partition("```yaml")[2].split("```")[0]
            if page.strip():
                print(f"\n----- page at failure: {ctx.parent.name} -----\n{page.strip()[:1500]}")
    return rc


def inventory(out: Path) -> str:
    """The app's source files with line counts. This output is the next
    implement node's input, so it starts oriented instead of spending its
    first turns on list_dir/glob."""
    rows = []
    for part in ("frontend", "backend"):
        for f in sorted((out / part).rglob("*")) if (out / part).is_dir() else []:
            rel = f.relative_to(out)
            if f.is_file() and not {"node_modules", "dist"} & set(rel.parts) and f.stat().st_size < 1_000_000:
                rows.append(f"{rel} ({len(f.read_bytes().splitlines())} lines)")
    return "Workspace files: " + ", ".join(rows[:80])


def snapshot(out: Path, dest: Path) -> None:
    shutil.rmtree(dest, ignore_errors=True)
    for part in ("frontend", "backend"):
        if (out / part).is_dir():
            shutil.copytree(out / part, dest / part, ignore=shutil.ignore_patterns("node_modules", "dist"))


def keep_best(out: Path, rc: int) -> None:
    """Snapshot the app when this full-suite check passed more tests than any
    before it. A repair that breaks more than it fixes, or a run cut off in
    the middle of one, must not ship: the adapter delivers the snapshot."""
    best = out / ".arc-best"
    score = best / "score.json"
    try:
        prev = json.loads(score.read_text())["passed"] if score.is_file() else -1
    except (OSError, ValueError, KeyError, TypeError):   # truncated by a kill: re-keep
        prev = -1
    if PASSED["count"] <= prev:
        return
    snapshot(out, best / "app")
    score.write_text(json.dumps({"passed": PASSED["count"], "rc": rc}))
    print(f"[verify] best full-suite state so far: {PASSED['count']} passed (kept)")


def _write_score(text: str) -> None:
    """The run's scenario score, as a file note_attempt() can diff between
    repair rounds. Written only when the specs actually ran this attempt;
    every other failure path (build, syntax, port) leaves yesterday's file
    gone -- main() unlinks it before each check -- so a non-spec failure
    never masquerades as `no movement`."""
    (Path.cwd() / ".arc-score").write_text(text, encoding="utf-8")


def quarantined(tag: str) -> bool:
    """Signal-only tag (OCTOS_ARC_QUARANTINE, comma-separated): its check
    still runs and reports, but a failure prints STOP directly -- no repair
    back-edge fires, no attempt budget burns. For requirements proven
    structurally unsatisfiable in one static seed world; the list ships
    empty unless a local run proves a family hopeless."""
    return tag in {t.strip() for t in os.environ.get("OCTOS_ARC_QUARANTINE", "").split(",")
                   if t.strip()}


def note_attempt(tag: str, opts: dict) -> tuple[int, str | None]:
    """Count this FAILED attempt for `tag`; return (attempt, stop reason or
    None). The flat caps (attempts/deadline/repair-window) bound the ladder;
    the signature rule cuts the waste they cannot see: a repair round that
    leaves the scenario score unchanged moved nothing, and two of those in a
    row mean the model is rewriting the same file into the same hole. Those
    stalls were the biggest token sink of the 12h platform runs (a hopeless
    requirement burned its full implement re-execution round, ~¥2 of tokens,
    for nothing). The legacy orchestrator's stall_limit=2, ported into the
    verifier."""
    counter = Path.cwd() / ".arc-attempts" / tag
    counter.parent.mkdir(exist_ok=True)
    attempts = int(counter.read_text() or 0) + 1 if counter.is_file() else 1
    counter.write_text(str(attempts))
    first = counter.with_suffix(".first")          # when this requirement first failed
    if not first.is_file():
        first.write_text(str(time.time()))
    sig_file = Path.cwd() / ".arc-score"
    sig = sig_file.read_text().strip() if sig_file.is_file() else ""
    stall = counter.with_suffix(".stall")
    try:
        prior = json.loads(stall.read_text()) if stall.is_file() else {}
    except ValueError:                              # truncated by a kill: start over
        prior = {}
    stalls = prior.get("n", 0) + 1 if sig and sig == prior.get("sig") else 0
    stall.write_text(json.dumps({"sig": sig, "n": stalls}))
    if attempts >= int(opts.get("attempts", 6)):
        return attempts, f"attempt {attempts}"
    if time.time() >= float(opts.get("deadline", "inf")):
        return attempts, "run deadline"
    if time.time() - float(first.read_text()) >= float(opts.get("repair-window", "inf")):
        return attempts, "repair window spent"
    if stalls >= 2:
        return attempts, f"{stalls} repair rounds moved nothing"
    return attempts, None


def main(argv: list[str]) -> int:
    if argv[:1] == ["--seed"]:
        return seed(Path(argv[1]))
    opts, specs, it = {}, [], iter(argv[2:])
    for arg in it:
        if arg.startswith("--"):
            opts[arg[2:]] = next(it)
        else:
            specs.append(arg)
    if "regress" in opts:
        # Regression checkpoint + SEED CANARY: also re-run the specs of
        # earlier requirements whose last verdict was a pass, and always the
        # FIRST requirement's spec. A mid-run node can rewrite the global
        # seed to its own requirement's example; its self-consistent spec
        # then passes and the poisoned .arc-good ships (arch-13 graded
        # 6/100 that way). The first requirement's spec is the seed
        # contract's canary -- it must hold at every check.
        status = Path.cwd() / ".arc-status"
        mapping = json.loads(Path(opts["regress"]).read_text())
        earlier = [rel for tag, rels in mapping.items()
                   if tag != opts.get("tag") and (status / tag).is_file()
                   and (status / tag).read_text().strip() == "0" for rel in rels]
        # One canary per TOP-LEVEL family -- but a family EARNS its tripwire
        # only once this run has passed one of its checks: on a cold run the
        # REQ-5 canary tests features no node has built yet, and a canary of
        # an inherited-broken bootstrap family fails every check forever --
        # both freeze .arc-good on the seed state (two runs graded 6/100
        # that way). Sorted tags keep REQ-1-1-1 first once earned.
        passed = {t for t in mapping
                  if (status / t).is_file() and (status / t).read_text().strip() == "0"}
        if passed:
            families = {}
            for tag in sorted(mapping):
                m = re.match(r"^(REQ-\d+)", tag)
                families.setdefault(m.group(1) if m else tag, []).append(tag)
            for fam, tags in families.items():
                if any(t in passed for t in tags):
                    ride = next((t for t in tags if t != opts.get("tag") and mapping[t]), None)
                    if ride:
                        earlier.append(mapping[ride][0])
        extra = [rel for rel in dict.fromkeys(earlier) if rel not in specs]
        if extra:
            print(f"[verify] regression checkpoint (+seed canary): also re-running "
                  f"{len(extra)} spec(s) of earlier requirements; a failure there is a "
                  "regression to fix now")
            specs = [*specs, *extra]
    (Path.cwd() / ".arc-score").unlink(missing_ok=True)   # stale score == no signature
    rc = check(Path(argv[0]).resolve(), int(argv[1]), specs)
    if "best" in opts:
        keep_best(Path.cwd(), rc)
    if rc == 0 and "tag" in opts:
        # Latest state a check passed: the adapter copies it into the output
        # dir as the run goes, so a run killed from outside still delivers.
        snapshot(Path.cwd(), Path.cwd() / ".arc-good" / "app")
        (Path.cwd() / ".arc-good" / "stamp").write_text(str(time.time()))
    print(inventory(Path.cwd()))
    if "tag" in opts:                           # the adapter reads the last verdict
        (Path.cwd() / ".arc-status").mkdir(exist_ok=True)
        (Path.cwd() / ".arc-status" / opts["tag"]).write_text(str(rc))
    if rc and "tag" in opts:
        if quarantined(opts["tag"]):
            print(f"{STOP}: {opts['tag']} is quarantined (signal-only; "
                  "failures here never trigger a repair round)")
        else:
            attempts, why = note_attempt(opts["tag"], opts)
            if why:
                print(f"{STOP}: {why} for {opts['tag']}; moving on")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
