#!/usr/bin/env bash
# Overnight joint leg (ledger #13/#14): R2+R3+镜像修复 bundle (zip a2537be, HEAD ea6d764)
# + 21600s budget (.env-sheet6h). Launch only after arch-2 AND keep-arch-0
# verdicts are recorded; bundle content may be amended by the keep verdict
# (ARIA prompt merge) -- repack before launching if so.
set -eu
cd ~/MyProject/hackathon-local-simulation
nohup python3 local_submit.py run \
  --competition hackathon --task sheet \
  --agent /home/kikun/MyProject/octos-arc/octos-arc-bundle.zip \
  --requirements-dir /home/kikun/MyProject/octos-arc/arc/tasks/hackathon--sheet \
  --env-file .env-sheet6h \
  --output-dir runs/real-sheet-arch-3 \
  > runs/real-sheet-arch-3.launch.log 2>&1 &
echo "launched, container name appears in runs/real-sheet-arch-3.launch.log; PID $!"
