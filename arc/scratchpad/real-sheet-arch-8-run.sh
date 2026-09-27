#!/usr/bin/env bash
# arch-8: 经济收官跑（¥29 硬顶）——arch-7 验证态自举（collect 回退链实战交付）+
# 五刀包（时钟 40s/逐测试隔离/资产洞探针/collect 回退/spec file:line 过滤）。
# 4h 墙（14400s，node_budget 600 地板），预算全砸 REQ-4 公式族 + REQ-2-2 行列族 + REQ-5 尾。
# 隔离刀使检查零幻影，修复轮全花真伤上。
set -eu
cd ~/MyProject/hackathon-local-simulation
nohup python3 local_submit.py run \
  --competition hackathon --task sheet \
  --agent /home/kikun/MyProject/octos-arc/octos-arc-bundle-bootstrap.zip \
  --requirements-dir /home/kikun/MyProject/octos-arc/arc/tasks/hackathon--sheet \
  --env-file .env-arch8 \
  --output-dir runs/real-sheet-arch-8 \
  > runs/real-sheet-arch-8.launch.log 2>&1 &
echo "launched PID $!"
