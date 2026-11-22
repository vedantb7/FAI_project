"""Greedy order='proposal': the tie order of project_idea.pdf Sec. 4.1.

Immediate win, then max H, max opponent goal distance, min own goal distance, lower index.
The default order is covered by tests/test_greedy.py and the golden replays.
"""
import random
import unittest

from agents.greedy import GreedyAgent
from evaluation.match_runner import MatchConfig, make_agent
from wallz_engine import WallzEngine


def _random_positions(n_positions=40, seed=0):
    rng = random.Random(seed)
    out = []
    while len(out) < n_positions:
        e = WallzEngine(board_size=5, rules={'A': True, 'B': True, 'C': True, 'K': 3, 'M': 10})
        for _ in range(rng.randint(0, 12)):
            legal = e.get_legal_actions(e.current_player)
            if not legal:
                break
            _, winner, is_draw = e.apply_action(rng.choice(legal), update_clock=False)
            if winner is not None or is_draw:
                break
        else:
            out.append(e)
    return out


class TestGreedyProposalOrder(unittest.TestCase):
    def test_choice_maximizes_proposal_key(self):
        for e in _random_positions():
            agent = GreedyAgent(e.current_player, order='proposal')
            rows = agent.score_actions(e)
            choice = agent.select_action(e)
            if any(r['immediate_win'] for r in rows):
                self.assertTrue(next(r for r in rows if r['action'] == choice)['immediate_win'])
                continue
            best = max(rows, key=lambda r: (r['H'],
                                            r['d_opp'] if r['d_opp'] is not None else -float('inf'),
                                            -r['d_self'], r['tie_key']))
            self.assertEqual(choice, best['action'])

    def test_orders_differ_somewhere(self):
        # Otherwise the option would be a no-op.
        diffs = sum(GreedyAgent(e.current_player).select_action(e)
                    != GreedyAgent(e.current_player, order='proposal').select_action(e)
                    for e in _random_positions())
        self.assertGreater(diffs, 0)

    def test_spec_and_unknown_order(self):
        cfg = MatchConfig(board_size=5)
        agent, _ = make_agent('greedy:order=proposal', 0, cfg)
        self.assertEqual(agent.order, 'proposal')
        self.assertEqual(make_agent('greedy', 0, cfg)[0].order, 'default')
        with self.assertRaises(ValueError):
            GreedyAgent(0, order='nope')


if __name__ == '__main__':
    unittest.main()
