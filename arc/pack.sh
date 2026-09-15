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
zip -qr ../octos-arc-bundle.zip main.py rust_engine.py arc-policy.toml prompts octos_stdio.py requirement_order.py acceptance.py action_errors.cjs guard.py llm_proxy.py codegen.py hooks requirements.txt arcbench_agent_runtime public-tests -x '*/__pycache__/*' '*.pyc'
if [ -n "$ROUTES" ]; then
    python3 -c 'import sys; from zipfile import ZipFile; z=ZipFile("../octos-arc-bundle.zip", "a"); z.write(sys.argv[1], "model-routes.json"); z.close()' "$ROUTES"
fi
echo "打包完成：$(cd .. && pwd)/octos-arc-bundle.zip"
shasum -a 256 ../octos-arc-bundle.zip
