#!/usr/bin/env python3
"""Summarise one local run: tokens, cost, turns, duration, node states, grade.

usage: metrics.py <output_dir> [--json]

Numbers come straight from `.arc/octos-events.jsonl` (turn/completed
tokens_in/tokens_out; token_cost_update session_cost, summed over sessions
because each session's cost is cumulative) and `.arc/runner-events.jsonl`
(running -> completed wall time, requirement_state rows).
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path


def _iter_jsonl(path: Path):
    if not path.is_file():
        return
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def summarize(output_dir: Path) -> dict:
    arc = output_dir / ".arc"
    turns = tokens_in = tokens_out = 0
    tool_calls = 0
    cost_by_session: dict[str, float] = {}
    sessions: set[str] = set()
    for ev in _iter_jsonl(arc / "octos-events.jsonl"):
        method, params = ev.get("method"), ev.get("params") or {}
        sid = str(params.get("session_id") or "")
        if sid:
            sessions.add(sid)
        if method == "turn/completed":
            turns += 1
            tokens_in += int(params.get("tokens_in") or 0)
            tokens_out += int(params.get("tokens_out") or 0)
        elif method == "tool/started":
            tool_calls += 1
        elif method == "progress/updated":
            meta = params.get("metadata") or {}
            if meta.get("kind") == "token_cost_update":
                cost = (meta.get("token_cost") or {}).get("session_cost")
                if isinstance(cost, (int, float)):
                    cost_by_session[sid] = max(cost_by_session.get(sid, 0.0), float(cost))
    started = completed = None
    states: dict[str, str] = {}
    for ev in _iter_jsonl(arc / "runner-events.jsonl"):
        if ev.get("type") == "runner_state":
            ts = ev.get("timestamp")
            if ev.get("state") == "running" and started is None:
                started = ts
            elif ev.get("state") in ("completed", "failed"):
                completed = ts
        elif ev.get("type") == "requirement_state":
            states[ev["node_id"]] = f"{ev.get('phase')}/{ev.get('status')}"
    duration = None
    if started and completed:
        fmt = "%Y-%m-%d %H:%M:%S"
        duration = int(time.mktime(time.strptime(completed, fmt)) - time.mktime(time.strptime(started, fmt)))
    node_states = {}
    try:
        node_states = {k: v.get("state") for k, v in json.loads((arc / "traceability" / "node_states.json").read_text()).items()}
    except (OSError, json.JSONDecodeError, AttributeError):
        pass
    grade = None
    grade_file = arc / "local-grade.json"
    if grade_file.is_file():
        try:
            grade = json.loads(grade_file.read_text())
        except json.JSONDecodeError:
            pass
    return {
        "output_dir": str(output_dir), "turns": turns, "sessions": len(sessions), "tool_calls": tool_calls,
        "tokens_in": tokens_in, "tokens_out": tokens_out,
        "cost": round(sum(cost_by_session.values()), 6), "duration_s": duration,
        "node_states": node_states, "last_events": states, "grade": grade,
    }


def main(argv: list[str]) -> int:
    if not argv or argv[0].startswith("-"):
        print(__doc__)
        return 2
    data = summarize(Path(argv[0]).resolve())
    if "--json" in argv:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    g = data["grade"] or {}
    grade = f"{g.get('passed')}/{g.get('total')}" if g else "n/a"
    print(f"| {Path(data['output_dir']).name} | {data['turns']} | {data['tokens_in']} | {data['tokens_out']} | "
          f"{data['cost']} | {data['duration_s']} | {grade} | {data['node_states']} |")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
