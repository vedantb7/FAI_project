import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { OverlayItem, SessionData } from '../api/types';
import { describeAction, sameAction } from '../lib/notation';

type Status = 'WIN' | 'DRAW' | 'LOSS';
const ORDER: Record<Status, number> = { LOSS: 0, DRAW: 1, WIN: 2 };
const fromValue = (v: number | null): Status | null => (v === 1 ? 'WIN' : v === 0 ? 'DRAW' : v === -1 ? 'LOSS' : null);

interface Reading {
  game: string;
  ply: number;
  toMove: 0 | 1;
  status: Status;
  rank: number | null;
  /** The solver's value of every legal action here, for the player to move. */
  overlay: OverlayItem[];
}

/**
 * The exact solver's verdict on the current position (small solved boards only), and whether
 * the last move kept the value. A move is judged against the analysis of the position it was
 * played from, so an agent replying quickly cannot race the check. No rules live here: every
 * value comes from the engine-backed analyze endpoint.
 */
export const OraclePanel: React.FC<{ session: SessionData; names: [string, string]; busy: boolean }> = ({
  session,
  names,
  busy,
}) => {
  const [now, setNow] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readings = useRef<Map<string, Reading>>(new Map());
  const ply = session.history.length;
  const over = session.state.terminal.over;

  useEffect(() => {
    if (busy || over) return;
    let live = true;
    const toMove = session.state.to_move as 0 | 1;
    api
      .analyzePosition(session.id, 'exact')
      .then((ex) => {
        // Drop a stale answer: an agent may have moved while the request was in flight
        if (!live || ex.player !== toMove) return;
        const reading: Reading = {
          game: session.id,
          ply,
          toMove,
          status: ex.details.status as Status,
          rank: ex.details.rank ?? null,
          overlay: ex.overlay,
        };
        readings.current.set(`${session.id}:${ply}`, reading);
        setNow(reading);
        setError(null);
      })
      .catch((err: any) => live && setError(err?.data?.error || err.message || 'The solver could not analyse this position.'));
    return () => {
      live = false;
    };
  }, [session.id, ply, busy, over]); // eslint-disable-line react-hooks/exhaustive-deps

  // Judge the most recent move whose starting position was analysed
  const last = session.history[ply - 1];
  const before = last ? readings.current.get(`${session.id}:${ply - 1}`) : undefined;
  let verdict: string | null = null;
  if (last && before) {
    const played = before.overlay.find((o) => sameAction(o.action, last.action));
    const got = played ? fromValue(played.value) : null;
    if (got) {
      const who = names[before.toMove];
      const move = describeAction(last.action);
      if (ORDER[got] < ORDER[before.status]) {
        verdict = `${who} played ${move} and threw away value: ${before.status} became ${got} for ${who}.`;
      } else {
        verdict = `${who} played ${move} and kept the value (${played!.label} for ${who}).`;
      }
    }
  }

  const current = now && now.game === session.id && now.ply === ply ? now : null;
  return (
    <div className="oracle" aria-live="polite">
      <h3>Exact solver’s view</h3>
      {verdict && <p className="oracle-verdict">{verdict}</p>}
      {error && <p className="muted">{error}</p>}
      {!error && !over && current && (
        <p className="oracle-value">
          With best play from here: <b>{current.rank !== null && current.status !== 'DRAW' ? `${current.status} in ${current.rank}` : current.status}</b>{' '}
          for {names[current.toMove]} (to move).
        </p>
      )}
      {!error && !over && !current && !busy && <p className="muted">Asking the solver…</p>}
    </div>
  );
};
