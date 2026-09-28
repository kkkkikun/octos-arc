#!/usr/bin/env bash
# free-slice: 免费路径端到端验证——space-bunny-free 经 ofm-shim(18898) → 免费中转(18899)。
# 切片 = REQ-1 子树 5 节点，3600s 预算，全程 ¥0。验证链：容器→host.docker.internal→shim 工具翻译→内核工具循环→检查。
set -eu
cd ~/MyProject/hackathon-local-simulation
nohup python3 local_submit.py run \
  --competition hackathon --task sheet \
  --agent /home/kikun/MyProject/octos-arc/octos-arc-bundle-bootstrap.zip \
  --requirements-dir /tmp/sheet-slice-req1 \
  --env-file .env-free-slice \
  --output-dir runs/free-slice-0 \
  > runs/free-slice-0.launch.log 2>&1 &
echo "launched PID $!"
