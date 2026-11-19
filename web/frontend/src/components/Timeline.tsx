import React, { useEffect, useRef } from 'react';
import { HistoryEntry } from '../api/types';
import { describeAction } from '../lib/notation';

interface TimelineProps {
  history: HistoryEntry[];
  names: [string, string];
  onUndo?: () => void;
  canUndo?: boolean;
}

/** Ply list: P0 moves in the left column, P1 moves in the right. */
export const Timeline: React.FC<TimelineProps> = ({ history, names, onUndo, canUndo = false }) => {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  return (
    <div data-testid="timeline">
      <div className="section-head">
        <h3>Plies</h3>
        {onUndo && (
          <button className="btn" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="muted">No moves yet.</p>
      ) : (
        <ol className="ply-list" ref={listRef} aria-label="Moves played">
          {history.map((entry, idx) => (
            <li key={`ply-${idx}`} className={idx === history.length - 1 ? 'current' : undefined}>
              <span className="n">{entry.ply}</span>
              <span className={`p${entry.player}`}>
                {names[entry.player]} {describeAction(entry.action)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
