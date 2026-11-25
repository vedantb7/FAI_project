"""Opt-in DQN options: observation v2 (wall-owner planes), explicit conv widths, MSE loss,
heuristic warm-up, and checkpoint round trips. Defaults (obs v1, 64x4 conv, Huber, no warm-up)
are covered by the existing DQN tests."""
import random
import tempfile
import unittest

try:
    import numpy as np
    import torch

    from agents.dqn.agent import load_checkpoint, save_checkpoint
    from agents.dqn.encoding import encode_observation, mirror_observation, num_planes
    from agents.dqn.self_play import SelfPlayManager
    from agents.dqn.trainer import DQNConfig, DQNTrainer
    from tests.test_action_codec import mirror_engine
except ImportError:
    DEPS_AVAILABLE = False
else:
    DEPS_AVAILABLE = True

from wallz_engine import WallzEngine


def _played(n=5, plies=10, seed=0):
    rng = random.Random(seed)
    e = WallzEngine(board_size=n, rules={'A': True, 'B': True, 'C': True, 'K': 3, 'M': 6})
    for _ in range(plies):
        walls = [a for a in e.get_legal_actions() if a[0] == 'WALL']
        legal = walls or e.get_legal_actions()
        if e.is_terminal() or not legal:
            break
        e.apply_action(rng.choice(legal), update_clock=False)
    return e


@unittest.skipUnless(DEPS_AVAILABLE, "PyTorch and NumPy required")
class TestObsV2(unittest.TestCase):
    def test_v1_unchanged_and_v2_extends_it(self):
        for seed in range(5):
            e = _played(seed=seed)
            for mover in (0, 1):
                v1 = encode_observation(e, mover=mover)
                v2 = encode_observation(e, mover=mover, obs_version=2)
                self.assertEqual(v1.shape[0], 14)
                self.assertEqual(v2.shape[0], 16)
                np.testing.assert_array_equal(v1, v2[:14])

    def test_owner_planes_partition_the_walls(self):
        e = _played(plies=12)
        self.assertTrue(e.walls[0] and e.walls[1])
        for mover in (0, 1):
            v2 = encode_observation(e, mover=mover, obs_version=2)
            n = e.board_size
            for p, ch in ((mover, 14), (1 - mover, 15)):
                cells = {(wr if mover == 0 else n - 2 - wr, wc) for wr, wc, _ in e.walls[p]}
                got = {(int(r), int(c)) for r, c in zip(*np.nonzero(v2[ch]))}
                self.assertEqual(got, cells)
            # every wall is in exactly one owner plane, and in one orientation plane
            np.testing.assert_array_equal(v2[14] + v2[15], v2[2] + v2[3])

    def test_role_swap_flips_owner_planes(self):
        e = _played(plies=12)
        a = encode_observation(e, mover=0, obs_version=2)
        b = encode_observation(e, mover=1, obs_version=2)
        n = e.board_size
        # mover 1's view is mover 0's view with rows flipped and owners swapped
        np.testing.assert_array_equal(a[14, :n - 1], b[15, :n - 1][::-1])

    def test_mirror_v2_matches_mirrored_engine(self):
        for seed in range(3):
            e = _played(seed=seed)
            m = mirror_engine(e)
            for mover in (0, 1):
                np.testing.assert_array_equal(
                    mirror_observation(encode_observation(e, mover=mover, obs_version=2)),
                    encode_observation(m, mover=mover, obs_version=2))

    def test_unknown_version(self):
        with self.assertRaises(ValueError):
            num_planes(3)


@unittest.skipUnless(DEPS_AVAILABLE, "PyTorch and NumPy required")
class TestTrainerOptions(unittest.TestCase):
    def _trainer(self, **kw):
        cfg = DQNConfig(board_size=3, rules={'A': True, 'B': True, 'C': True, 'K': 1, 'M': 1},
                        buffer_capacity=500, min_buffer_size=32, batch_size=32, device='cpu', **kw)
        return DQNTrainer(cfg)

    def test_conv_channels_and_v2_shapes(self):
        t = self._trainer(conv_channels=[32, 64, 64], obs_version=2)
        widths = [m.out_channels for m in t.online_net.conv if isinstance(m, torch.nn.Conv2d)]
        self.assertEqual(widths, [32, 64, 64])
        self.assertEqual(t.online_net.conv[0].in_channels, 16)
        self.assertEqual(t.buffer.obs.shape[1], 16)

    def test_mse_loss_and_unknown_loss(self):
        self.assertIsInstance(self._trainer(loss='mse').loss_fn, torch.nn.MSELoss)
        with self.assertRaises(ValueError):
            self._trainer(loss='nope')

    def test_warmup_moves_are_greedy(self):
        t = self._trainer(warmup_steps=10_000)
        sp = SelfPlayManager(t, mixture=(1.0, 0.0, 0.0))
        calls = []
        orig = t.select_action
        t.select_action = lambda *a, **k: calls.append(1) or orig(*a, **k)
        for _ in range(5):
            sp.run_episode()
        self.assertEqual(calls, [])          # no network/epsilon move during warm-up
        self.assertGreater(len(t.buffer), 0)

    def test_v2_checkpoint_round_trip(self):
        t = self._trainer(conv_channels=[32, 64, 64], obs_version=2)
        meta = {'N': 3, 'rules': t.config.rules, 'channels': 64, 'blocks': 3, 'hidden': 256,
                'dueling': False, 'obs_version': 2, 'conv_channels': [32, 64, 64], 'commit': 'test'}
        with tempfile.TemporaryDirectory() as d:
            save_checkpoint(d, t.online_net, meta, filename='model.pt')
            agent = load_checkpoint(d, player_id=0, device='cpu')
            self.assertEqual(agent.obs_version, 2)
            e = WallzEngine(board_size=3, rules=t.config.rules)
            self.assertIn(agent.select_action(e), e.get_legal_actions())

    def test_released_v1_models_still_load_and_play(self):
        for n in (3, 4, 5):
            agent = load_checkpoint(f'checkpoints/release/dqn_{n}x{n}/model.pt', device='cpu')
            self.assertEqual(agent.obs_version, 1)
            e = WallzEngine(board_size=n, rules=agent.rules)
            self.assertIn(agent.select_action(e), e.get_legal_actions())


if __name__ == '__main__':
    unittest.main()
