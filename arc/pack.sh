#!/bin/sh
# Build the ARC platform submission bundle out of arc/.
#
# Platform contract: main.py and requirements.txt must sit at the zip root, and
# so must template/ (frontend + backend + README.md + template.yaml) -- the
# platform lays template/ out as the initial workspace and hands it to main.py
# via ARCBENCH_TEMPLATE_DIR. A bundle without a complete template/ was observed
# being rejected as "web template is incomplete" (2026-09-20).
#
# The bundle is staged in a temp dir and zipped from there, never from the
# worktree: what lands in the zip is exactly the explicit copy list below.
# Stale worktree artifacts cannot leak in, and dev files are excluded by
# construction rather than by zip patterns.
#
# Deliberately NOT shipped:
#   * tasks/ -- platform task DATA; the runner hands main.py the requirement.
#     public-tests/ DOES ship (2026-09-27, upstream #246): the runner no
#     longer mounts the public specs (all six of upstream's official runs
#     logged `tests at None`), and the shipped specs are the platform's own
#     public practice material. main.py still prefers a runner mount.
#   * local-only instruments: path_split.py, postmortem.py, scoreboard.py,
#     metrics.py, integration/, action_errors.cjs, page_errors.ts,
#     grade-local.py, run-task-local.py, tests/. They analyse runs on a
#     developer machine and have no job inside the container.
#   * arcbench_agent_runtime/ -- a vendored copy of the `arcbench-runtime` pip
#     package that requirements.txt already declares (verified byte-identical).
#     The platform installs requirements.txt, so shipping it is dead weight
#     that can only drift from the real package.
#
# There is no static pipeline .dot to copy: the pipeline's nodes ARE this task's
# requirement nodes, so main.py emits <data_dir>/pipelines/arc_build.dot per run
# from the requirement tree plus prompts/pipeline-implement.md. The definition
# that ships is that generator + its prompt template + arc-policy.toml.
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
PKG="$STAGE/octos-arc-bundle"
mkdir -p "$PKG"

# Runtime: the glue, the stdio driver, the acceptance command, the policy.
cp main.py octos_stdio.py verify_node.py arc-policy.toml requirements.txt aria_lint.py "$PKG/"
cp -R prompts "$PKG/prompts"
cp -R template "$PKG/template"
cp -R public-tests "$PKG/public-tests"

# BOOTSTRAP_DIR (optional): overlay a previous run's delivered frontend/ and
# backend/ onto the template (keep its README.md + template.yaml) so the next
# run starts from that verified state instead of the bare scaffold. The local
# runs' progressive delivery produces exactly this shape; the repo template/
# stays pristine for bundles that must start cold (e.g. github).
if [ -n "${BOOTSTRAP_DIR:-}" ]; then
    for part in frontend backend; do
        [ -d "$BOOTSTRAP_DIR/$part" ] || { echo "pack: BOOTSTRAP_DIR lacks $part" >&2; exit 1; }
        rm -rf "$PKG/template/$part"
        cp -R "$BOOTSTRAP_DIR/$part" "$PKG/template/$part"
        rm -rf "$PKG/template/$part/node_modules" "$PKG/template/$part/dist"
    done
    # The generic component library is scaffold, not artifact: an artifact
    # grown before the library does not carry it, and the wholesale overlay
    # above would otherwise delete it out of the template.
    mkdir -p "$PKG/template/frontend/src"
    cp -R template/frontend/src/lib "$PKG/template/frontend/src/lib"
    echo "自举模板：$BOOTSTRAP_DIR 覆盖 frontend+backend（lib/ 保底回填）"
fi

find "$PKG" -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null || true
find "$PKG" \( -name '*.pyc' -o -name .DS_Store \) -delete

# Fail loudly rather than shipping a bundle that breaks the platform contract
# or silently re-introduces the local proxy / bespoke acceptance runner.
for required in main.py requirements.txt template; do
    [ -e "$PKG/$required" ] || { echo "pack: missing $required at the bundle root" >&2; exit 1; }
done
for banned in llm_proxy.py acceptance.py rust_engine.py verify_app.py path_split.py \
              postmortem.py scoreboard.py metrics.py integration action_errors.cjs \
              page_errors.ts tasks tests arcbench_agent_runtime; do
    [ ! -e "$PKG/$banned" ] || { echo "pack: $banned must not be in the bundle" >&2; exit 1; }
done
# 800 with the runtime fetch inlined; the container has no octos of its own and
# ours must come from the release, so the fetch (main.py OCTOS_RELEASE_URL)
# counts against the budget rather than being trimmed away. 1100 since the
# acceptance command bounds its own repairs and steps (verify_node.py) and the
# graph grew a seed node and a regression pass -- still glue, not a loop.
# 1200 once the timeouts, output caps and reasoning controls the profile
# runtime ignores in config.json moved onto the graph and the env (#230).
# 1300 for progressive delivery: verified states reach the output dir during
# the run, so a run killed from outside still ships working code.
# 1750: +P6/P7 per-item naming extraction (R2) -- still pure requirement-
# synthesis that fills the no-public-tests vacuum -- glue, not a loop.
# 1900: +R3 dialog revival / header name forms / selection state (P8/P9/K3)
# -- same class of requirement synthesis, no loop added. 1950 after pulling
# the octos-download curl args into a tested helper (_curl_args). 2000 for
# the upstream #246/#249 ports (bundled-spec lookup, dispatch re-ask).
# 2050: +asset-hole probe (second foundation-wound class, github leg shipped
# a page whitelist that 404'd /app.js) and the .arc-good collect fallback.
# 2100: +per-test isolation in the acceptance command (stateful spec pairs
# scored each other's debris; restore-seed + reboot between scenarios).
# 2150: isolation's file:line filter fix + dedupe. 2200: session-recycle
# for orphan turns (thinking-model dispatch timeouts). 2250: +js_syntax_errors
# probe (a repair edit's unbalanced brace kills the whole script while the
# static shell still renders; the check now names file:line of the SyntaxError
# instead of letting Playwright report the distant symptom).
# 2400: the full-sweep hardening (2026-09-29 audit) -- cross-run-dir collect,
# dispatch wall + protocol-error survival, per-test browser install + budget,
# store-file isolation, killpg teardown, staging swaps. All verdict/delivery
# guards, no loops.
# 2450: +the two spend guards of the ¥65 12h postmortem -- verify's stall rule
# (note_attempt: two repair rounds that leave the scenario score unchanged
# stop the node) and the adapter's fuel gauge (cost budget stop in the wait
# loop, glitch-guarded). A counter and a predicate, no loops.
LIMIT_PY=2450
PYLINES=$(find "$PKG" -name '*.py' -exec cat {} + | wc -l | tr -d ' ')
echo "打包内容：$(find "$PKG" -maxdepth 1 -mindepth 1 -printf '%f ' 2>/dev/null || ls "$PKG" | tr '\n' ' ')"
echo "包内 Python 行数：$PYLINES"
[ "$PYLINES" -le "$LIMIT_PY" ] || { echo "pack: bundle Python is $PYLINES lines (limit $LIMIT_PY)" >&2; exit 1; }

ZIP="$ROOT/../octos-arc-bundle.zip"
[ -n "${BOOTSTRAP_DIR:-}" ] && ZIP="$ROOT/../octos-arc-bundle-bootstrap.zip"
rm -f "$ZIP"
(cd "$PKG" && zip -qr "$ZIP" .)
echo "打包完成：$ZIP"
shasum -a 256 "$ZIP"
