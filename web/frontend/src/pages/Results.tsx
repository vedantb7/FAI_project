import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarCompare, ForestPlot, LineSeriesChart } from '../components/charts/Charts';
import { chartTheme } from '../components/charts/chartTheme';
import { FindingCard } from '../components/FindingCard';
import { abcLabel, findings, MatchRow, pct, range } from '../lib/findings';
import { SolveGrid } from '../components/SolveGrid';
import { presetQuery } from '../lib/presets';

// Every number on this page comes from data/findings.json (scripts/export_web_findings.py).
const F = findings;
const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);
const steps = (v: number) => `${Math.round(v / 1000)}k`;

/* ---------- H1 ---------- */
const h1 = F.h1;
const h1Cell = (abc: string) => h1.cells.find((c) => c.abc === abc)!;
const h1Rows = h1.cells.map((c) => ({ cell: abcLabel(c.abc), legal: c.mean_legal, depth: c.mean_depth }));
const h1Holds = h1Cell('100').branching_pct >= h1.threshold_pct && h1Cell('001').branching_pct >= h1.threshold_pct
  && h1Cell('100').depth_change < 0 && h1Cell('001').depth_change < 0;

/* ---------- Ablation ---------- */
const ab = F.ablation;
const hop = ab.win_rate_effects.find((e) => e.name === 'B')!;
const survivors = ab.win_rate_effects.filter((e) => e.holm).map((e) => e.name);

/* ---------- H2 ---------- */
const h2 = F.h2;
const warm = h2.arms.find((a) => a.arm === 'Warm-up')!;
const pure = h2.arms.find((a) => a.arm === 'Pure self-play')!;
const h2Holds = warm.vs_greedy.win_rate >= h2.threshold_warmup && pure.vs_greedy.win_rate <= h2.threshold_pure;
const sameGames = h2.arms.every((a) => a.vs_greedy.win === h2.arms[0].vs_greedy.win && a.vs_greedy.loss === h2.arms[0].vs_greedy.loss);

/* ---------- H3 ---------- */
const h3 = F.h3;
const run4 = h3.runs.find((r) => r.board === 4)!;
const runs500 = h3.runs.filter((r) => r.board === 3 && r.budget === 500000);
const runs200 = h3.runs.filter((r) => r.board === 3 && r.budget === 200000);
const h3Holds = run4.final < h3.threshold && runs500.every((r) => r.final < h3.threshold);
const h3Series = [
  { name: '4×4 (seed 42)', points: run4.curve, color: chartTheme().crimson },
  ...runs500.map((r, i) => ({ name: `3×3 seed ${r.seed}`, points: r.curve, color: chartTheme().ink, dashed: i % 2 === 1 })),
];

/* ---------- H4 ---------- */
const lengthRows = [
  { label: 'All off', plies: ab.length_cell_means['000'] },
  { label: 'A only', plies: ab.length_cell_means['100'] },
  { label: 'B only', plies: ab.length_cell_means['010'] },
  { label: 'C only', plies: ab.length_cell_means['001'] },
  { label: 'Additive prediction', plies: ab.length_additive_prediction },
  { label: 'All on (measured)', plies: ab.length_measured_all_on },
];
const h4Holds = ab.length_measured_all_on > ab.length_additive_prediction;

/* ---------- RQ1 ---------- */
const rq1 = F.rq1;
const seedMae = rq1.default_111_seeds.map((s) => s.mae ?? 0);
const rq1Rows = [
  ...rq1.cells.map((c) => ({ cell: abcLabel(c.abc), error: c.mae ?? 0 })),
  { cell: 'A + B + C (5-seed mean)', error: seedMae.reduce((a, b) => a + b, 0) / seedMae.length },
];
const maeOf = (abc: string) => rq1.cells.find((c) => c.abc === abc)?.mae ?? seedMae.reduce((a, b) => a + b, 0) / seedMae.length;
const pairs = (bit: number) =>
  ['00', '01', '10', '11'].map((rest) => {
    const off = rest.slice(0, bit) + '0' + rest.slice(bit);
    const on = rest.slice(0, bit) + '1' + rest.slice(bit);
    return maeOf(on) - maeOf(off);
  });
const aDiffs = pairs(0);
const cDiffs = pairs(2);
const seedSpread = Math.max(...seedMae) - Math.min(...seedMae);

/* ---------- RQ2 ---------- */
const solveCell = (n: number, m: number, abc: string) => F.solve.find((c) => c.n === n && c.m === m && c.abc === abc)!;
const n3m2Off = solveCell(3, 2, '000');
const n3m2On = solveCell(3, 2, '010');
const hs = F.hop_scorer;

/* ---------- RQ3 ---------- */
const boards = F.dqn_by_board;
const rq3Rows = boards.map((b) => ({ board: `${b.board}×${b.board}`, win: b.vs_greedy.win_rate }));
const truthBoards = boards.filter((b) => b.value_optimal !== null);

/* ---------- Shared: outcome shares, exact solves ---------- */
const shares = (m: MatchRow) => ({ win: m.win / m.games, draw: m.draw / m.games, truncated: m.truncated / m.games, loss: m.loss / m.games });
const outcomeSeries = (rows: MatchRow[]) => {
  const t = chartTheme();
  return [
    { key: 'win', name: 'DQN wins', color: t.ink },
    { key: 'draw', name: 'Draws', color: t.graphiteSoft },
    ...(rows.some((m) => m.truncated > 0) ? [{ key: 'truncated', name: 'Truncated', color: t.ruleSoft }] : []),
    { key: 'loss', name: 'Greedy wins', color: t.crimson },
  ];
};
const rq3Outcomes = boards.map((b) => ({ board: `${b.board}×${b.board}`, ...shares(b.vs_greedy) }));
const solvedCells = F.solve.filter((c) => c.complete);
const largestSolve = solvedCells.reduce((a, c) => (c.states > a.states ? c : a));
const solvedStates = solvedCells.reduce((t, c) => t + c.states, 0);
const rootCounts = (['WIN', 'LOSS', 'DRAW'] as const).map((r) => ({ root: r, n: solvedCells.filter((c) => c.root === r).length }));
// Hop on vs off for the same board, walls and A/C setting, where both are solved
const hopPairs = solvedCells
  .filter((c) => c.abc[1] === '0')
  .map((off) => ({ off, on: solvedCells.find((c) => c.n === off.n && c.m === off.m && c.k === off.k && c.abc === off.abc[0] + '1' + off.abc[2]) }))
  .filter((p): p is { off: typeof p.off; on: NonNullable<typeof p.on> } => !!p.on);
const hopFlips = hopPairs.filter((p) => p.off.root !== p.on.root).length;
// The original 2-cell hop (pilot) against today's 1-cell hop, same settings (no walls)
const ruleChange = F.hop_rule_change.map((old) => ({ old, now: F.solve.find((c) => c.n === old.n && c.m === 0 && c.abc === old.abc) }));
const valueLabel = (root: string, rank: number | null) => (root === 'UNKNOWN' ? 'unknown' : `${root}${rank !== null ? ` in ${rank}` : ''}`);
const seeds = rq1.default_111_seeds;
const meanOptimal = seeds.reduce((t, x) => t + (x.value_optimal ?? 0), 0) / seeds.length;

const STATS = [
  { value: `${solvedCells.length} / ${F.solve.length}`, label: 'small settings solved exactly' },
  { value: largestSolve.states.toLocaleString(), label: 'positions in the largest exact solve' },
  { value: String(ab.matches), label: 'matches in the rule ablation' },
  { value: f3(hop.estimate), label: 'hop effect on Minimax’s win rate' },
  { value: `+${Math.round(h1Cell('100').branching_pct)}%`, label: 'legal actions with reusable walls' },
  { value: pct(meanOptimal), label: 'positions where the 3×3 DQN keeps the true value' },
];

const SECTIONS: [string, string][] = [
  ['h1', 'H1 · Branching'],
  ['ablation', 'Who wins'],
  ['h2', 'H2 · Warm-up'],
  ['h3', 'H3 · Convergence'],
  ['h4', 'H4 · Game length'],
  ['rq1', 'RQ1 · Learnability'],
  ['rq2', 'RQ2 · The hop'],
  ['rq3', 'RQ3 · Scale'],
  ['solves', 'Exact solves'],
  ['limits', 'Limitations'],
];

export const ResultsPage: React.FC = () => {
  const { hash } = useLocation();
  const [active, setActive] = useState(SECTIONS[0][0]);
  // Deep links from the Overview ("Evidence") land on the right card
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  // Mark the section being read in the side navigation
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { rootMargin: '0px 0px -65% 0px' }
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="main-content results results-layout" data-testid="results-page">
      <nav className="results-toc" aria-label="On this page">
        <p>On this page</p>
        <ol>
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className={active === id ? 'active' : undefined} aria-current={active === id ? 'location' : undefined}>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="results-main">
      <header className="results-intro">
        <h1>Results</h1>
        <p className="home-lede">
          The proposal fixed four hypotheses (H1–H4) and three research questions (RQ1–RQ3) before any final run. Each card gives
          the verdict, the figure behind it, the file it comes from, and a game you can play to see the effect.
        </p>
        <dl className="results-stats">
          {STATS.map((st) => (
            <div key={st.label}>
              <dt>{st.label}</dt>
              <dd>{st.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <FindingCard
        id="h1"
        tag="H1"
        title="Reusable walls and blocks make the game harder to search"
        verdict={h1Holds ? 'holds' : 'refuted'}
        claim={
          <p>
            Hypothesis: A and C each raise the number of legal actions by at least {h1.threshold_pct}% and cut the depth Minimax
            reaches in {h1.time_limit_s} s. Measured on {h1.positions} positions per cell ({h1.board}): REPLACE{' '}
            <b>+{h1Cell('100').branching_pct}%</b> and {h1Cell('100').depth_change.toFixed(2)} plies; BLOCK{' '}
            <b>+{h1Cell('001').branching_pct}%</b> and {h1Cell('001').depth_change.toFixed(2)} plies. The hop barely changes
            branching (+{h1Cell('010').branching_pct}%).
          </p>
        }
        sources={[h1.source]}
        tryIt={{ to: '/play' + presetQuery({ n: 5, k: 3, m: 10, abc: '101', p1: 'minimax:depth=2' }), label: 'play Minimax with A and C on' }}
      >
        <BarCompare
          data={h1Rows}
          xKey="cell"
          series={[
            { key: 'legal', name: 'Mean legal actions' },
            { key: 'depth', name: `Mean depth reached in ${h1.time_limit_s} s` },
          ]}
          caption={`Fig. 1 · Legal actions and search depth per rule cell (${h1.board}).`}
          summary={h1.cells.map((c) => `${abcLabel(c.abc)}: ${c.mean_legal} legal actions, depth ${c.mean_depth}`).join('; ')}
        />
        <div className="results-scroll">
          <table className="results-table">
            <caption className="sr-only">H1 per rule cell</caption>
            <thead>
              <tr>
                <th scope="col">Rules on</th>
                <th scope="col">Legal actions</th>
                <th scope="col">vs none</th>
                <th scope="col">Depth in {h1.time_limit_s} s</th>
                <th scope="col">vs none</th>
              </tr>
            </thead>
            <tbody>
              {h1.cells.map((c) => (
                <tr key={c.abc}>
                  <th scope="row">{abcLabel(c.abc)}</th>
                  <td>{c.mean_legal.toFixed(2)}</td>
                  <td>{c.abc === '000' ? '–' : `${c.branching_pct >= 0 ? '+' : ''}${c.branching_pct.toFixed(1)}%`}</td>
                  <td>{c.mean_depth.toFixed(2)}</td>
                  <td>{c.abc === '000' ? '–' : `${c.depth_change >= 0 ? '+' : ''}${c.depth_change.toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FindingCard>

      <FindingCard
        id="ablation"
        tag="Ablation"
        title="Only the hop changes who wins"
        verdict="answered"
        claim={
          <p>
            All 8 on/off combinations of the three rules, {ab.agents[0]} vs {ab.agents[1]} on {ab.board}, {ab.distinct_openings}{' '}
            distinct openings in both seats ({ab.matches} matches). Effects on Minimax’s win rate, with Holm correction over the 7
            effects: {survivors.length === 1 ? 'only' : ''} <b>{survivors.join(', ')}</b> survives. The hop lowers Minimax’s win rate by{' '}
            <b>{f3(Math.abs(hop.estimate))}</b>, lowers the draw rate by {f3(Math.abs(ab.b_draw_effect))} and shortens games by{' '}
            {Math.abs(ab.b_length_effect).toFixed(1)} plies.
          </p>
        }
        sources={[ab.source]}
        tryIt={{ to: '/play' + presetQuery({ n: 5, k: 3, m: 10, abc: '010', p0: 'minimax:depth=2', p1: 'greedy' }), label: 'Minimax vs Greedy, hop on' }}
      >
        <ForestPlot
          rows={ab.win_rate_effects.map((e) => ({ label: e.name, estimate: e.estimate, ci: e.ci95, emphasis: e.holm }))}
          emphasisLabel="survives Holm"
          format={f2}
          caption="Fig. 2 · Factorial effects on Minimax’s win rate with 95% paired-bootstrap intervals. Filled: survives Holm correction."
          summary={ab.win_rate_effects.map((e) => `${e.name}: ${f3(e.estimate)}, 95% CI ${f3(e.ci95[0])} to ${f3(e.ci95[1])}${e.holm ? ', survives Holm' : ''}`).join('; ')}
        />
      </FindingCard>

      <FindingCard
        id="h2"
        tag="H2"
        title="A Greedy warm-up does not speed up learning"
        verdict={h2Holds ? 'holds' : 'refuted'}
        claim={
          <p>
            Hypothesis: with a heuristic warm-up the DQN reaches at least {pct(h2.threshold_warmup, 0)} wins against Greedy, versus at
            most {pct(h2.threshold_pure, 0)} for pure self-play. Three 3×3 arms, seed 42: every arm wins{' '}
            <b>{pct(warm.vs_greedy.win_rate)}</b>, so both thresholds fail. The exact values separate the arms, against the
            hypothesis: the warm-up arm has the largest value error.
          </p>
        }
        note={
          sameGames
            ? 'All three arms play identical games against Greedy: Greedy is deterministic and the openings are shared, so on 3×3 this match test cannot tell the arms apart. The value error is the informative measure here.'
            : undefined
        }
        sources={h2.arms.map((a) => a.source)}
      >
        <div className="figure-pair">
          <BarCompare
            data={h2.arms.map((a) => ({ arm: a.arm, error: a.mae ?? 0 }))}
            xKey="arm"
            series={[{ key: 'error', name: 'Value error' }]}
            format={f3}
            height={220}
            caption="Value error per arm (lower is better)."
            summary={h2.arms.map((a) => `${a.arm}: ${a.mae}`).join('; ')}
          />
          <BarCompare
            data={h2.arms.map((a) => ({ arm: a.arm, optimal: a.value_optimal ?? 0 }))}
            xKey="arm"
            series={[{ key: 'optimal', name: 'Value-optimal share', color: chartTheme().graphiteSoft }]}
            format={(v) => pct(v, 1)}
            yDomain={[0.9, 1]}
            height={220}
            caption="Share of positions where the arm’s best action keeps the exact value (axis starts at 90%)."
            summary={h2.arms.map((a) => `${a.arm}: ${a.value_optimal}`).join('; ')}
          />
        </div>
        <div className="results-scroll">
        <table className="results-table">
          <caption className="sr-only">H2 arms against Greedy</caption>
          <thead>
            <tr>
              <th scope="col">Arm</th>
              <th scope="col">W / D / T / L vs Greedy</th>
              <th scope="col">Win rate [95% CI]</th>
              <th scope="col">Value-optimal</th>
              <th scope="col">Value error</th>
            </tr>
          </thead>
          <tbody>
            {h2.arms.map((a) => (
              <tr key={a.arm}>
                <th scope="row">{a.arm}</th>
                <td>
                  {a.vs_greedy.win} / {a.vs_greedy.draw} / {a.vs_greedy.truncated} / {a.vs_greedy.loss}
                </td>
                <td>
                  {pct(a.vs_greedy.win_rate)} [{pct(a.vs_greedy.ci95[0])}, {pct(a.vs_greedy.ci95[1])}]
                </td>
                <td>{a.value_optimal !== null ? pct(a.value_optimal) : '–'}</td>
                <td>{a.mae !== null ? f3(a.mae) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </FindingCard>

      <FindingCard
        id="h3"
        tag="H3"
        title="The DQN’s value error falls below 0.15 on solvable boards"
        verdict={h3Holds ? 'holds' : 'mixed'}
        claim={
          <p>
            Every saved checkpoint is scored over all non-terminal positions of the exact solve: error = |max legal Q(s) − V*(s)|,
            with V* discounted at 0.99. 4×4 ends at <b>{f3(run4.final)}</b> (below {h3.threshold} from {steps(run4.first_below!)},
            for good from {steps(run4.stays_below_from!)}). On 3×3 the 200k runs end at {range(runs200.map((r) => r.final))}, still
            falling; retrained to the proposal’s 500k budget, all five seeds end at <b>{range(runs500.map((r) => r.final))}</b>.
          </p>
        }
        note="The 500k runs are new trajectories, not continuations of the 200k runs. The released 3×3 models and the other 3×3 results use the 200k runs."
        sources={[...new Set(h3.runs.map((r) => r.source))]}
        tryIt={{ to: '/play' + presetQuery({ n: 3, k: 1, m: 1, abc: '111', p1: 'dqn' }), label: 'play the 3×3 DQN' }}
      >
        <LineSeriesChart
          series={h3Series}
          reference={{ y: h3.threshold, label: `H3 threshold ${h3.threshold}` }}
          xLabel="Training steps"
          yLabel="Value error"
          xFormat={steps}
          caption="Fig. 3 · Value error against the exact solution for every saved checkpoint: 4×4 (500k steps) and the five 3×3 seeds trained to 500k."
          summary={h3Series.map((s) => `${s.name}: from ${f3(s.points[0][1])} to ${f3(s.points[s.points.length - 1][1])}`).join('; ')}
        />
        <LineSeriesChart
          series={runs200.map((r, i) => ({ name: `3×3 seed ${r.seed}`, points: r.curve, color: chartTheme().ink, dashed: i % 2 === 1 }))}
          reference={{ y: h3.threshold, label: `H3 threshold ${h3.threshold}` }}
          xLabel="Training steps"
          yLabel="Value error"
          xFormat={steps}
          caption="Fig. 3b · The original 200k-step 3×3 runs: still falling, none below the threshold at the end."
          summary={runs200.map((r) => `seed ${r.seed}: ends at ${f3(r.final)}`).join('; ')}
        />
        <div className="results-scroll">
          <table className="results-table">
            <caption className="sr-only">H3 runs</caption>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Steps</th>
                <th scope="col">Final error</th>
                <th scope="col">First below {h3.threshold}</th>
                <th scope="col">Below for good from</th>
              </tr>
            </thead>
            <tbody>
              {h3.runs.map((r) => (
                <tr key={r.run}>
                  <th scope="row">{r.board}×{r.board} seed {r.seed}</th>
                  <td>{steps(r.budget)}</td>
                  <td>
                    {f3(r.final)} {r.final < h3.threshold ? '✓' : '✗'}
                  </td>
                  <td>{r.first_below ? steps(r.first_below) : 'never'}</td>
                  <td>{r.stays_below_from ? steps(r.stays_below_from) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FindingCard>

      <FindingCard
        id="h4"
        tag="H4"
        title="Together the rules shorten games instead of lengthening them"
        verdict={h4Holds ? 'holds' : 'refuted'}
        claim={
          <p>
            Hypothesis: with all three rules on, games are longer than the sum of the single-rule effects predicts. The additive
            prediction is {ab.length_additive_prediction.toFixed(1)} plies; the measured mean is{' '}
            <b>{ab.length_measured_all_on.toFixed(1)}</b>. The A × B interaction on length ({ab.length_ab_interaction.toFixed(1)}{' '}
            plies) {ab.length_ab_holm ? 'survives' : 'does not survive'} Holm: the hop cuts through the extra walls. This holds for
            the search agents; the DQN was not part of this ablation.
          </p>
        }
        sources={[ab.source]}
      >
        <BarCompare
          data={lengthRows}
          xKey="label"
          series={[{ key: 'plies', name: 'Mean game length (plies)' }]}
          format={(v) => v.toFixed(1)}
          yLabel="Plies"
          caption={`Fig. 4 · Mean game length per cell, the additive prediction and the measured all-on value (${ab.board}).`}
          summary={lengthRows.map((r) => `${r.label}: ${r.plies.toFixed(1)} plies`).join('; ')}
        />
        <BarCompare
          data={['00', '01', '10', '11'].map((ac) => ({
            cell: abcLabel(ac[0] + '0' + ac[1]) === 'none' ? 'no A, no C' : abcLabel(ac[0] + '0' + ac[1]),
            off: ab.length_cell_means[ac[0] + '0' + ac[1]],
            on: ab.length_cell_means[ac[0] + '1' + ac[1]],
          }))}
          xKey="cell"
          series={[
            { key: 'off', name: 'Hop off' },
            { key: 'on', name: 'Hop on' },
          ]}
          format={(v) => v.toFixed(1)}
          yLabel="Plies"
          caption="Fig. 4b · The same four A/C settings with the hop off and on: the hop shortens every one, most where reusable walls are on."
          summary={['00', '01', '10', '11'].map((ac) => `${ac}: ${ab.length_cell_means[ac[0] + '0' + ac[1]]} vs ${ab.length_cell_means[ac[0] + '1' + ac[1]]}`).join('; ')}
        />
      </FindingCard>

      <FindingCard
        id="rq1"
        tag="RQ1"
        title="REPLACE makes values easier to learn; BLOCK makes them harder"
        verdict="answered"
        claim={
          <p>
            One DQN per rule cell on 3×3 (K = 1, M = 1, seed 42, 200k steps), each scored against its own exact solve. Turning
            REPLACE on changes the value error by {aDiffs.map((d) => (d > 0 ? '+' : '') + f2(d)).join(', ')} across the four matched
            pairs; turning BLOCK on changes it by {cDiffs.map((d) => (d > 0 ? '+' : '') + f2(d)).join(', ')}. The seed spread of the
            five default runs is {f3(seedSpread)}.
          </p>
        }
        note="Each rule cell has a single seed, so these are consistent directions, not tested effects. Win rates against Greedy are not compared across cells: each cell is a different game with a different value."
        sources={[...rq1.cells.map((c) => c.source), ...rq1.default_111_seeds.map((s) => s.source)]}
        tryIt={{ to: '/play' + presetQuery({ n: 3, k: 1, m: 1, abc: '001', p1: 'exact' }), label: '3×3 with BLOCK, against the solver' }}
      >
        <BarCompare
          data={rq1Rows}
          xKey="cell"
          series={[{ key: 'error', name: 'Value error' }]}
          format={f3}
          yLabel="Value error"
          caption="Fig. 5 · DQN value error per rule cell on 3×3 (lower is better)."
          summary={rq1Rows.map((r) => `${r.cell}: ${f3(r.error)}`).join('; ')}
        />
        <div className="results-scroll">
          <table className="results-table">
            <caption className="sr-only">RQ1 per rule cell</caption>
            <thead>
              <tr>
                <th scope="col">Rules on</th>
                <th scope="col">Positions</th>
                <th scope="col">Value-optimal</th>
                <th scope="col">Value error</th>
                <th scope="col">Win rate vs Greedy [95% CI]</th>
              </tr>
            </thead>
            <tbody>
              {[...rq1.cells.map((c) => ({ key: c.abc, label: abcLabel(c.abc), e: c })), ...seeds.map((x) => ({ key: `s${x.seed}`, label: `A + B + C, seed ${x.seed}`, e: x }))].map(({ key, label, e }) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{e.states?.toLocaleString() ?? '–'}</td>
                  <td>{e.value_optimal !== null ? pct(e.value_optimal) : '–'}</td>
                  <td>{e.mae !== null ? f3(e.mae) : '–'}</td>
                  <td>
                    {pct(e.vs_greedy.win_rate)} [{pct(e.vs_greedy.ci95[0])}, {pct(e.vs_greedy.ci95[1])}]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FindingCard>

      <FindingCard
        id="rq2"
        tag="RQ2"
        title="The one-time hop changes values, results and planning"
        verdict="answered"
        claim={
          <ul className="results-list">
            <li>
              <b>Game value.</b> With up to two walls each on 3×3, turning the hop on changes the solved result from{' '}
              {n3m2Off.root}
              {n3m2Off.rank ? ` in ${n3m2Off.rank}` : ''} to <b>{n3m2On.root}{n3m2On.rank ? ` in ${n3m2On.rank}` : ''}</b> for player 0, who moves first.
            </li>
            <li>
              <b>Results.</b> It is the only rule with a supported effect on match outcomes ({f3(hop.estimate)} on Minimax’s win rate;{' '}
              <a href="#ablation">Fig. 2</a>).
            </li>
            <li>
              <b>Planning.</b> A Minimax score that counts one hop across an opponent wall raises the win rate against Greedy from{' '}
              {pct(hs.win_rate_default, 0)} to <b>{pct(hs.win_rate_hop, 0)}</b> on the same {hs.games} games (paired 95% CI{' '}
              {f2(hs.ci95[0])} to {f2(hs.ci95[1])}): the default score misjudges an unused hop.
            </li>
          </ul>
        }
        sources={[n3m2On.source, ab.source, hs.source]}
        tryIt={{ to: '/play' + presetQuery({ n: 3, k: 1, m: 2, abc: '010', p1: 'exact' }), label: '3×3, two walls, hop on, vs the solver' }}
      >
        <div className="figure-pair">
          <BarCompare
            data={[
              { score: 'Default score', win: hs.win_rate_default },
              { score: 'Hop-aware score', win: hs.win_rate_hop },
            ]}
            xKey="score"
            series={[{ key: 'win', name: 'Minimax win rate vs Greedy' }]}
            format={(v) => pct(v, 0)}
            yDomain={[0, 1]}
            height={240}
            caption={`Minimax (depth 2) against Greedy on the same ${hs.games} games (${hs.board}): +${pct(hs.difference, 0)}, paired 95% CI ${f2(hs.ci95[0])} to ${f2(hs.ci95[1])}.`}
            summary={`Default ${pct(hs.win_rate_default, 0)}, hop-aware ${pct(hs.win_rate_hop, 0)}`}
          />
          <div className="results-callout">
            <p className="results-big">
              {hopFlips} of {hopPairs.length}
            </p>
            <p>
              solved settings change their result (win, loss or draw for the first player) when only the hop is switched on, with
              the board, walls and other rules held fixed.
            </p>
          </div>
        </div>
      </FindingCard>

      <FindingCard
        id="rq3"
        tag="RQ3"
        title="Near-optimal on small boards; relative strength falls as the board grows"
        verdict="answered"
        claim={
          <p>
            Where exact values exist the DQN keeps the game value in{' '}
            {truthBoards.map((b) => `${pct(b.value_optimal!)} of positions on ${b.board}×${b.board}`).join(' and ')}. Without ground
            truth, its win rate against Greedy is{' '}
            {boards.map((b) => `${pct(b.vs_greedy.win_rate, 0)} on ${b.board}×${b.board}`).join(', ')}.
          </p>
        }
        note="The board-size trend is confounded: one seed per board above 3×3, different wall budgets and block durations per board, and the 5×5 and 9×9 models miss wall-owner information in their input. Read it as a trend for these models, not a scaling law."
        sources={boards.map((b) => b.source)}
        tryIt={{ to: '/play' + presetQuery({ n: 5, k: 3, m: 10, abc: '111', p1: 'dqn' }), label: 'play the 5×5 DQN' }}
      >
        <BarCompare
          data={rq3Outcomes}
          xKey="board"
          series={outcomeSeries(boards.map((b) => b.vs_greedy))}
          stacked
          yDomain={[0, 1]}
          format={(v) => pct(v, 0)}
          caption="Fig. 6 · Outcomes of the DQN against Greedy by board size (distinct games, both seats)."
          summary={rq3Rows.map((r) => `${r.board}: ${pct(r.win, 0)} wins`).join('; ')}
        />
        <div className="results-scroll">
          <table className="results-table">
            <caption className="sr-only">DQN by board size</caption>
            <thead>
              <tr>
                <th scope="col">Board</th>
                <th scope="col">Rules</th>
                <th scope="col">Training steps</th>
                <th scope="col">W / D / L vs Greedy</th>
                <th scope="col">Win rate [95% CI]</th>
                <th scope="col">Value-optimal</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((b) => (
                <tr key={b.board}>
                  <th scope="row">
                    {b.board}×{b.board}
                  </th>
                  <td>
                    K = {b.rules.K}, M = {b.rules.M}
                  </td>
                  <td>{b.steps ? `${(b.steps / 1e6).toFixed(1)}M` : '–'}</td>
                  <td>
                    {b.vs_greedy.win} / {b.vs_greedy.draw} / {b.vs_greedy.loss}
                  </td>
                  <td>
                    {pct(b.vs_greedy.win_rate)} [{pct(b.vs_greedy.ci95[0])}, {pct(b.vs_greedy.ci95[1])}]
                  </td>
                  <td>{b.value_optimal !== null ? pct(b.value_optimal) : 'no exact solve'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FindingCard>

      <FindingCard
        id="solves"
        tag="Ground truth"
        title="Exact solves: the true value of small games"
        verdict="answered"
        claim={
          <p>
            Retrograde analysis over the complete game graph, capped at 10<sup>6</sup> positions. It solved{' '}
            <b>
              {solvedCells.length} of {F.solve.length}
            </b>{' '}
            settings (3×3 and 4×4, up to two walls, all eight rule cells), {solvedStates.toLocaleString()} positions in total; the
            largest has {largestSolve.states.toLocaleString()}. Results for the first player:{' '}
            {rootCounts.map((r) => `${r.n} ${r.root.toLowerCase()}${r.n === 1 ? '' : 's'}`).join(', ')}. The other{' '}
            {F.solve.length - solvedCells.length} exceed the cap and stay unknown.
          </p>
        }
        note="The solver also caught a broken rule: under the original 2-cell hop, turning the hop on flipped every no-wall result (table below), often to a forced win within a few plies. The hop was changed to today’s 1-cell step over an opponent wall."
        sources={[largestSolve.source, ...new Set(F.hop_rule_change.map((c) => c.source))]}
        tryIt={{ to: '/play' + presetQuery({ n: 3, k: 1, m: 1, abc: '111', p1: 'exact' }), label: 'play a solved board against the solver' }}
      >
        <SolveGrid />
        <div className="results-scroll">
          <table className="results-table">
            <caption>Hop rule change, no walls: result for the first player (plies to the end with best play)</caption>
            <thead>
              <tr>
                <th scope="col">Board</th>
                <th scope="col">Rules on</th>
                <th scope="col">Original 2-cell hop</th>
                <th scope="col">Today’s rules</th>
              </tr>
            </thead>
            <tbody>
              {ruleChange.map(({ old, now }) => (
                <tr key={`${old.n}${old.abc}`}>
                  <th scope="row">
                    {old.n}×{old.n}
                  </th>
                  <td>{abcLabel(old.abc)}</td>
                  <td>{valueLabel(old.root, old.rank)}</td>
                  <td>{now ? valueLabel(now.root, now.rank) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FindingCard>

      <section className="home-section" id="limits" aria-labelledby="limits-title">
        <h2 id="limits-title">Limitations</h2>
        <ul className="results-list">
          <li><b>One seed</b> for 4×4, 5×5 and 9×9, and for each RQ1 cell and H2 arm. Only the default 3×3 setting has five seeds.</li>
          <li><b>No exact ground truth above 4×4.</b> Larger-board results are match results against the named agents.</li>
          <li><b>Wall owner missing from the DQN input</b> for walls that are no longer anyone’s latest; this affects the 5×5 and 9×9 models, not the trained 3×3 and 4×4 settings.</li>
          <li><b>Deterministic agents:</b> repeated openings replay the same game, so sample sizes count distinct games only.</li>
          <li><b>Capped solves:</b> settings that exceed the solver’s size cap are reported as unknown, never as a value.</li>
          <li><b>Ablation scope:</b> the factorial ablation pairs depth-2 Minimax with Greedy on one board; the DQN ablation is 3×3 only.</li>
        </ul>
        <p className="muted">
          Full list and every departure from the proposal: <code>report/final_report.md</code> Sections 11 and 12. The rules and
          the engine are explained on <Link to="/method">How it works</Link>.
        </p>
      </section>
      </div>
    </div>
  );
};
