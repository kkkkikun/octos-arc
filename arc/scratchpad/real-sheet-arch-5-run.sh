#!/usr/bin/env bash
# arch-5 (relaunch after Docker restart killed arch-4 at half-run): bundle 6caad23 (R2+R3+R4a+absolute-path rule+JS smoke)
# + 21600s. R3's real trial after arch-3's foundation bug wasted its run.
set -eu
cd ~/MyProject/hackathon-local-simulation
nohup python3 local_submit.py run \
  --competition hackathon --task sheet \
  --agent /home/kikun/MyProject/octos-arc/octos-arc-bundle.zip \
  --requirements-dir /home/kikun/MyProject/octos-arc/arc/tasks/hackathon--sheet \
  --env-file .env-sheet6h \
  --output-dir runs/real-sheet-arch-5 \
  > runs/real-sheet-arch-5.launch.log 2>&1 &
echo "launched PID $!"
