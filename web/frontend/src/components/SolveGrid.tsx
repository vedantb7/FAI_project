import React from 'react';
import { abcLabel, findings, SolveCell } from '../lib/findings';

const ABC = ['000', '001', '010', '011', '100', '101', '110', '111'];

const short = (c: SolveCell): string => {
  if (!c.complete) return '?';
  const letter = c.root[0];
  return c.rank !== null ? `${letter}${c.rank}` : letter;
};

const describe = (c: SolveCell): string =>
  c.complete
    ? `${c.root}${c.rank !== null ? ` in ${c.rank} plies` : ''} for player 0, ${c.states.toLocaleString()} positions`
    : `not solved: over the size cap at ${c.states.toLocaleString()} positions`;

/** Every small setting the exact solver attempted: root value for player 0, or "?" if capped. */
export const SolveGrid: React.FC = () => {
  const rows = [...new Set(findings.solve.map((c) => `${c.n}:${c.m}`))];
  return (
    <figure className="chart">
      <div className="solve-scroll">
        <table className="solve-grid">
          <caption className="sr-only">Exact solver root values by board, wall budget and rule cell</caption>
          <thead>
            <tr>
              <th scope="col">Board, walls</th>
              {ABC.map((abc) => (
                <th key={abc} scope="col">
                  {abcLabel(abc)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => {
              const [n, m] = key.split(':').map(Number);
              return (
                <tr key={key}>
                  <th scope="row">
                    {n}×{n}, M={m}
                  </th>
                  {ABC.map((abc) => {
                    const c = findings.solve.find((s) => s.n === n && s.m === m && s.abc === abc);
                    if (!c) return <td key={abc}>–</td>;
                    return (
                      <td key={abc} className={`solve-${c.complete ? c.root.toLowerCase() : 'capped'}`} title={describe(c)}>
                        <span aria-hidden="true">{short(c)}</span>
                        <span className="sr-only">{describe(c)}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <figcaption className="fig-caption">
        Root value for player 0 (who moves first) under best play, K = 1: W = win, L = loss, D = draw, with the number of plies
        to the result; ? = over the solver’s size cap, so no value is claimed. Hover a cell for its size.
      </figcaption>
    </figure>
  );
};
