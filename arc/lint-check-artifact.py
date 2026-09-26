#!/usr/bin/env python3
"""Quick gate: run the CURRENT lint synthesis against a FROZEN artifact.

usage: lint-check-artifact.py <artifact_dir> <task_name> [port]

Iteration accelerator (2026-09-26): an aria_lint change used to need a full
2-4 h container run before it produced any evidence. This gate synthesizes
the specs the orchestrator WOULD wire today and runs them against an app a
previous run already generated -- minutes, no agent, no LLM spend. It answers
"does the new contract set see this wound", not "will the agent repair it";
the container run stays the judge of the second question.

Delegates app build/start/teardown to grade-local.py by handing it the
synthesized spec directory through its direct tests-dir path.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ARC = Path(__file__).resolve().parent


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    artifact, task = Path(argv[0]).resolve(), argv[1]
    root = ARC.parent
    sys.path.insert(0, str(ARC))
    from aria_lint import extract_contracts, lint_spec_source

    tree = yaml.safe_load((root / "arc" / "tasks" / task / "requirements.yaml")
                          .read_text(encoding="utf-8"))
    contracts = extract_contracts(tree)
    with tempfile.TemporaryDirectory(prefix="lint-gate-") as tmp:
        spec_dir = Path(tmp) / "tests"
        spec_dir.mkdir()
        scaffold = artifact / "frontend" / "src"
        routes = ["/"]
        if scaffold.is_dir():
            routes += ["/" + p.stem for p in sorted(scaffold.glob("*.html"))
                       if p.name != "index.html"]
        for nid, node_contracts in contracts.items():
            (spec_dir / f"{nid}.spec.ts").write_text(
                lint_spec_source(node_contracts, routes), encoding="utf-8")
        total = sum(len(v) for v in contracts.values())
        print(f"[gate] {task}: {len(contracts)} nodes / {total} contracts -> {spec_dir}")
        # grade-local writes local-grade.json into the artifact dir; a gate
        # pass must not clobber the artifact's historical verdict (it ate
        # arch-0's Zcode record on 2026-09-26). Snapshot and restore.
        grade = artifact / ".arc" / "local-grade.json"
        backup = Path(tmp) / "local-grade.json"
        had = grade.is_file()
        if had:
            backup.write_bytes(grade.read_bytes())
        cmd = ["python3", str(ARC / "grade-local.py"), str(artifact), str(spec_dir),
               *(argv[2:] or [])]
        rc = subprocess.run(cmd).returncode
        if had:
            grade.write_bytes(backup.read_bytes())
        return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
