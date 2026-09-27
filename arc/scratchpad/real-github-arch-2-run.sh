#!/usr/bin/env bash
# github-arch-2 (relaunch after Docker restart): same bundle 6caad23 -- R4a twin-control rule +
# R3 knives on github; tree budget 47 nodes x 600s dominates (28200s).
set -eu
cd ~/MyProject/hackathon-local-simulation
nohup python3 local_submit.py run \
  --competition hackathon --task github \
  --agent /home/kikun/MyProject/octos-arc/octos-arc-bundle.zip \
  --requirements-dir /home/kikun/MyProject/octos-arc/arc/tasks/hackathon--github \
  --env-file .env-github \
  --output-dir runs/real-github-arch-2 \
  > runs/real-github-arch-2.launch.log 2>&1 &
echo "launched PID $!"
