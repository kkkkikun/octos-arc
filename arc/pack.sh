#!/bin/sh
# 把 arc/ 打成 ARC 平台要的提交包（main.py 必须在 zip 根目录）
set -e
# Optional first argument is deployment policy, not generated app content.
ROUTES=""
if [ "$#" -gt 0 ]; then
    ROUTES="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$1")"
fi
cd "$(dirname "$0")"
if [ -n "$ROUTES" ]; then
    python3 -c 'import sys; from pathlib import Path; from llm_proxy import model_routes; model_routes(Path(sys.argv[1]).read_text())' "$ROUTES"
fi
rm -f ../octos-arc-bundle.zip
# public-tests/ is deliberately NOT shipped. The runner mounts the public specs at
# /workspace/tests, which locate_acceptance_tests() prefers anyway: across 13 completed
# cloud runs (smoke, smoke-evolution, ticket-booking, arc-bench-web, 2026-09-17) every
# single one logged "[tests] N spec files at /workspace/tests" and none ever reached the
# bundled copy. Shipping it would only put a per-task, task-title-keyed set of spec files
# in the submission -- dead weight in the cloud, and indistinguishable from pre-loading
# task data for anyone auditing the bundle. Local runs are unaffected: run-task-local.py
# resolves BUNDLE_DIR to arc/ and reads arc/public-tests straight from the repo.
zip -qr ../octos-arc-bundle.zip main.py rust_engine.py arc-policy.toml prompts octos_stdio.py requirement_order.py acceptance.py verify_app.py action_errors.cjs page_errors.ts guard.py llm_proxy.py codegen.py aria_lint.py hooks requirements.txt arcbench_agent_runtime -x '*/__pycache__/*' '*.pyc'
if [ -n "$ROUTES" ]; then
    python3 -c 'import sys; from zipfile import ZipFile; z=ZipFile("../octos-arc-bundle.zip", "a"); z.write(sys.argv[1], "model-routes.json"); z.close()' "$ROUTES"
fi
echo "打包完成：$(cd .. && pwd)/octos-arc-bundle.zip"
shasum -a 256 ../octos-arc-bundle.zip
