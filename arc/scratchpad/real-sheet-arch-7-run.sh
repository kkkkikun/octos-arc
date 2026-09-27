#!/usr/bin/env bash
# arch-7: 自举跑（B 分支）——arch-2 成品（20/100 已验、跑完全程 .arc-best、净种 store 实证）
# 作包模板起步；arch-6 尾部态复测仅 8/100（半写代码深度破损）弃用。
# 包 6ac0f281 = arch-2 自举模板 + collect 回退链修复（墙掐跑也交最后过检态）。
# 预算全砸未实现 62 测块（REQ-2 工作表家族 19 / REQ-4 公式 15 / REQ-5 数据 21 / REQ-3 尾 7）。
set -eu
cd ~/MyProject/hackathon-local-simulation
nohup python3 local_submit.py run \
  --competition hackathon --task sheet \
  --agent /home/kikun/MyProject/octos-arc/octos-arc-bundle-bootstrap.zip \
  --requirements-dir /home/kikun/MyProject/octos-arc/arc/tasks/hackathon--sheet \
  --env-file .env-sheet6h \
  --output-dir runs/real-sheet-arch-7 \
  > runs/real-sheet-arch-7.launch.log 2>&1 &
echo "launched PID $!"
