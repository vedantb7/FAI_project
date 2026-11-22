#!/usr/bin/env bash
# DQN experiments the proposal (project_idea.pdf) asks for and the project had not run, all on
# 3x3, seed 42, one run at a time: the 2^3 mechanic ablation for the DQN (RQ1) and H2 (warm-up).
# Each run is trained, then evaluated with scripts/eval_dqn_final.py (exact ground truth + matches). Safe to re-run: finished runs and evals are skipped.
#
#   scripts/run_drift_experiments.sh            # everything
#   scripts/run_drift_experiments.sh h2         # only some groups: rq1 h2
#
# Baseline for every comparison: the default 3x3 K1 M1 run (checkpoints/runs/3x3_s42, plus the
# s43-s46 runs for the seed-to-seed spread).
set -u
cd "$(dirname "$0")/.."
PY=${PYTHON:-.venv/bin/python}
RUNS=checkpoints/runs
EVAL_DIR=experiments/results/final_dqn/drift_runs
STATUS=$RUNS/drift_status.log
mkdir -p "$RUNS" "$EVAL_DIR"
log() { echo "$(date -Is) $*" | tee -a "$STATUS"; }

train() {  # train <name> <extra train_dqn args...>
  local name=$1; shift
  local dir=$RUNS/exp_$name rc=3
  if [ -f "$dir/final.pt" ]; then log "SKIP train $name"; else
    log "START train $name: $*"
    while [ $rc -eq 3 ]; do
      "$PY" -m scripts.train_dqn --board-size 3 --seed 42 --threads 4 --max-minutes 60 --resume \
          --output-dir "$dir" "$@" >> "$dir.out" 2>&1
      rc=$?
    done
    log "END train $name rc=$rc"
  fi
  if [ -f "$EVAL_DIR/$name.json" ]; then log "SKIP eval $name"; else
    "$PY" scripts/eval_dqn_final.py --checkpoint "$dir/final.pt" --out "drift_runs/$name.json" \
        > "$EVAL_DIR/$name.log" 2>&1
    log "END eval $name rc=$?"
  fi
}

groups=${*:-rq1 h2}
for g in $groups; do
  case $g in
    rq1)    # RQ1: one DQN per A/B/C cell (111 = the baseline run)
            for abc in 000 001 010 011 100 101 110; do train "rq1_abc$abc" --abc "$abc"; done ;;
    h2)     # H2: heuristic warm-up (proposal: 10^4 steps) vs pure self-play (no Greedy opponent)
            train h2_warmup10k --set warmup_steps=10000
            train h2_pure_selfplay --set "mixture=[0.5,0.5,0.0]" ;;
    *) echo "unknown group $g (rq1 h2)" >&2; exit 2 ;;
  esac
done
log "ALL DONE ($groups)"
