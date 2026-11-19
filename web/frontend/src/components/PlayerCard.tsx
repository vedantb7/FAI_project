import React from 'react';
import { GameState } from '../api/types';

interface PlayersTableProps {
  state: GameState;
  names: [string, string];
}

/** Both players' resources, side by side. Used abilities print struck through. */
export const PlayersTable: React.FC<PlayersTableProps> = ({ state, names }) => {
  const dist = (p: number) => {
    const path = state.paths?.[p];
    return path && path.length > 0 ? path.length - 1 : '—';
  };
  return (
    <table className="players" data-testid="players-table">
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col">To goal</th>
          <th scope="col">Walls</th>
          {state.rules.B && <th scope="col">Hop</th>}
          {state.rules.C && <th scope="col">Block</th>}
        </tr>
      </thead>
      <tbody>
        {[0, 1].map((p) => {
          const toMove = state.to_move === p && !state.terminal.over;
          return (
            <tr key={p} className={toMove ? 'to-move' : undefined}>
              <td className="who">
                <i style={{ background: p === 0 ? 'var(--ink)' : 'var(--crimson)' }} aria-hidden="true" />
                P{p} · {names[p]}
                {toMove && <span className="turn">to move</span>}
              </td>
              <td>{dist(p)}</td>
              <td title={`${state.inventory[p]} of ${state.rules.M} walls left`}>{state.inventory[p]}</td>
              {state.rules.B && <td className={state.hop[p] ? undefined : 'struck'}>{state.hop[p] ? 'ready' : 'used'}</td>}
              {state.rules.C && <td className={state.block[p] ? undefined : 'struck'}>{state.block[p] ? 'ready' : 'used'}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
