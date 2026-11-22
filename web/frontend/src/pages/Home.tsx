import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { AgentInfo, GameConfig } from '../api/types';
import { findings, pct, range, source } from '../lib/findings';
import { presetQuery } from '../lib/presets';

const BOARD_SIZES = [3, 4, 5, 9];

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

const JOURNEY = [
  { to: '/rules', step: 'Learn', what: 'Nine short scenarios show each rule in action. Any of them can be continued as a live game.' },
  { to: '/play', step: 'Play', what: 'Play a full game against any agent. After each of its moves, its reasoning is written out.' },
  { to: '/results', step: 'Check', what: 'Each hypothesis with its verdict, chart and source file, and a link to try it yourself.' },
];

const AGENTS = [
  { name: 'Greedy', how: 'Looks one move ahead and plays the action with the largest gap between the opponent’s shortest path and its own.' },
  { name: 'Minimax', how: 'Searches several moves ahead with alpha-beta pruning, assuming the opponent always replies with its best move.' },
  { name: 'Exact solver', how: 'Builds the complete game graph of a small board and solves every position, so it always knows the true result.' },
  { name: 'DQN', how: 'A Double-DQN neural network trained by self-play that picks the action with the highest predicted value.' },
];

/* Headline findings, computed from data/findings.json (generated from experiments/results/). */
const hopEffect = findings.ablation.win_rate_effects.find((e) => e.name === 'B')!;
const holmSurvivors = findings.ablation.win_rate_effects.filter((e) => e.holm).map((e) => e.name);
const h1Cell = (abc: string) => findings.h1.cells.find((c) => c.abc === abc)!;
const seeds3x3 = findings.rq1.default_111_seeds;
const h3Final500k = findings.h3.runs.filter((r) => r.board === 3 && r.budget === 500000).map((r) => r.final);
const solved = findings.solve.filter((c) => c.complete);
const largestCell = solved.reduce((a, c) => (c.states > a.states ? c : a));
const largestSolved = largestCell.states;
const pilot = (n: number, abc: string) => findings.hop_rule_change.find((c) => c.n === n && c.abc === abc)!;

interface Headline {
  id: string;
  figure: string;
  claim: string;
  sourceId: string;
  tryIt: string;
  tryLabel: string;
}

const HEADLINES: Headline[] = [
  {
    id: 'ablation',
    figure: `${hopEffect.estimate.toFixed(3)}`,
    claim:
      `The hop decides results. In a 2×2×2 ablation on 5×5 (${findings.ablation.matches} matches), ` +
      `${holmSurvivors.length === 1 ? 'only the hop (rule B) changes' : 'the hop changes'} Minimax’s win rate against Greedy after Holm correction: ` +
      `${hopEffect.estimate.toFixed(3)} (95% CI ${hopEffect.ci95[0].toFixed(3)} to ${hopEffect.ci95[1].toFixed(3)}).`,
    sourceId: findings.ablation.source,
    tryIt: '/play' + presetQuery({ n: 5, k: 3, m: 10, abc: '010', p0: 'minimax:depth=2', p1: 'greedy' }),
    tryLabel: 'Watch Minimax vs Greedy with the hop on',
  },
  {
    id: 'h1',
    figure: `+${Math.round(h1Cell('100').branching_pct)}%`,
    claim:
      `Reusable walls and blocks make the game harder to search. REPLACE raises the number of legal actions by ` +
      `${Math.round(h1Cell('100').branching_pct)}% and BLOCK by ${Math.round(h1Cell('001').branching_pct)}%; in ` +
      `${findings.h1.time_limit_s} s Minimax completes ${Math.abs(h1Cell('100').depth_change).toFixed(1)} and ` +
      `${Math.abs(h1Cell('001').depth_change).toFixed(1)} fewer plies.`,
    sourceId: findings.h1.source,
    tryIt: '/play' + presetQuery({ n: 5, k: 3, m: 10, abc: '101', p1: 'minimax:depth=2' }),
    tryLabel: 'Play Minimax with REPLACE and BLOCK on',
  },
  {
    id: 'rq3',
    figure: pct(seeds3x3.reduce((s, x) => s + (x.value_optimal ?? 0), 0) / seeds3x3.length, 0),
    claim:
      `A self-play DQN that is never told what a position is worth learns it. On 3×3 it keeps the exact game value in ` +
      `${range(seeds3x3.map((s) => 100 * (s.value_optimal ?? 0)), 1)}% of ${seeds3x3[0].states?.toLocaleString()} positions (5 seeds), ` +
      `and at 500k steps its value error ends below ${findings.h3.threshold} on every seed (${range(h3Final500k)}).`,
    sourceId: seeds3x3[0].source,
    tryIt: '/play' + presetQuery({ n: 3, k: 1, m: 1, abc: '111', p1: 'dqn' }),
    tryLabel: 'Play the 3×3 DQN',
  },
  {
    id: 'hop-rule',
    figure: 'Forced win',
    claim:
      `The exact solver caught a broken rule. Under the proposal’s 2-cell hop, turning the hop on flipped the solved result ` +
      `in every setting, even with no walls (3×3: ${pilot(3, '000').root} in ${pilot(3, '000').rank} became ` +
      `${pilot(3, '010').root} in ${pilot(3, '010').rank}). The hop was changed to a 1-cell step.`,
    sourceId: pilot(3, '000').source,
    tryIt: '/play' + presetQuery({ n: 3, k: 1, m: 0, abc: '010', p1: 'exact' }),
    tryLabel: 'Play the exact solver with today’s hop',
  },
  {
    id: 'solve',
    figure: `${solved.length} of ${findings.solve.length}`,
    claim:
      `Exact ground truth: the solver fully solved ${solved.length} of ${findings.solve.length} small settings ` +
      `(3×3 and 4×4, up to 2 walls each, every rule combination), the largest with ${largestSolved.toLocaleString()} positions. ` +
      `The rest exceed the size cap and are reported as unknown, never guessed.`,
    sourceId: largestCell.source,
    tryIt: '/play' + presetQuery({ n: 3, k: 1, m: 1, abc: '111', p1: 'exact' }),
    tryLabel: 'Play a solved board against the solver',
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

  const [loadingAgents, setLoadingAgents] = useState(true);

  // The opponent list depends on the board: refetch on every board change and ignore late answers
  useEffect(() => {
    let live = true;
    setLoadingAgents(true);
    api.fetchAgents(baseConfig)
      .then((list) => {
        if (!live) return;
        const usable = list.filter((a) => a.available && a.family !== 'human');
        setAgents(usable);
        if (!usable.some((a) => a.spec === opponent) && usable[0]) setOpponent(usable[0].spec);
      })
      .catch(() => live && setAgents([]))
      .finally(() => live && setLoadingAgents(false));
    return () => {
      live = false;
    };
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
            A CS 329 (Foundations of AI: Multiagent Systems) study of how different decision-makers handle an adversarial race to the far side of the board.
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
              <label className="form-label" htmlFor="home-board">
                1 · Board <span className="muted">(all 3 rules)</span>
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
            <div>
              <label className="form-label" htmlFor="home-opponent">
                2 · Opponent <span className="muted">(agents for {baseConfig.board_size} × {baseConfig.board_size})</span>
              </label>
              <select
                id="home-opponent"
                className="form-select"
                value={opponent}
                disabled={loadingAgents || agents.length === 0}
                onChange={(e) => setOpponent(e.target.value)}
              >
                {loadingAgents && <option value={opponent}>Loading agents…</option>}
                {!loadingAgents && agents.length === 0 && <option value="">No agents (server offline?)</option>}
                {!loadingAgents &&
                  agents.map((a) => (
                    <option key={a.spec} value={a.spec}>
                      {a.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary home-go" type="submit" disabled={starting || loadingAgents || agents.length === 0}>
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

      <section className="home-section" aria-labelledby="question-title">
        <h2 id="question-title">The question</h2>
        <p className="home-question">
          One game, three kinds of decision-maker: a <b>search</b> agent that estimates a position’s value with a hand-made score,
          a <b>learning</b> agent that must discover it from play, and an <b>exact solver</b> that computes it. What do reusable
          walls, a one-time hop and a temporary block change for each of them?
        </p>
        <ol className="home-journey">
          {JOURNEY.map((j) => (
            <li key={j.to}>
              <Link to={j.to}>{j.step}</Link>
              <p>{j.what}</p>
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
          Final-rule results only, generated from the result files by <code>scripts/export_web_findings.py</code>; each shows
          the file and commit it comes from. Older numbers made under earlier rules are listed in{' '}
          <code>experiments/results/STALE.md</code> and are not shown here.
        </p>
        <ol className="home-results">
          {HEADLINES.map((r, i) => {
            const s = source(r.sourceId);
            return (
              <li key={r.id}>
                <span className="home-rn">Result {i + 1}</span>
                <span className="home-rfig">{r.figure}</span>
                <p>{r.claim}</p>
                <p className="home-links">
                  <Link to={`/results#${r.id}`}>Evidence</Link> · <Link to={r.tryIt}>{r.tryLabel}</Link>
                </p>
                <p className="home-src">
                  <code>{s.path}</code> · commit <code>{s.commit}</code>
                </p>
              </li>
            );
          })}
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
        </ul>
      </section>

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
