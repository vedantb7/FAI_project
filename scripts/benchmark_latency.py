#!/usr/bin/env python3
"""Per-move decision latency of a DQN release model and the baseline agents (batch size 1).

Positions come from seeded random self-play under the model's own board size and rules
(read from <model_dir>/meta.json). Each series samples its own positions (seed + series),
discards `--warmup` decisions per agent, then times `select_action` on a fresh engine
clone with time.perf_counter() (torch.cuda.synchronize() around the call on CUDA).
Every agent times the same positions. Reported per agent: mean +- std of the series
means, and median, p95 and max over all timed decisions.

    python scripts/benchmark_latency.py --model checkpoints/release/dqn_5x5 \
        --out experiments/results/benchmarks/latency_5x5.json

Latency depends on the machine and its load: run on an otherwise idle machine.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import random
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from evaluation.match_runner import MatchConfig, make_agent, run_metadata  # noqa: E402
from wallz_engine import WallzEngine  # noqa: E402

DEFAULT_AGENTS = ['dqn', 'greedy', 'minimax:depth=1', 'minimax:depth=2']


def sample_positions(board_size, rules, n, seed, max_plies=200):
    """First n non-terminal positions met along seeded uniform-random games (each game ends at
    a terminal state or max_plies), in play order and shuffled with the same seed."""
    rng = random.Random(seed)
    out = []
    while len(out) < n:
        engine = WallzEngine(board_size=board_size, rules=rules)
        for _ in range(max_plies):
            if engine.is_terminal() or len(out) >= n:
                break
            out.append(engine.clone())
            engine.apply_action(rng.choice(sorted(engine.get_legal_actions())), update_clock=False)
    rng.shuffle(out)
    return out


def hardware():
    cpu = platform.processor() or platform.machine()
    try:
        with open('/proc/cpuinfo', encoding='utf-8') as fh:
            cpu = next(l.split(':', 1)[1].strip() for l in fh if l.startswith('model name'))
    except (OSError, StopIteration):
        pass
    info = {'cpu': cpu, 'logical_cpus': os.cpu_count()}
    try:
        info['ram_gb'] = round(os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / 2**30, 1)
    except (ValueError, OSError, AttributeError):
        pass
    return info


def percentile(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))]


def benchmark(model_dir, agents=DEFAULT_AGENTS, positions=1000, repeats=5, warmup=100, seed=42, device='cpu'):
    import torch
    from agents.dqn.network import resolve_device
    device = resolve_device(device)
    meta = json.loads((Path(model_dir) / 'meta.json').read_text())
    n, rules = meta['N'], meta['rules']
    cfg = MatchConfig(board_size=n, rules=rules)
    cuda = device == 'cuda'
    series_positions = [sample_positions(n, rules, warmup + positions, seed + r) for r in range(repeats)]
    results = {}
    for spec in agents:
        full = f"dqn:path={Path(model_dir) / 'model.pt'}" if spec == 'dqn' else spec
        built = {p: make_agent(full, p, cfg)[0] for p in (0, 1)}
        if spec == 'dqn':
            for a in built.values():
                a.device = torch.device(device)
                a.model.to(a.device)
        series, all_ms = [], []
        for pos in series_positions:
            times = []
            for i, eng in enumerate(pos):
                e = eng.clone()
                if cuda:
                    torch.cuda.synchronize()
                t0 = time.perf_counter()
                built[e.current_player].select_action(e)
                if cuda:
                    torch.cuda.synchronize()
                if i >= warmup:
                    times.append((time.perf_counter() - t0) * 1000)
            series.append(statistics.fmean(times))
            all_ms.extend(times)
        results[spec] = {
            'decisions': len(all_ms), 'series': repeats,
            'mean_ms': statistics.fmean(series), 'std_ms': statistics.stdev(series) if repeats > 1 else 0.0,
            'median_ms': statistics.median(all_ms), 'p95_ms': percentile(all_ms, 0.95), 'max_ms': max(all_ms),
        }
    return {
        'run': run_metadata(),
        'hardware': hardware(),
        'torch': {'version': torch.__version__, 'threads': torch.get_num_threads(), 'device': device,
                  'cuda_available': torch.cuda.is_available()},
        'model': {'dir': str(model_dir), **{k: meta[k] for k in ('N', 'rules', 'seed', 'step', 'commit')}},
        'protocol': {'positions_per_series': positions, 'repeats': repeats, 'warmup': warmup, 'seed': seed,
                     'batch_size': 1, 'position_source': 'positions along seeded uniform-random games (200-ply cap), shuffled'},
        'agents': results,
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--model', required=True, help='release model dir with model.pt and meta.json')
    p.add_argument('--agents', nargs='+', default=DEFAULT_AGENTS, help="'dqn' means the --model checkpoint")
    p.add_argument('--positions', type=int, default=1000, help='timed decisions per series')
    p.add_argument('--repeats', type=int, default=5)
    p.add_argument('--warmup', type=int, default=100)
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--device', default='cpu', choices=['cpu', 'cuda', 'auto'])
    p.add_argument('--threads', type=int, help='torch CPU threads (default: torch default)')
    p.add_argument('--out', required=True)
    a = p.parse_args(argv)
    if a.threads:
        import torch
        torch.set_num_threads(a.threads)
    res = benchmark(a.model, a.agents, a.positions, a.repeats, a.warmup, a.seed, a.device)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=2) + '\n')
    for spec, r in res['agents'].items():
        print(f"{spec:18s} {r['mean_ms']:9.3f} +- {r['std_ms']:.3f} ms  median {r['median_ms']:.3f}  "
              f"p95 {r['p95_ms']:.3f}  max {r['max_ms']:.3f}  (n={r['decisions']})")


if __name__ == '__main__':
    main()
