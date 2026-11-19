import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AgentInfo, GameConfig } from '../api/types';

const BOARD_SIZES = [3, 4, 5, 7, 9];

/* ---------- Figures A, B, C: illustrations of the three rule changes ---------- */

const C = 34; // cell
const G = 8; // gap
const O = 10; // outer margin
const at = (i: number) => O + i * (C + G);
const SIZE = O * 2 + 3 * C + 2 * G;

const Grid: React.FC<{ hatch?: [number, number] }> = ({ hatch }) => (
  <>
    <rect className="bd-plate" x={O - 5} y={O - 5} width={SIZE - 2 * O + 10} height={SIZE - 2 * O + 10} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} className="bd-cell" x={at(c)} y={at(r)} width={C} height={C} />
      ))
    )}
    {hatch && <rect x={at(hatch[1])} y={at(hatch[0])} width={C} height={C} fill="url(#home-hatch)" />}
  </>
);

const Pawn: React.FC<{ r: number; c: number; p: 0 | 1 }> = ({ r, c, p }) => (
  <g>
    <circle className={`bd-pawn p${p}`} cx={at(c) + C / 2} cy={at(r) + C / 2} r={12} />
    <text className="bd-pawn-label" x={at(c) + C / 2} y={at(r) + C / 2 + 4} textAnchor="middle" style={{ fontSize: 10 }}>
      {`P${p}`}
    </text>
  </g>
);

// Horizontal wall under row r, spanning columns c and c+1
const hWall = (r: number, c: number) => ({ x: at(c), y: at(r) + C + 1, width: 2 * C + G, height: G - 2 });

const FigureA: React.FC = () => (
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="home-fig-svg" role="img" aria-label="Your latest wall moves from one slot to another">
    <Grid />
    <rect {...hWall(0, 0)} className="bd-wall p0" opacity={0.25} />
    <rect {...hWall(1, 1)} className="bd-wall p0 latest" />
    <path d={`M ${at(1)} ${at(0) + C + 4} C ${at(1) + 10} ${at(1) + 6}, ${at(1) + 20} ${at(1) + 14}, ${at(1) + 26} ${at(1) + C - 2}`} className="home-arrow" markerEnd="url(#home-head)" />
    <Pawn r={2} c={1} p={0} />
  </svg>
);

const FigureB: React.FC = () => (
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="home-fig-svg" role="img" aria-label="Player 0 hops across the opponent's wall into the cell behind it">
    <Grid />
    <rect {...hWall(1, 0)} className="bd-wall p1" />
    <line className="bd-wall-mark" x1={at(0) + 4} y1={at(1) + C + 4} x2={at(1) + C - 4} y2={at(1) + C + 4} />
    <rect className="bd-cell target" x={at(1)} y={at(1)} width={C} height={C} />
    <Pawn r={2} c={1} p={0} />
    <path d={`M ${at(1) + C / 2 + 8} ${at(2) + 6} C ${at(2) + 10} ${at(2) - 4}, ${at(2) + 10} ${at(1) + C}, ${at(1) + C / 2 + 8} ${at(1) + C - 6}`} className="home-arrow" markerEnd="url(#home-head)" />
  </svg>
);

const FigureC: React.FC = () => (
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="home-fig-svg" role="img" aria-label="An empty cell blocked for three plies">
    <Grid hatch={[1, 1]} />
    <circle className="bd-badge" cx={at(1) + C - 8} cy={at(1) + 8} r={8} />
    <text className="bd-badge-text" x={at(1) + C - 8} y={at(1) + 12} textAnchor="middle" style={{ fontSize: 11 }}>
      3
    </text>
    <Pawn r={2} c={1} p={0} />
    <Pawn r={0} c={1} p={1} />
  </svg>
);

/* ---------- Content ---------- */

const VIEWS = [
  { to: '/play', name: 'Play', what: 'Play a full game against any agent. After each of its moves, its reasoning is written out as a worked step.' },
  { to: '/arena', name: 'Arena', what: 'Set two agents against each other, watch one game, or play a batch and read the win rates.' },
  { to: '/replays', name: 'Replays', what: 'Step through the study’s recorded games. Each one is replayed through the engine and checked move by move.' },
  { to: '/rules', name: 'Rules', what: 'Nine short scenarios that show each rule in action. Any of them can be continued as a live game.' },
  { to: '/training', name: 'Training', what: 'The DQN training runs: network details, learning curves where logs exist, and a short live training demo.' },
];

const AGENTS = [
  { name: 'Greedy', how: 'Looks one move ahead and plays the action with the largest gap between the opponent’s shortest path and its own.' },
  { name: 'Minimax', how: 'Searches several moves ahead with alpha-beta pruning, assuming the opponent always replies with its best move.' },
  { name: 'Exact solver', how: 'Builds the complete game graph of a small board and solves every position, so it always knows the true result.' },
  { name: 'DQN', how: 'A Double-DQN neural network trained by self-play that picks the action with the highest predicted value.' },
];

// Final-rule results only (README "Status and results"; stale numbers excluded, see STALE.md)
const RESULTS = [
  {
    figure: '60 of 100',
    claim: 'On a 5×5 board, Greedy beat depth-2 Minimax in 60 of 100 games. Minimax won 39 (39%, 95% CI 30.0–48.8%), with 1 draw.',
    source: 'experiments/results/final_minimax/vs_greedy_N5_open4_distinct_summary.json',
    report: 'docs/reports/stage2_minimax.md',
  },
  {
    figure: '+11 points',
    claim: 'A hop-aware evaluation raised depth-2 Minimax’s win rate against Greedy from 39% to 50% on the same openings (paired 95% CI +1 to +21 points).',
    source: 'experiments/results/final_minimax_hop/',
    report: 'docs/reports/stage3_minimax_hop_eval.md',
  },
  {
    figure: '96.2%',
    claim: 'Retrained 3×3 DQN models choose a value-optimal action in 96.2% of non-terminal positions (mean of 5 seeds, range 96.0–96.5%). The older release model: 78.0%.',
    source: 'experiments/results/final_dqn/aggregate_3x3_seeds.json',
    report: 'docs/reports/stage2_dqn.md',
  },
  {
    figure: '−0.18',
    claim: 'In a 2×2×2 ablation of the three rules on 5×5, only the hop (Rule B) survives Holm correction: it lowers Minimax’s win rate against Greedy by about 0.18.',
    source: 'experiments/results/final_eval/ablation_N5_K3_M10_open4/summary.json',
    report: 'docs/reports/stage2_solver_stats.md',
  },
  {
    figure: '28 of 32',
    claim: 'The exact solver fully solved 28 of 32 small settings: 3×3 and 4×4 boards with 0 or 1 walls, under every on/off combination of the three rules. Four 4×4 settings hit the size cap.',
    source: 'experiments/results/final_eval/solve_N*_K1_M*.json',
    report: 'docs/reports/stage2_solver_stats.md',
  },
];

/* ---------- Page ---------- */

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [baseConfig, setBaseConfig] = useState<GameConfig>({ board_size: 5, A: true, B: true, C: true, K: 3, M: 10 });
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [opponent, setOpponent] = useState('greedy');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchConfigDefaults().then((res) => res.defaults && setBaseConfig((prev) => ({ ...prev, ...res.defaults }))).catch(() => {});
  }, []);

  useEffect(() => {
    api.fetchAgents(baseConfig)
      .then((list) => {
        const usable = list.filter((a) => a.available && a.family !== 'human');
        setAgents(usable);
        if (!usable.some((a) => a.spec === opponent) && usable[0]) setOpponent(usable[0].spec);
      })
      .catch(() => setAgents([]));
  }, [baseConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const created = await api.createGame(baseConfig, 'human', opponent);
      navigate('/play', { state: { sessionId: created.id } });
    } catch (err: any) {
      setError(err?.data?.error || err.message || 'The server could not start a game.');
      setStarting(false);
    }
  };

  return (
    <div className="main-content home" data-testid="home-page">
      <section className="home-hero">
        <div className="home-intro">
          <h1>Quoridor, changed three ways, and four AI agents that play it.</h1>
          <p className="home-lede">
            A CS 329 study of how different decision-makers handle an adversarial race to the far side of the board.
            Play the agents yourself, watch them play each other, and check every result against one frozen game engine.
          </p>
        </div>

        <div className="home-rules">
          <div className="home-figs">
            <figure>
              <FigureA />
              <figcaption>
                <b>A · Reusable walls</b><span className="fig-desc">Move your most recent wall to another slot. It costs nothing, even with no walls left.</span>
              </figcaption>
            </figure>
            <figure>
              <FigureB />
              <figcaption>
                <b>B · One-time hop</b><span className="fig-desc">Once per game, step across a wall your opponent placed, into the cell behind it.</span>
              </figcaption>
            </figure>
            <figure>
              <FigureC />
              <figcaption>
                <b>C · Temporary block</b><span className="fig-desc">Once per game, close an empty cell for <i className="math">K</i> plies (3 by default).</span>
              </figcaption>
            </figure>
          </div>
          <p className="home-base">
            Everything else is Quoridor: move one step, or place a wall, and be first to reach the far row. Every move must
            leave both pawns a path to their goal.
          </p>
        </div>

        <form className="home-start" onSubmit={start} aria-labelledby="start-title">
          <h2 id="start-title">Play against an agent</h2>
          <p className="muted">You are the blue pawn, racing to the far row. The agent explains every move it makes.</p>
          <div className="home-fields">
          <div>
          <label className="form-label" htmlFor="home-opponent">
            Opponent
          </label>
          <select id="home-opponent" className="form-select" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
            {agents.length === 0 && <option value="greedy">Greedy</option>}
            {agents.map((a) => (
              <option key={a.spec} value={a.spec}>
                {a.label}
              </option>
            ))}
          </select>
          </div>
          <div>
          <label className="form-label" htmlFor="home-board">
            Board <span className="muted">(all 3 rules)</span>
          </label>
          <select
            id="home-board"
            className="form-select"
            value={baseConfig.board_size}
            onChange={(e) => setBaseConfig({ ...baseConfig, board_size: Number(e.target.value) })}
          >
            {BOARD_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} × {n}
              </option>
            ))}
          </select>
          </div>
          </div>
          <button className="btn btn-primary home-go" type="submit" disabled={starting}>
            {starting ? 'Setting up the board…' : 'Start a game'}
          </button>
          {error && (
            <p className="home-error" role="alert">
              {error} Check that the Flask server is running.
            </p>
          )}
          <Link className="home-alt" to="/rules">
            New to the game? Step through the rules first
          </Link>
        </form>
      </section>

      <section className="home-section" aria-labelledby="use-title">
        <h2 id="use-title">How to use this site</h2>
        <ol className="home-views">
          {VIEWS.map((v) => (
            <li key={v.to}>
              <Link to={v.to}>{v.name}</Link>
              <p>{v.what}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section" aria-labelledby="agents-title">
        <h2 id="agents-title">The four agents</h2>
        <dl className="home-agents">
          {AGENTS.map((a) => (
            <div key={a.name}>
              <dt>{a.name}</dt>
              <dd>{a.how}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">A random agent is also available as a baseline.</p>
      </section>

      <section className="home-section" aria-labelledby="results-title">
        <h2 id="results-title">What the study found</h2>
        <p className="home-note">
          Final-rule results only, each with the file it comes from. Older numbers made under earlier rules are listed in{' '}
          <code>experiments/results/STALE.md</code> and are not shown here.
        </p>
        <ol className="home-results">
          {RESULTS.map((r, i) => (
            <li key={r.source}>
              <span className="home-rn">Result {i + 1}</span>
              <span className="home-rfig">{r.figure}</span>
              <p>{r.claim}</p>
              <p className="home-src">
                <code>{r.source}</code> · <code>{r.report}</code>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section home-trust" aria-labelledby="trust-title">
        <h2 id="trust-title">Why the numbers can be trusted</h2>
        <ul>
          <li>
            <b>One engine.</b> <code>wallz_engine.py</code> is the only source of the rules. It was frozen at commit{' '}
            <code>ce55e0c</code> and has not changed since.
          </li>
          <li>
            <b>No rules in the browser.</b> Every legal move, timer and result on this site is sent by the engine; the page
            only draws it.
          </li>
          <li>
            <b>Replays are re-checked.</b> Recorded games are replayed through the engine move by move before they are shown.
          </li>
        </ul>
      </section>

      <footer className="home-foot">
        CS 329 · Foundations of AI / Multi-Agent Systems · IIT Gandhinagar. Full rules: <code>docs/game_rules.md</code>.
      </footer>

      {/* Shared arrow and hatch definitions for the figures */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <marker id="home-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--graphite)" />
          </marker>
          <pattern id="home-hatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line className="bd-hatch" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
};
