#!/usr/bin/env python3
"""Proposal hypothesis H3 (project_idea.pdf Sec. 4.3): on solvable grids (N <= 4) the DQN's mean
value error against the exact solution converges below 0.15 across training.

Re-scores every saved checkpoint (step_*.pt, then final.pt) of one or more training runs over EVERY
non-terminal state of the exact solve, with the same function as scripts/eval_dqn_final.py
(population_truth). The error is |max_legal Q(s) - V*(s)| with V* the gamma-discounted exact value
(gamma 0.99): a state-value proxy for the proposal's |Q(s,a) - Q*(s,a)|. No training is run.

  python scripts/h3_convergence.py checkpoints/runs/3x3_s46 checkpoints/runs/4x4_s42 \
      --out experiments/results/drift_fixes/h3_convergence.json
"""
import argparse
import json
import platform
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import torch  # noqa: E402

from agents.dqn.agent import load_checkpoint  # noqa: E402
from evaluation.match_runner import source_commit  # noqa: E402
from scripts.eval_dqn_final import cached_solve, population_truth  # noqa: E402

THRESHOLD = 0.15


def step_of(p):
    m = re.search(r'step_(\d+)\.pt$', p.name)
    return int(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('runs', nargs='+', help='training run directories (with meta.json and step_*.pt)')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    torch.set_num_threads(2)

    out = {'hypothesis': f'H3: mean value error vs exact solution converges below {THRESHOLD} (N <= 4)',
           'error_definition': '|max legal Q(s) - V*(s)|, V* discounted with gamma 0.99, all non-terminal states',
           'source': source_commit(), 'command': 'python ' + ' '.join(sys.argv),
           'python': platform.python_version(), 'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'runs': {}}
    for run in map(Path, args.runs):
        meta = json.loads((run / 'meta.json').read_text())
        n, rules = meta['N'], dict(meta['rules'])
        sol, label, _ = cached_solve(n, rules)
        if not sol.exact:
            raise SystemExit(f'{label}: exact solve incomplete')
        ckpts = sorted(run.glob('step_*.pt'), key=step_of) + [run / 'final.pt']
        curve = []
        for ck in ckpts:
            agent = load_checkpoint(ck, player_id=0, expected_board_size=n)
            truth = population_truth(sol, agent)['all']
            step = step_of(ck) if step_of(ck) is not None else meta['step']
            curve.append({'checkpoint': ck.name, 'step': step, 'mae': truth['mae_vs_discounted_value'],
                          'value_optimal_rate': truth['value_optimal_rate'],
                          'sign_agreement': truth.get('sign_agreement')})
            print(f"{run.name} {ck.name}: mae {curve[-1]['mae']}  value-opt {curve[-1]['value_optimal_rate']}",
                  flush=True)
        maes = [c['mae'] for c in curve]
        below = [c['step'] for c in curve if c['mae'] < THRESHOLD]
        out['runs'][run.name] = {
            'label': label, 'states': truth['n'], 'curve': curve,
            'final_mae': maes[-1], 'min_mae': min(maes),
            'min_mae_step': curve[maes.index(min(maes))]['step'],
            'first_step_below_threshold': below[0] if below else None,
            'final_below_threshold': maes[-1] < THRESHOLD,
            'stays_below_after_first_crossing': bool(below) and all(
                c['mae'] < THRESHOLD for c in curve if c['step'] >= below[0])}
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=2)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
