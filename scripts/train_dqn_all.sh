#!/usr/bin/env bash
# Train every DQN model in configs/training.yaml, one run at a time, smallest board first:
#   3x3 seeds 42-46 (200k steps), 4x4 seed 42 (500k), 5x5 seed 42 (2M), 9x9 seed 42 (5M).
#
# Usage:  scripts/train_dqn_all.sh            # every board
#         scripts/train_dqn_all.sh 3 4        # only the listed board sizes
#
# Safe to stop and re-run: finished runs (final.pt present) are skipped and paused runs
# continue from resume.pt. Each run trains in CHUNK_MINUTES chunks and saves resume.pt
# (atomic write) between them, so a crash or reboot loses at most one chunk.
# 9x9 resume.pt is ~500 MB: keep >= 1.5 GB free (temp file + old copy during the rename).
#
# Settings (environment variables):
#   PYTHON         interpreter with torch      default: .venv/bin/python if present, else python3
#   OUT_DIR        where runs are written      default: checkpoints/runs
#   THREADS        torch CPU threads           default: 4
#   CHUNK_MINUTES  minutes between resume saves default: 60
#   DEVICE         auto | cpu | cuda           default: from configs/training.yaml
#
# Output: $OUT_DIR/<N>x<N>_s<seed>/ (final.pt, model.pt, meta.json, train_log.jsonl),
# console log $OUT_DIR/<N>x<N>_s<seed>.out, progress in $OUT_DIR/status.log.
# To keep the machine awake (Linux): systemd-inhibit --what=sleep:idle scripts/train_dqn_all.sh
set -u
cd "$(dirname "$0")/.."

if [ -z "${PYTHON:-}" ]; then
  if [ -x .venv/bin/python ]; then PYTHON=.venv/bin/python; else PYTHON=python3; fi
fi
OUT_DIR=${OUT_DIR:-checkpoints/runs}
THREADS=${THREADS:-4}
CHUNK_MINUTES=${CHUNK_MINUTES:-60}
STATUS=$OUT_DIR/status.log

"$PYTHON" -c "import torch" 2>/dev/null || { echo "error: '$PYTHON' cannot import torch (pip install -r requirements.txt)" >&2; exit 1; }
mkdir -p "$OUT_DIR"

log() { echo "$(date -Is) $*" | tee -a "$STATUS"; }

run() {  # run <board> <seed>
  local n=$1 s=$2 dir=$OUT_DIR/${1}x${1}_s$2 rc=3
  if [ -f "$dir/final.pt" ]; then log "SKIP ${n}x${n} s$s (final.pt exists)"; return; fi
  log "START ${n}x${n} s$s"
  while [ $rc -eq 3 ]; do  # train_dqn.py exits 3 after saving resume.pt at a chunk boundary
    "$PYTHON" -m scripts.train_dqn --board-size "$n" --seed "$s" --threads "$THREADS" \
        --max-minutes "$CHUNK_MINUTES" --resume --output-dir "$dir" ${DEVICE:+--device "$DEVICE"} \
        >> "$dir.out" 2>&1
    rc=$?
  done
  log "END ${n}x${n} s$s rc=$rc free=$(df -h . | awk 'NR==2{print $4}')"
}

boards=${*:-3 4 5 9}
for n in $boards; do
  case $n in
    3) for s in 42 43 44 45 46; do run 3 $s; done ;;
    4|5|9) run "$n" 42 ;;
    *) echo "error: unknown board size '$n' (use 3, 4, 5 or 9)" >&2; exit 2 ;;
  esac
done
log "ALL DONE ($boards)"
