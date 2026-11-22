#!/usr/bin/env python3
"""Export the study's final-rule results for the web showcase.

Reads the result files cited by report/final_report.md and writes
web/frontend/src/data/findings.json. Every section names its source file and commit, so the site
never shows a hand-typed number. The output is deterministic (no timestamps), so
tests/test_web_findings.py can regenerate it and compare.

  python scripts/export_web_findings.py            # write the JSON
  python scripts/export_web_findings.py --check    # exit 1 if the committed JSON is stale
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / 'experiments' / 'results'
OUT = ROOT / 'web' / 'frontend' / 'src' / 'data' / 'findings.json'
ABC = ['000', '001', '010', '011', '100', '101', '110', '111']


def load(rel):
    return json.loads((RESULTS / rel).read_text(encoding='utf-8'))


def commit_of(doc):
    """Commit and dirty flag from any of the provenance layouts used in experiments/results."""
    for get in (lambda d: d['source'], lambda d: d['provenance']['git'], lambda d: d['run']['source']):
        try:
            src = get(doc)
            return {'commit': src['commit'][:7], 'dirty': bool(src.get('dirty', False))}
        except (KeyError, TypeError):
            continue
    return {'commit': None, 'dirty': None}


class Sources:
    """Collects {id: {path, commit, dirty}} for every file read."""

    def __init__(self):
        self.table = {}

    def read(self, rel):
        doc = load(rel)
        self.table[rel] = {'path': f'experiments/results/{rel}', **commit_of(doc)}
        return doc, rel


def abc_of(rules):
    return ''.join('1' if rules[k] else '0' for k in 'ABC')


def r4(x):
    return None if x is None else round(float(x), 4)


def solve_cells(src):
    files = [
        'final_eval/solve_N3_K1_M0.json', 'final_eval/solve_N3_K1_M1.json', 'drift_fixes/solve_N3_K1_M2.json',
        'final_eval/solve_N4_K1_M0.json', 'final_eval/solve_N4_K1_M1.json',
    ] + [f'drift_fixes/solve_N4_K1_M2/cell_{abc}.json' for abc in ABC]
    cells = []
    for rel in files:
        doc, sid = src.read(rel)
        for c in doc['cells']:
            cells.append({
                'n': c['board_size'], 'k': c['rules']['K'], 'm': c['rules']['M'], 'abc': abc_of(c['rules']),
                'complete': c['complete'], 'states': c['states'],
                'root': c['root_status'] if c['complete'] else 'UNKNOWN',
                'rank': c['root_rank'] if c['complete'] else None,
                'source': sid,
            })
    cells.sort(key=lambda c: (c['n'], c['m'], c['abc']))
    return cells


def hop_rule_change(src):
    """Root values before the HOP rule change (2-cell jump), B off vs B on, M = 0."""
    out = []
    for n in (3, 4):
        doc, sid = src.read(f'person3_pilot/solve_N{n}_K1_M0.json')
        for c in doc['cells']:
            out.append({'n': n, 'abc': abc_of(c['rules']), 'root': c['root_status'], 'rank': c['root_rank'],
                        'source': sid})
    return out


def ablation(src):
    doc, sid = src.read('final_eval/ablation_N5_K3_M10_open4/summary.json')
    win = doc['effects']['x_goal_win']
    length = doc['effects']['length_plies']
    effects = [{'name': k, 'estimate': r4(v['estimate']), 'ci95': [r4(x) for x in v['ci95']],
                'holm': bool(v['significant_holm'])} for k, v in win['effects'].items()]
    means = {abc_of({'A': key[4] == '1', 'B': key[6] == '1', 'C': key[8] == '1'}): r4(v)
             for key, v in length['cell_means'].items()}
    single = {m: means[abc] - means['000'] for m, abc in (('A', '100'), ('B', '010'), ('C', '001'))}
    return {
        'board': 'N5 K3 M10', 'agents': [doc['design']['agent_x'], doc['design']['agent_y']],
        'distinct_openings': doc['replicas']['distinct_openings'], 'matches': doc['design']['n_matches'],
        'win_rate_effects': effects,
        'length_cell_means': means,
        'length_additive_prediction': r4(means['000'] + sum(single.values())),
        'length_measured_all_on': means['111'],
        'length_ab_interaction': r4(length['effects']['AB']['estimate']),
        'length_ab_holm': bool(length['effects']['AB']['significant_holm']),
        'b_draw_effect': r4(doc['effects']['rule_draw']['effects']['B']['estimate']),
        'b_length_effect': r4(length['effects']['B']['estimate']),
        'source': sid,
    }


def hop_scorer(src):
    doc, sid = src.read('final_minimax_hop/paired_d2_default_vs_hop.json')
    r = doc['results']
    return {'board': 'N5 K3 M10', 'games': r['games_paired'], 'win_rate_default': r4(r['win_rate_a']),
            'win_rate_hop': r4(r['win_rate_b']), 'difference': r4(r['difference_b_minus_a']),
            'ci95': [r4(x) for x in r['paired_bootstrap95']], 'source': sid}


def h1(src):
    doc, sid = src.read('drift_fixes/h1_branching_depth_N5.json')
    rows = []
    for abc in ABC:
        c, h = doc['cells'][abc], doc['h1'][abc]
        rows.append({'abc': abc, 'mean_legal': r4(c['mean_legal']), 'mean_depth': r4(c['mean_depth']),
                     'branching_pct': h['branching_increase_pct_vs_000'], 'depth_change': h['depth_change_vs_000']})
    cfg = doc['config']
    return {'board': f"N{cfg['N']} K{cfg['K']} M{cfg['M']}", 'positions': cfg['positions'],
            'time_limit_s': cfg['time_limit'], 'threshold_pct': 40, 'cells': rows, 'source': sid}


def match_row(overall):
    cat = overall['categories']
    draws = sum(v for k, v in cat.items() if k.startswith('draw'))
    return {'games': overall['matches'], 'win': cat['win'], 'draw': draws, 'truncated': cat['truncated'],
            'loss': cat['loss'], 'win_rate': r4(overall['win_rate']), 'ci95': [r4(x) for x in overall['win_rate_ci95']]}


def dqn_eval(rel, src):
    doc, sid = src.read(rel)
    truth = (doc.get('ground_truth_population') or {}).get('all')
    return doc, {
        'board': doc['board_size'],
        'steps': doc.get('checkpoint_meta', {}).get('step'),
        'value_optimal': r4(truth['value_optimal_rate']) if truth else None,
        'mae': r4(truth['mae_vs_discounted_value']) if truth else None,
        'states': truth['n'] if truth else None,
        'vs_greedy': match_row(doc['matches']['greedy']['overall']),
        'source': sid,
    }


def h2(src):
    arms = []
    for arm, rel in (('Warm-up', 'final_dqn/drift_runs/h2_warmup10k.json'),
                     ('Default', 'final_dqn/overnight/dqn_3x3_s42_eval.json'),
                     ('Pure self-play', 'final_dqn/drift_runs/h2_pure_selfplay.json')):
        _, row = dqn_eval(rel, src)
        arms.append({'arm': arm, **row})
    return {'threshold_warmup': 0.75, 'threshold_pure': 0.55, 'arms': arms}


def h3(src):
    runs = []
    for rel, budget in (('drift_fixes/h3_convergence.json', None), ('drift_fixes/h3_convergence_3x3_500k.json', 500000)):
        doc, sid = src.read(rel)
        for name, r in doc['runs'].items():
            board = int(r['label'][1])
            if budget is None and board == 3:
                b = 200000
            else:
                b = budget or 500000
            curve = [[c['step'], r4(c['mae'])] for c in r['curve'] if c['checkpoint'] != 'final.pt']
            stays = None
            for step, mae in reversed(curve):
                if mae < 0.15:
                    stays = step
                else:
                    break
            runs.append({'run': name, 'board': board, 'seed': int(name.rsplit('_s', 1)[1]), 'budget': b,
                         'final': r4(r['final_mae']), 'first_below': r['first_step_below_threshold'],
                         'stays_below_from': stays, 'curve': curve, 'source': sid})
    runs.sort(key=lambda r: (r['board'], r['budget'], r['seed']))
    return {'threshold': 0.15, 'runs': runs}


def rq1(src):
    cells = []
    for abc in ABC[:-1]:
        _, row = dqn_eval(f'final_dqn/drift_runs/rq1_abc{abc}.json', src)
        cells.append({'abc': abc, **row})
    seeds = []
    for s in range(42, 47):
        _, row = dqn_eval(f'final_dqn/overnight/dqn_3x3_s{s}_eval.json', src)
        seeds.append({'seed': s, **row})
    return {'cells': cells, 'default_111_seeds': seeds}


def boards(src):
    rows = []
    for rel in ('final_dqn/overnight/dqn_3x3_s42_eval.json', 'final_dqn/overnight/dqn_4x4_s42_eval.json',
                'final_dqn/overnight/dqn_5x5_s42_2M_eval.json', 'final_dqn/overnight/dqn_9x9_s42_5M_eval.json'):
        doc, row = dqn_eval(rel, src)
        row['rules'] = doc['rules']
        rows.append(row)
    return rows


def build():
    src = Sources()
    data = {
        'generated_by': 'scripts/export_web_findings.py',
        'solve': solve_cells(src),
        'hop_rule_change': hop_rule_change(src),
        'ablation': ablation(src),
        'hop_scorer': hop_scorer(src),
        'h1': h1(src),
        'h2': h2(src),
        'h3': h3(src),
        'rq1': rq1(src),
        'dqn_by_board': boards(src),
    }
    data['sources'] = dict(sorted(src.table.items()))
    return data


def render(data):
    return json.dumps(data, indent=1, sort_keys=False) + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='fail if the committed JSON differs')
    args = ap.parse_args()
    text = render(build())
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != text:
            print(f'{OUT.relative_to(ROOT)} is stale: run python scripts/export_web_findings.py', file=sys.stderr)
            return 1
        print('findings.json is up to date')
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding='utf-8')
    print('wrote', OUT.relative_to(ROOT), f'({len(text) // 1024} KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
