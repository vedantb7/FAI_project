"""The web showcase's findings.json is generated from experiments/results and is not stale.

The site shows no hand-typed numbers: web/frontend/src/data/findings.json is written by
scripts/export_web_findings.py. This test regenerates it and fails if the committed copy differs,
and checks a few headline values against the final report.
"""
from __future__ import annotations

import json

from scripts.export_web_findings import OUT, build, render


def test_findings_json_is_up_to_date():
    assert OUT.exists(), 'run python scripts/export_web_findings.py'
    assert OUT.read_text(encoding='utf-8') == render(build()), 'run python scripts/export_web_findings.py'


def test_headline_values_match_report():
    data = json.loads(OUT.read_text(encoding='utf-8'))
    effects = {e['name']: e for e in data['ablation']['win_rate_effects']}
    assert effects['B']['estimate'] == -0.175 and effects['B']['holm']
    assert [n for n, e in effects.items() if e['holm']] == ['B']
    h1 = {c['abc']: c for c in data['h1']['cells']}
    assert h1['100']['branching_pct'] >= 40 and h1['001']['branching_pct'] >= 40
    finals = [r['final'] for r in data['h3']['runs'] if r['board'] == 3 and r['budget'] == 500000]
    assert len(finals) == 5 and max(finals) < data['h3']['threshold']


def test_every_section_source_is_listed():
    data = json.loads(OUT.read_text(encoding='utf-8'))
    sources = data['sources']

    def walk(x):
        if isinstance(x, dict):
            if 'source' in x and isinstance(x['source'], str):
                assert x['source'] in sources, x['source']
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk({k: v for k, v in data.items() if k != 'sources'})
    assert all(s['commit'] for s in sources.values())
