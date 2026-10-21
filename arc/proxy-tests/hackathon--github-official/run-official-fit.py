#!/usr/bin/env python3
"""Official-fit calibration runner: overlay the official seed names onto a fresh
copy of the artifact store, boot once, run the mirror suite in one shared
session (the sheet-evidence grading semantics), report per-test verdicts."""
import json, os, shutil, socket, subprocess, sys, time, signal
from pathlib import Path

HERE = Path(__file__).resolve().parent
GRADER = Path("/home/kikun/MyProject/octos-arc/arc/local-grader")
ARTIFACT = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/kikun/MyProject/octos-arc/docs/arc-journey/artifacts/output/t1-github/template")
PORT = int(sys.argv[2] if len(sys.argv) > 2 else 44200)
NPX = os.path.expanduser("~/.nvm/versions/node/v22.21.1/bin/npx")

work = GRADER / "run" / "official-fit"
if work.exists(): shutil.rmtree(work)
work.mkdir(parents=True)
shutil.copytree(HERE, work / "tests", ignore=shutil.ignore_patterns("run-official-fit.py", "__pycache__"))
for junk in (work / "tests" / "overlay.json",): junk.unlink(missing_ok=True)
(work / "pw.config.ts").write_text(
    "import { defineConfig } from '@playwright/test';\n"
    "export default defineConfig({ testDir: './tests', timeout: 10000, retries: 0, "
    f"workers: {os.environ.get('FIT_WORKERS', '1')}, reporter: [['json', {{ outputFile: 'report.json' }}], ['line']], "
    "use: { headless: true, baseURL: process.env.E2E_BASE_URL } });\n")

out = Path("/tmp/gh-official")
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(ARTIFACT, out)
store_path = out / "backend" / "store.json"
store = json.loads(store_path.read_text())
ov = json.loads((HERE / os.environ.get("FIT_OVERLAY", "overlay.json")).read_text())
store.setdefault("accounts", {}).update(ov["accounts"])
patch = ov["__org_patch"]
org = store["organizations"][patch["org"]]
for u in patch.get("owners_add", []):
    if u not in org.setdefault("owners", []): org["owners"].append(u)
for u in patch.get("members_add", []):
    if u not in org.setdefault("members", []): org["members"].append(u)
store_path.write_text(json.dumps(store))
print(f"[fit] overlay={os.environ.get('FIT_OVERLAY', 'overlay.json')}: accounts={sorted(ov['accounts'])}, owners={org['owners']}")

env = dict(os.environ, E2E_BASE_URL=f"http://127.0.0.1:{PORT}", PORT=str(PORT))
def free(p):
    with socket.socket() as s: return s.connect_ex(("127.0.0.1", p)) != 0
srv = subprocess.Popen("npm run start", cwd=out / "backend", env=env, shell=True,
                       preexec_fn=os.setsid, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(90):
    if not free(PORT) or srv.poll() is not None: break
    time.sleep(0.5)
try:
    if free(PORT):
        sys.exit("[fit] backend never bound")
    r = subprocess.run([NPX, "playwright", "test", "-c", "pw.config.ts"],
                       cwd=work, env=env, capture_output=True, text=True, timeout=560)
    rep = json.loads((work / "report.json").read_text()) if (work / "report.json").exists() else {}
    verdicts = {}
    def walk(suites):
        for s in suites:
            for sp in s.get("specs", []):
                ok = all(t.get("status") == "expected" or t.get("ok") for t in sp.get("tests", []))
                verdicts[sp["title"]] = "PASS" if ok else "FAIL"
            walk(s.get("suites", []))
    walk(rep.get("suites", []))
    for t, v in verdicts.items(): print(f"  {v}  {t}")
    p = sum(1 for v in verdicts.values() if v == "PASS")
    print(f"[fit] {p}/{len(verdicts)} passed (workers={os.environ.get('FIT_WORKERS','1')})")
    sys.exit(0)
finally:
    try: os.killpg(os.getpgid(srv.pid), signal.SIGTERM)
    except Exception: pass
