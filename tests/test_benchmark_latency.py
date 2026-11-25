"""Smoke test for scripts/benchmark_latency.py on the 3x3 release model."""
try:
    import pytest
except ImportError as exc:
    import unittest
    raise unittest.SkipTest(f"pytest required: {exc}") from exc

pytest.importorskip("torch")

from scripts.benchmark_latency import benchmark  # noqa: E402


def test_benchmark_latency_smoke():
    res = benchmark('checkpoints/release/dqn_3x3', agents=['dqn', 'greedy'], positions=5, repeats=2, warmup=1)
    assert res['model']['N'] == 3
    for spec in ('dqn', 'greedy'):
        r = res['agents'][spec]
        assert r['decisions'] == 10
        assert 0 < r['median_ms'] <= r['p95_ms'] <= r['max_ms']
