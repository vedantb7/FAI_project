import React from 'react';
import { GameState } from '../api/types';
import { ActionMode } from './Board';

interface ActionBarProps {
  state: GameState;
  currentMode: ActionMode;
  onSelectMode: (mode: ActionMode) => void;
  disabled?: boolean;
}

export interface ModeInfo {
  mode: Exclude<ActionMode, null>;
  label: string;
  key: string;
  count: number;
  shown: boolean;
  spent: boolean;
}

/** The action modes for the player to move, all read from engine state. */
export function modeInfo(state: GameState): ModeInfo[] {
  const legal = state.legal || { MOVE: [], HOP: [], WALL: [], REPLACE: [], BLOCK: [] };
  const p = state.to_move;
  const walls = legal.WALL || [];
  return [
    { mode: 'MOVE', label: 'Move', key: '1', count: legal.MOVE?.length || 0, shown: true, spent: false },
    { mode: 'WALL_H', label: 'Horizontal wall', key: '2', count: walls.filter((w) => w[2] === 'H').length, shown: true, spent: false },
    { mode: 'WALL_V', label: 'Vertical wall', key: '3', count: walls.filter((w) => w[2] === 'V').length, shown: true, spent: false },
    { mode: 'REPLACE', label: 'Move wall', key: '4', count: legal.REPLACE?.length || 0, shown: state.rules.A, spent: false },
    { mode: 'HOP', label: 'Hop', key: '5', count: legal.HOP?.length || 0, shown: state.rules.B, spent: !state.hop[p] },
    { mode: 'BLOCK', label: 'Block', key: '6', count: legal.BLOCK?.length || 0, shown: state.rules.C, spent: !state.block[p] },
  ];
}

export const ActionBar: React.FC<ActionBarProps> = ({ state, currentMode, onSelectMode, disabled = false }) => (
  <div className="segmented" role="toolbar" aria-label="Action mode" data-testid="action-bar">
    {modeInfo(state)
      .filter((m) => m.shown)
      .map((m) => (
        <button
          key={m.mode}
          className={`btn${m.spent ? ' is-spent' : ''}`}
          aria-pressed={currentMode === m.mode}
          aria-keyshortcuts={m.key}
          disabled={disabled || m.count === 0}
          title={m.spent ? `${m.label}: already used this game` : `${m.label} (${m.count} legal)`}
          onClick={() => onSelectMode(m.mode)}
        >
          {m.label} <span className="key">{m.key}</span>
        </button>
      ))}
  </div>
);
