#!/usr/bin/env python3
"""Doc-world grader: grade an artifact the way the platform's hidden tests
presumably do -- every requirement family is graded inside the world its
requirements.yaml GIVEN pins, re-seeded before every single test.

The doc's family GIVENs are mutually exclusive for the same workbook name
(`Q3 Sales` holds the Region table for REQ-1/2/5, the Item/Qty range for
REQ-3, and 2/3+formulas for REQ-4; A1 alone has three pinned values), so
per-scenario re-seeding is the only self-consistent reading of the doc.
This grader emulates that: before each test it writes the family's world
into backend/store.json and reboots the app, so a test scores what the app
does inside its GIVEN world, never what an earlier test left behind.

usage: grade-docworld.py <output_dir> <requirement_id> [port]
"""
import json, os, re, shutil, signal, socket, subprocess, sys, time
from pathlib import Path

APP_INSTALL = "npm install --no-audit --no-fund --no-package-lock"

# Worlds transcribed from the GIVEN sentence of each requirements.yaml family.
# default: REQ-5-1-1 pins the full A1:C6 table (headers Region/Sales/Status,
# East/1200/Open, North/800/Closed, South/700/Open); REQ-1 names its A1
# subset; REQ-2 adds the empty Sheet2 its GIVEN names.
DEFAULT_WORLD = {"Q3 Sales": {
    "Sheet1": {"0,0": "Region", "0,1": "Sales", "0,2": "Status",
               "1,0": "East", "1,1": "1200", "1,2": "Open",
               "2,0": "North", "2,1": "800", "2,2": "Closed",
               "3,0": "South", "3,1": "700", "3,2": "Open"},
    "Sheet2": {},
}}
# REQ-3 GIVEN: "the seeded workbook `Q3 Sales`, range `A1:B2` containing
# `Item/Qty` and `Pen/4`, and target range `D1:E2`."
REQ3_WORLD = {"Q3 Sales": {"Sheet1": {
    "0,0": "Item", "0,1": "Qty", "1,0": "Pen", "1,1": "4"}}}
# REQ-4 GIVEN: "the seeded workbook `Q3 Sales`, cells `A1=2`, `B1=3`, and
# formulas `=A1+B1` and `=C1*2`." (=C1*2 must reference a formula cell, so
# =A1+B1 sits in C1 and =C1*2 in D1.)
REQ4_WORLD = {"Q3 Sales": {"Sheet1": {
    "0,0": "2", "0,1": "3", "0,2": "=A1+B1", "0,3": "=C1*2"}}}
WORLDS = {"REQ-3": REQ3_WORLD, "REQ-4": REQ4_WORLD}


def world_store(family: str) -> dict:
    sheets = WORLDS.get(family, DEFAULT_WORLD)
    now = "2026-01-01T00:00:00.000Z"
    return {"workbooks": {name: {"name": name, "lastUpdated": now,
                                 "activeSheet": "Sheet1",
                                 "sheets": {s: {"cells": cells} for s, cells in sheets.items()}}
                          for name, sheets in sheets.items()}}


def family_of(spec_id: str) -> str:
    m = re.match(r"(REQ-\d+)", Path(spec_id).name)
    return m.group(1) if m else ""


def port_is_free(port: int) -> bool:
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) != 0


def stop_server(proc) -> None:
    if proc is None or proc.poll() is not None:
        return
    for attempt in (lambda: os.killpg(os.getpgid(proc.pid), signal.SIGTERM), proc.terminate, proc.kill):
        try:
            attempt()
            proc.wait(timeout=10)
            return
        except (OSError, subprocess.TimeoutExpired):
            continue


def main(argv: list[str]) -> int:
    out = Path(argv[0]).resolve(); req = argv[1]; port = int(argv[2]) if len(argv) > 2 else 43300
    root = Path(__file__).resolve().parent
    req_path = Path(req)
    if req_path.is_absolute() and req_path.is_dir():
        req, specs = req_path.name + "-proxy", req_path
    else:
        specs = root / "public-tests" / req
    grader = root / "local-grader"
    env = os.environ.copy(); env["PATH"] = os.environ.get("NODE_BIN", "") + ":" + env["PATH"]
    if not (grader / "node_modules" / "@playwright").exists():
        grader.mkdir(exist_ok=True)
        subprocess.run("npm init -y >/dev/null && npm install --no-audit --no-fund @playwright/test && npx playwright install chromium", cwd=grader, env=env, shell=True, check=True)
    if not specs.is_dir():
        print(f"[grade] no public specs for {req} at {specs}"); return 4
    if not port_is_free(port):
        print(f"[grade] port {port} is already serving; free it or pass another port"); return 5

    def sh(cmd, cwd, **kw):
        r = subprocess.run(cmd, cwd=cwd, env=env, shell=True, capture_output=True, text=True, **kw)
        return r.returncode, (r.stdout + r.stderr)[-1500:]

    for cwd, step in ((out / "frontend", f"{APP_INSTALL} && npm run build"), (out / "backend", APP_INSTALL)):
        rc, log = sh(step, cwd)
        print(f"[grade] {cwd.name}: {step!r} -> {rc}")
        if rc: print(log); return 2
    benv = dict(env, PORT=str(port))

    def boot():
        srv = subprocess.Popen("npm run start", cwd=out / "backend", env=benv, shell=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, preexec_fn=os.setsid)
        for _ in range(60):
            if not port_is_free(port) or srv.poll() is not None:
                break
            time.sleep(0.5)
        return srv

    work = grader / "run" / f"docworld-{req}-{out.name}"
    if work.exists(): shutil.rmtree(work)
    shutil.copytree(specs, work / "tests")
    (work / "playwright.config.ts").write_text(
        "import { defineConfig } from '@playwright/test';\n"
        "export default defineConfig({ testDir: './tests', timeout: %s, retries: 0, workers: 1, reporter: [['json', { outputFile: 'report.json' }], ['line']], use: { headless: true, baseURL: process.env.E2E_BASE_URL } });\n"
        % os.environ.get("ARC_GRADE_TIMEOUT_MS", "10000"))
    tenv = dict(env, E2E_BASE_URL=f"http://127.0.0.1:{port}")
    store_file = out / "backend" / "store.json"
    t0 = time.time()

    def run_pw(*args):
        return subprocess.run(["npx", "playwright", "test", "-c", str(cfg), *args],
                              cwd=grader, env=tenv, capture_output=True, text=True)

    cfg = work / "playwright.config.ts"
    res = []

    def collect():
        rep = json.loads((work / "report.json").read_text()) if (work / "report.json").exists() else {}

        def walk(suites):
            for s in suites:
                for sp in s.get("specs", []):
                    yield sp["title"], all(t.get("status") == "expected" or t.get("ok")
                                           for t in sp.get("tests", []))
                yield from walk(s.get("suites", []))
        res.extend(walk(rep.get("suites", [])))

    last = None
    listing = run_pw("--list")
    ids = []
    for ln in (listing.stdout + listing.stderr).splitlines():
        m = re.search(r"(\S+\.spec\.ts:\d+):\d+", ln)
        if m and m.group(1) not in ids:
            ids.append(m.group(1))
    if not ids:
        print("[grade] could not enumerate tests"); return 4
    for tid in ids:
        store_file.write_text(json.dumps(world_store(family_of(tid)), indent=1))
        s = boot()
        try:
            if port_is_free(port):
                print(f"[grade] backend never bound {port}; {tid} unscored")
                continue
            last = run_pw(tid)
        finally:
            stop_server(s)
        collect()
    passed = sum(1 for _, ok in res if ok)
    for title, ok in res: print(f"  {'PASS' if ok else 'FAIL'}  {title}")
    print(f"[grade] {req}: {passed}/{len(res)} passed in {time.time()-t0:.0f}s  score={100*passed/len(res) if res else 0:.0f}")
    (out / ".arc").mkdir(exist_ok=True)
    (out / ".arc" / "docworld-grade.json").write_text(json.dumps({"requirement": req, "passed": passed, "total": len(res),
        "tests": [{"title": t, "ok": ok} for t, ok in res]}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
