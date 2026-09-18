#!/usr/bin/env python3
"""Split a finished cloud run's lost nodes into the two classes that need different fixes.

A single "25/32" says nothing about what to change. Two very different things produce it:

  never-passed   the node's own spec never passed in any round. A capability gap: the
                 repair turns had the evidence and still could not make it work. Levers:
                 failure evidence quality, node budget, repair rounds.
  regressed      the node passed, then a later node's change broke it. A sequencing gap.
                 Levers: regression checkpoint interval, OCTOS_ARC_CHECKPOINT_REPAIRS.

and one more that only the official grade can reveal:

  hidden interference   the node passed locally but the official pass count is lower.
                 Per-node runs cannot see cross-node interference through shared server
                 state; only a run of every spec against one server can.

Two traps this encodes, both of which produced wrong readings before it existed:

1. Parent nodes emit the same design/implement/test events as leaves, so counting every
   requirement_state inflates both the pass and the loss count (keep 3ffe9702bf15 read as
   "31 passed / 13 lost" instead of "26 passed / 6 lost"). Parents are identified by their
   messages: design "N atomic children designed", test "children not verified: ...".
2. Local node counts and official pass counts are only the same unit when the tree is one
   spec per leaf. Ticket Booking is 2 leaves and 10 specs, so differencing them reads as a
   -5 "gap" that means nothing. The comparison is skipped unless leaves == specs.

usage:
  python3 arc/postmortem.py <run_id> [<run_id> ...]

Needs a session: ARC_COOKIE_JAR (or --cookie-jar) pointing at a Netscape cookie jar with
the site cookie, same as scoreboard.py.
"""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import sys
import time
from pathlib import Path
import urllib.error
import urllib.request

BASE = "https://arc-bench.com/api"


def client(jar_path: str | None):
    jar = http.cookiejar.MozillaCookieJar(jar_path) if jar_path else http.cookiejar.CookieJar()
    if jar_path:
        jar.load(ignore_discard=True, ignore_expires=True)
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(opener, path: str, tries: int = 6):
    """Run logs reach hundreds of kilobytes and the connection drops mid-body often
    enough to matter; read in chunks and retry rather than lose the whole postmortem.

    5xx is retried too: the logs endpoint answers 500 intermittently on the larger runs
    and then serves the same run fine seconds later. 4xx is the caller's fault (wrong run
    id, no session) and is raised immediately instead of being retried six times.
    """
    last: Exception | None = None
    for _ in range(tries):
        try:
            with opener.open(BASE + path, timeout=300) as resp:
                chunks = []
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    chunks.append(chunk)
                return json.loads(b"".join(chunks))
        except urllib.error.HTTPError as exc:
            if exc.code < 500:
                raise
            last = exc
            time.sleep(5)
        except Exception as exc:  # noqa: BLE001 - transport flakiness, retry
            last = exc
            time.sleep(5)
    raise last if last else RuntimeError("unreachable")


def classify(events: list) -> dict:
    timeline: dict[str, list[str]] = {}
    parents: set[str] = set()
    suite_verified: set[str] = set()
    for event in events:
        if not (isinstance(event, dict) and event.get("type") == "requirement_state"):
            continue
        message = str(event.get("message") or "")
        node = event.get("node_id")
        phase = event.get("phase")
        if phase == "design" and message.endswith("atomic children designed"):
            parents.add(node)
        if phase == "test":
            if message.startswith("children not verified"):
                parents.add(node)
            if "full parallel suite" in message:
                suite_verified.add(node)
            timeline.setdefault(node, []).append(event.get("status"))
    leaves = {node: hist for node, hist in timeline.items() if node not in parents}
    out = {"clean": [], "recovered": [], "regressed": [], "never_passed": [], "history": leaves,
           "suite_verified": suite_verified}
    for node, hist in leaves.items():
        if hist[-1] == "passed":
            out["recovered" if "failed" in hist else "clean"].append(node)
        elif "passed" in hist:
            out["regressed"].append(node)
        else:
            out["never_passed"].append(node)
    return out


def postmortem(opener, run_id: str) -> dict:
    run = get(opener, f"/runs/{run_id}")
    logs = get(opener, f"/runs/{run_id}/logs")
    events = logs.get("visual_events") or []
    if isinstance(events, str):
        events = json.loads(events)
    c = classify(events)
    passed = run.get("passed_count") or 0
    failed = run.get("failed_count") or 0
    specs = passed + failed
    leaves = len(c["history"])
    print(f"[{run_id}] {run.get('requirement_id')} {run.get('status')}  official {passed}/{specs}"
          f"  feature {run.get('feature_implementation_rate')}%"
          f"  CNY {run.get('token_cost_usd') or 0:.4f}  {run.get('token_count')} tok"
          f"  {run.get('run_duration_seconds')}s")
    print(f"  passed first try        {len(c['clean'])}")
    print(f"  passed after repair     {len(c['recovered'])} {c['recovered'][:6]}")
    print(f"  regressed (was passing) {len(c['regressed'])} {c['regressed']}")
    print(f"  never passed            {len(c['never_passed'])} {c['never_passed']}")
    unconfirmed = [n for n in c["clean"] + c["recovered"] if n not in c["suite_verified"]]
    if unconfirmed:
        print(f"  passed its own run but never confirmed by the full suite: "
              f"{len(unconfirmed)} {unconfirmed[:8]}")
    for node in c["regressed"][:5]:
        print(f"    regressed {node}: {' -> '.join(c['history'][node])}")
    for node in c["never_passed"][:5]:
        print(f"    never     {node}: {' -> '.join(c['history'][node])}")
    local = len(c["clean"]) + len(c["recovered"])
    if specs and leaves == specs:
        gap = local - passed
        print(f"  local {local} vs official {passed}  ({leaves} leaves = {specs} specs, same unit)"
              f"  -> hidden interference {gap}")
        if gap > 0:
            print("    >0 means nodes that pass alone break when every spec runs together,"
                  " and nothing caught it during the run")
    elif specs:
        print(f"  local {local} nodes vs official {passed}/{specs} specs -- not one spec per leaf,"
              f" no gap comparison")
    return c


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("run_ids", nargs="+")
    # Default to the driver's jar. Without a cookie every call is 401, and the
    # traceback points at urllib rather than at the missing session -- which cost a
    # detour the first time this was run months after it was written.
    default_jar = os.environ.get("ARC_COOKIE_JAR") or str(Path.home() / ".arc-web-driver" / "session.jar")
    ap.add_argument("--cookie-jar", default=default_jar if Path(default_jar).exists() else None)
    args = ap.parse_args()
    opener = client(args.cookie_jar)
    for run_id in args.run_ids:
        postmortem(opener, run_id)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
