import React from 'react';
import { Link } from 'react-router-dom';
import { GameState } from '../api/types';
import { Board } from '../components/Board';
import { SolveGrid } from '../components/SolveGrid';
import exampleState from '../data/example_state.json';
import { abcLabel, findings } from '../lib/findings';
import { presetQuery } from '../lib/presets';

// Static content: the model and methods. Rendered without the backend (no API calls).
const example = exampleState as unknown as GameState;
const solved = findings.solve.filter((c) => c.complete);
const pilot = (n: number, abc: string) => findings.hop_rule_change.find((c) => c.n === n && c.abc === abc)!;
const pilotPairs = ['000', '001', '100', '101'].map((off) => {
  const on = off[0] + '1' + off[2];
  return { n: 3, off: pilot(3, off), on: pilot(3, on) };
});

const STATE = [
  ['Pawns', 'the two pawn positions; each pawn races to the far row'],
  ['Walls', 'every wall with its owner, and each player’s latest wall (the only one REPLACE may move)'],
  ['Walls left', 'each player’s remaining budget out of M'],
  ['Hop, block', 'whether each player still has the once-per-game HOP and BLOCK'],
  ['Block timers', 'the plies left on each blocked cell (K when placed, one less every ply)'],
  ['To move', 'whose turn it is; the position history is kept only for the repetition rule'],
];

const ACTIONS = [
  ['MOVE', 'One orthogonal step; not across a wall, onto the other pawn, onto a blocked cell or off the board.'],
  ['WALL', 'Place a 2-cell wall; costs one of M walls and becomes your latest wall.'],
  ['REPLACE (A)', 'Move your latest wall to another slot; costs nothing, allowed with 0 walls left.'],
  ['HOP (B)', 'Once per game, one step across a wall your opponent owns.'],
  ['BLOCK (C)', 'Once per game, make an empty cell impassable for exactly K plies.'],
];

const AGENTS: { spec: string; decides: string; knows: string; unknown: string }[] = [
  { spec: 'greedy', decides: 'the action with the best one-ply score', knows: 'the rules; the distance score H = d_opp − d_self', unknown: 'what happens beyond one ply' },
  { spec: 'minimax:depth=2', decides: 'the best action by depth-limited alpha-beta search', knows: 'the rules; a distance score at the leaves', unknown: 'true values beyond its depth; under a time limit, how deep it will get' },
  { spec: 'exact', decides: 'an action that keeps the true value', knows: 'the whole game graph and every position’s value (small boards only)', unknown: 'nothing: it is the ground truth' },
  { spec: 'dqn', decides: 'the legal action with the highest learned Q-value', knows: 'the legal actions and the reward at the end of a game', unknown: 'the true values, the transition model and any score: it learns from self-play' },
];

const REFERENCES = [
  'M. L. Littman. Markov games as a framework for multi-agent reinforcement learning. ICML, 1994.',
  'R. S. Sutton and A. G. Barto. Reinforcement Learning: An Introduction, 2nd ed. MIT Press, 2018.',
  'V. Mnih et al. Human-level control through deep reinforcement learning. Nature 518:529–533, 2015.',
  'H. van Hasselt, A. Guez and D. Silver. Deep reinforcement learning with double Q-learning. AAAI, 2016.',
  'S. Huang and S. Ontañón. A closer look at invalid action masking in policy gradient algorithms. FLAIRS, 2022.',
  'D. Silver et al. A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play. Science 362:1140–1144, 2018.',
  'L. V. Allis. Searching for Solutions in Games and Artificial Intelligence. PhD thesis, Vrije Universiteit Amsterdam, 1994.',
  'D. E. Knuth and R. W. Moore. An analysis of alpha-beta pruning. Artificial Intelligence 6(4):293–326, 1975.',
];

export const MethodPage: React.FC = () => (
  <div className="main-content method" data-testid="method-page">
    <header className="results-intro">
      <h1>How it works</h1>
      <p className="home-lede">
        Modified Wallz is a finite, deterministic, two-player zero-sum game with perfect information: an extensive-form game, or
        equivalently a two-player zero-sum Markov game with deterministic transitions. Every agent sees the whole state. What
        none of them is given is <b>the value of a position</b>: search estimates it, the DQN learns it, the solver computes it.
      </p>
    </header>

    <section className="home-section" aria-labelledby="model-title">
      <h2 id="model-title">The game as a model</h2>
      <div className="method-model">
        <figure className="method-fig">
          <Board state={example} interactive={false} showPaths className="fig-board" />
          <figcaption className="fig-caption">
            <b>Example position</b> (5×5, K = 3, M = 2). P0’s older wall is permanent; its latest wall (marked) can still be moved by
            REPLACE; the centre cell is blocked for 2 more plies; P0 has no walls left; P1 is to move.
          </figcaption>
        </figure>
        <div>
          <h3>State</h3>
          <dl className="method-dl">
            {STATE.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>Actions</h3>
          <dl className="method-dl">
            {ACTIONS.map(([k, v]) => (
              <div key={k}>
                <dt>
                  <code>{k}</code>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p>
            Every action must leave both pawns a path to their goal rows. <b>Payoffs:</b> reaching the goal row gives +1 to the mover
            and −1 to the opponent. A player with no legal action, or a position repeated five times, is a <b>draw</b> (0 each). The
            200-ply stop used in experiments is recorded as <b>truncated</b>: its own outcome, not a draw.
          </p>
        </div>
      </div>
    </section>

    <section className="home-section" aria-labelledby="agents-title">
      <h2 id="agents-title">The agents: what each decides and knows</h2>
      <div className="results-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Decides</th>
              <th scope="col">Knows</th>
              <th scope="col">Does not know</th>
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((a) => (
              <tr key={a.spec}>
                <th scope="row">{a.spec === 'minimax:depth=2' ? 'Minimax' : a.spec === 'exact' ? 'Exact solver' : a.spec === 'dqn' ? 'DQN' : 'Greedy'}</th>
                <td>{a.decides}</td>
                <td>{a.knows}</td>
                <td>{a.unknown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">A Random agent is also available as the floor every other agent is measured against.</p>
    </section>

    <section className="home-section" aria-labelledby="solver-title">
      <h2 id="solver-title">The exact solver: ground truth on small boards</h2>
      <p className="method-text">
        The solver builds every position reachable from the start, using only the engine’s own move generator, then labels each
        one WIN, LOSS or DRAW for the player to move by backward propagation from the terminal positions. It also records how
        many plies the result takes under best play. Positions that can cycle forever without a result are draws. A graph that
        hits the size cap is reported as unknown, never as a draw. It solved {solved.length} of {findings.solve.length} small
        settings.
      </p>
      <SolveGrid />
      <aside className="method-callout" aria-labelledby="hop-title">
        <h3 id="hop-title">Design decision: the solver caught a broken rule</h3>
        <p>
          The proposal defined the hop as a 2-cell jump over an opponent’s wall or pawn. Solving the small boards under that rule
          showed that switching the hop on flipped the result to the other player within a few plies in every setting, even
          with no walls:
        </p>
        <ul className="results-list">
          {pilotPairs.map(({ off, on }) => (
            <li key={off.abc}>
              3×3, rules {abcLabel(off.abc)}: {off.root} in {off.rank} → with the old hop, <b>{on.root} in {on.rank}</b>
            </li>
          ))}
        </ul>
        <p>
          A one-move forced win makes a game uninteresting to study, so the hop became a 1-cell step across an opponent-owned
          wall. Results made under the old rule are not used. <Link to={'/play' + presetQuery({ n: 3, k: 1, m: 0, abc: '010', p1: 'exact' })}>Play today’s hop against the solver</Link>.
        </p>
      </aside>
    </section>

    <section className="home-section" aria-labelledby="dqn-title">
      <h2 id="dqn-title">The learning agent: self-play Double DQN</h2>
      <ul className="method-points">
        <li><b>Input.</b> 14 board planes from the mover’s point of view: pawns, walls, the latest walls, block timers and goal rows.</li>
        <li><b>Network.</b> Four 64-channel convolution layers and a 256-unit layer output one Q-value per action id; the action space has 4(N−1)² + N² + 8 ids (33 on 3×3, 97 on 5×5).</li>
        <li><b>Legal-action mask.</b> The arg-max runs only over legal actions, so the agent never has to learn which moves are illegal. The mask matches the engine’s validator on every id checked.</li>
        <li><b>Learning.</b> Negamax Double-DQN target with Huber loss: the value of a position is minus the opponent’s best value after the move. Reward is sparse: +1 or −1 at the end of a game, γ = 0.99.</li>
        <li><b>Self-play.</b> Opponents are the current network, older snapshots and Greedy, so the agent keeps meeting new strategies instead of one fixed opponent.</li>
      </ul>
    </section>

    <section className="home-section" aria-labelledby="eval-title">
      <h2 id="eval-title">How the agents are evaluated</h2>
      <ul className="method-points">
        <li><b>Distinct openings.</b> Greedy, untimed Minimax and the DQN are deterministic, so a game is fixed by its opening. Games start from random short openings, and each distinct opening is played once in each seat; sample sizes count distinct games.</li>
        <li><b>Intervals and tests.</b> Win rates carry Wilson 95% intervals. Ablation effects use a paired bootstrap over openings with Holm correction over the 7 effects.</li>
        <li><b>Against the truth.</b> On solved boards the DQN is scored on every position: how often its action keeps the true value, and how far its value estimate is from the discounted true value.</li>
        <li><b>One engine.</b> The solver, every agent and this site call the same frozen engine; recorded games are replayed through it before they are shown.</li>
      </ul>
      <p className="muted">
        The hypotheses and their verdicts are on <Link to="/results">Results</Link>.
      </p>
    </section>

    <section className="home-section" aria-labelledby="refs-title">
      <h2 id="refs-title">References</h2>
      <ol className="method-refs">
        {REFERENCES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </section>
  </div>
);
