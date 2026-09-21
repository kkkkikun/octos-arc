#!/usr/bin/env python3
"""ARC Bench Meter 用量快照/差值工具（本地校准 b 口径用，不进提交包）。

复用官方 local-simulation 的 MeterUsageClient 实现，保证口径一致：
    login(access_key) -> GET /api/user/usage -> logout

用法:
    python3 arc/meter_snapshot.py snapshot              # 打一次快照（验证连通性/币种）
    python3 arc/meter_snapshot.py watch <秒>            # 每隔 N 秒快照一次直到 Ctrl-C
    python3 arc/meter_snapshot.py delta <快照json>...   # 对比若干快照，输出 token/费用差值

快照 JSON 结构: {"ts": epoch, "access_key_id": ..., "tokens": n, "cost": "x.xx", "currency": "CNY"}
key 来源（优先级同 local_submit.read_environment_value）: 环境变量 ARCBENCH_API_KEY
或 OPENAI_API_KEY，否则 hackathon-local-simulation/.env 的 OPENAI_API_KEY。
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

SIM_REPO = Path(os.environ.get("ARCBENCH_SIM_ROOT", Path.home() / "MyProject/hackathon-local-simulation"))


def load_client():
    sys.path.insert(0, str(SIM_REPO))
    from local_submit import MeterUsageClient  # noqa: PLC0415 官方实现，直接复用保口径一致

    key = os.environ.get("ARCBENCH_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not key:
        env_file = SIM_REPO / ".env"
        if env_file.is_file():
            for line in env_file.read_text().splitlines():
                if line.startswith("OPENAI_API_KEY="):
                    key = line.split("=", 1)[1].strip()
    if not key:
        sys.exit("没有 API key：设 ARCBENCH_API_KEY / OPENAI_API_KEY，或配置 %s/.env" % SIM_REPO)
    return MeterUsageClient("https://meter.arc-bench.com", key)


def snapshot() -> dict:
    snap = load_client().capture(wait_for_settlement=True)
    return {
        "ts": int(time.time()),
        "access_key_id": snap.access_key_id,
        "tokens": snap.total_tokens,
        "cost": str(snap.total_cost),
        "currency": snap.currency,
    }


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "snapshot"
    if cmd == "snapshot":
        s = snapshot()
        print(json.dumps(s, ensure_ascii=False))
        print(f"[meter] key={s['access_key_id'][:12]}... 窗口内 tokens={s['tokens']} "
              f"cost={s['cost']} {s['currency']}")
        return 0
    if cmd == "watch":
        interval = int(sys.argv[2]) if len(sys.argv) > 2 else 60
        while True:
            try:
                s = snapshot()
            except Exception as exc:  # noqa: BLE001
                print(f"[meter] error: {exc}", flush=True)
                time.sleep(interval)
                continue
            print(time.strftime("%H:%M:%S"), json.dumps(s, ensure_ascii=False), flush=True)
            time.sleep(interval)
    if cmd == "delta":
        snaps = [json.loads(Path(p).read_text()) for p in sys.argv[2:]]
        if len(snaps) < 2:
            sys.exit("delta 需要至少两个快照文件")
        first, last = snaps[0], snaps[-1]
        print(f"[meter] Δtokens={last['tokens'] - first['tokens']} "
              f"Δcost={float(last['cost']) - float(first['cost'])} {last['currency']} "
              f"(跨 {last['ts'] - first['ts']}s, {len(snaps)} 个快照)")
        return 0
    sys.exit(__doc__)


if __name__ == "__main__":
    raise SystemExit(main())
