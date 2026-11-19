import React from 'react';
import { Explanation } from '../api/types';
import { describeAction, sameAction } from '../lib/notation';

interface WorkedStepProps {
  explanation: Explanation | null;
  /** Ply number the explanation belongs to (null for a hint on the current position). */
  ply: number | null;
  names: [string, string];
  thinkingName?: string | null;
}

const fmt = (v: unknown, digits = 2): string => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v ?? '—');
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
};
const signed = (v: unknown, digits = 2): string =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? `+${fmt(v, digits)}` : fmt(v, digits);

/** One agent decision written out as a worked step, from the engine's explanation (C-EXPL). */
export const WorkedStep: React.FC<WorkedStepProps> = ({ explanation, ply, names, thinkingName }) => {
  if (thinkingName) {
    return (
      <div className="worked-step" aria-live="polite">
        <div className="thinking">{thinkingName} is working out its move</div>
      </div>
    );
  }
  if (!explanation) {
    return (
      <div className="worked-step">
        <p className="muted">
          No agent has moved yet. After each agent move, its reasoning is written out here, step by step, from the
          engine's own numbers.
        </p>
      </div>
    );
  }

  const { details = {}, chosen, player, summary, overlay } = explanation;
  const me = player as 0 | 1;
  const opp = (1 - me) as 0 | 1;
  const pc = (p: 0 | 1) => (p === 0 ? 'p0' : 'p1');
  const D = (p: 0 | 1) => (
    <span className={pc(p)}>
      <i>d</i>
      <sub>{names[p]}</sub>
    </span>
  );

  let body: React.ReactNode;
  let note: string | null = null;

  if (details.objective !== undefined) {
    // Greedy: H = d_opp − d_self after the move, maximised over every legal action
    const rows: any[] = details.rows || [];
    const row = rows.find((r) => sameAction(r.action, chosen)) || rows[0];
    if (row?.immediate_win) {
      body = <div className="eq">This move reaches the goal row: an immediate win, chosen before anything else.</div>;
    } else if (row) {
      body = (
        <>
          <div className="eq">
            after the move: {D(opp)} = {fmt(row.d_opp)} · {D(me)} = {fmt(row.d_self)}
          </div>
          <div className="eq">
            <i>H</i> = {D(opp)} − {D(me)} = {fmt(row.d_opp)} − {fmt(row.d_self)} ={' '}
            <span className="result">{signed(row.H)}</span>
          </div>
          <div className="eq">largest <i>H</i> of {overlay?.length || rows.length} legal actions → chosen</div>
        </>
      );
    }
    // The tie-break order comes from the engine; H itself is the score, not a tie-breaker
    const chain: string[] = (details.tie_break_chain || []).filter((t: string) => t !== 'H');
    const plain = chain.map((t) => {
      if (t.startsWith('category priority')) {
        const order = t.replace('category priority', '').trim().split('>').map((x) => x.trim()).filter(Boolean);
        return `action type (${order.join(', then ')})`;
      }
      if (t.replace('−', '-') === '-d_self') return `the shorter path for ${names[me]}`;
      if (t === 'tie key') return 'a fixed tie key';
      return t;
    });
    note = `Greedy looks one move ahead only.${plain.length ? ` Equal scores are settled by ${plain.join(', then by ')}.` : ''}`;
  } else if (details.nodes_expanded !== undefined) {
    body = (
      <>
        <div className="eq">
          searched {Number(details.nodes_expanded).toLocaleString()} positions to depth {details.depth_completed}
          {details.depth_requested !== undefined ? ` of ${details.depth_requested}` : ''}
        </div>
        <div className="eq">{Number(details.cutoffs || 0).toLocaleString()} branches cut by alpha-beta pruning</div>
        <div className="eq">
          value of best line = <span className="result">{signed(details.root_value)}</span>
        </div>
      </>
    );
    note = 'Minimax assumes the opponent replies with its best move, and scores leaf positions with an evaluation function.';
  } else if (details.q_max !== undefined) {
    body = (
      <>
        <div className="eq">
          <i>Q</i>(chosen) = <span className="result">{signed(details.q_chosen, 3)}</span> · max <i>Q</i> ={' '}
          {signed(details.q_max, 3)}
        </div>
        <div className="eq">over {details.n_legal} legal actions</div>
      </>
    );
    note = details.note || 'Q estimates the discounted outcome: +1 win, 0 draw, −1 loss.';
  } else if (details.status !== undefined) {
    const rank = details.rank !== null && details.rank !== undefined ? ` in ${details.rank} plies` : '';
    body = (
      <>
        <div className="eq">
          position value = <span className="result">{details.status}{rank}</span>
        </div>
        {details.states_in_graph !== undefined && (
          <div className="eq">solved over {Number(details.states_in_graph).toLocaleString()} positions</div>
        )}
      </>
    );
    note = 'The exact solver knows the true result of every position on this small board and keeps it.';
  } else if (details.n_legal !== undefined) {
    body = (
      <div className="eq">
        1 of {details.n_legal} legal actions, each with <i>p</i> = {fmt(details.probability, 3)}
      </div>
    );
    note = 'Random is a reference point: it ignores the position entirely.';
  } else {
    body = <div className="eq">{summary}</div>;
  }

  const who = names[me];
  return (
    <div className="worked-step">
      <h3>
        {ply !== null ? `Step ${ply} · ` : 'Hint · '}
        {who} {ply !== null ? describeAction(chosen) : `would have ${describeAction(chosen)}`}
      </h3>
      <div style={{ marginTop: '0.5rem' }}>{body}</div>
      {note && <p className="margin-note">{note}</p>}
    </div>
  );
};
