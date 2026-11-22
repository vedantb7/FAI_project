#!/usr/bin/env python3
"""Proposal hypothesis H1 (project_idea.pdf Sec. 4.3): reusable walls (A) and temporary blocks (C)
expand the branching factor by >= 40%, reducing the Minimax depth reached under a fixed time budget.

For each of the 8 A/B/C cells (N5 K3 M10 by default) the same seeded random playouts (2-12 plies,
each cell under its own rules) give the sample positions. Per position it records the legal action
count and the depth that MinimaxAgent (iterative deepening, max depth 8, time_limit 2.0 s, the
proposal's settings) completes. Run on an otherwise idle machine: depth under a time limit depends
on load.

  python scripts/h1_branching_depth.py --positions 40 --out experiments/results/drift_fixes/h1_branching_depth_N5.json
"""
import argparse
import json
import platform
import random
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from agents.minimax import MinimaxAgent  # noqa: E402
from evaluation.match_runner import source_commit  # noqa: E402
from wallz_engine import WallzEngine  # noqa: E402


def positions(n, rules, count, seed):
    rng = random.Random(seed)
    out = []
    while len(out) < count:
        e = WallzEngine(board_size=n, rules=rules)
        for _ in range(rng.randint(2, 12)):
            legal = e.get_legal_actions()
            if e.is_terminal() or not legal:
                break
            e.apply_action(rng.choice(legal), update_clock=False)
        if not e.is_terminal() and e.get_legal_actions():
            out.append(e)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-N', type=int, default=5)
    ap.add_argument('-K', type=int, default=3)
    ap.add_argument('-M', type=int, default=10)
    ap.add_argument('--positions', type=int, default=40)
    ap.add_argument('--depth', type=int, default=8)
    ap.add_argument('--time-limit', type=float, default=2.0)
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    cells = {}
    for abc in ('000', '100', '010', '001', '110', '101', '011', '111'):
        rules = {'A': abc[0] == '1', 'B': abc[1] == '1', 'C': abc[2] == '1', 'K': args.K, 'M': args.M}
        rows = []
        for e in positions(args.N, rules, args.positions, args.seed):
            agent = MinimaxAgent(player_id=e.current_player, depth=args.depth, time_limit=args.time_limit)
            t0 = time.perf_counter()
            agent.select_action(e.clone())
            rows.append({'legal': len(e.get_legal_actions()), 'depth': agent.last_search_depth,
                         'seconds': round(time.perf_counter() - t0, 3)})
        legal = [r['legal'] for r in rows]
        depth = [r['depth'] for r in rows]
        cells[abc] = {'rules': rules, 'n': len(rows),
                      'mean_legal': statistics.mean(legal), 'median_legal': statistics.median(legal),
                      'mean_depth': statistics.mean(depth),
                      'depth_counts': {str(d): depth.count(d) for d in sorted(set(depth))},
                      'mean_seconds': statistics.mean(r['seconds'] for r in rows), 'rows': rows}
        print(f"{abc}: legal {cells[abc]['mean_legal']:.1f}, depth {cells[abc]['mean_depth']:.2f}", flush=True)

    base = cells['000']['mean_legal']
    h1 = {abc: {'branching_increase_pct_vs_000': round(100 * (c['mean_legal'] / base - 1), 1),
                'depth_change_vs_000': round(c['mean_depth'] - cells['000']['mean_depth'], 2)}
          for abc, c in cells.items()}
    out = {'hypothesis': 'H1: A and C raise branching >= 40% and reduce Minimax depth under t_max',
           'config': vars(args), 'source': source_commit(), 'command': 'python ' + ' '.join(sys.argv),
           'python': platform.python_version(), 'platform': platform.platform(),
           'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'cells': cells, 'h1': h1}
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=2)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
