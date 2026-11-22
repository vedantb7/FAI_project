/**
 * Human-readable names for engine coordinates. Display only: no rule logic.
 * Row 0 is drawn at the bottom (C-GEOM), so cell (r, c) reads as column letter + row number.
 */
import { ActionJson } from '../api/types';

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const cellName = (r: number, c: number): string => `${COLS[c] ?? c}${r + 1}`;

export function describeAction(action: ActionJson | null | undefined): string {
  if (!action) return 'no action';
  const [type, v] = action;
  switch (type) {
    case 'MOVE':
      return `moved to ${cellName(v[0], v[1])}`;
    case 'HOP':
      return `hopped to ${cellName(v[0], v[1])}`;
    case 'BLOCK':
      return `blocked ${cellName(v[0], v[1])}`;
    case 'WALL':
    case 'REPLACE': {
      // A wall slot (r, c, o) spans two cells starting at (r, c)
      const [r, c, o] = v;
      const span = o === 'H' ? `${cellName(r, c)}–${cellName(r, c + 1)}` : `${cellName(r, c)}–${cellName(r + 1, c)}`;
      const kind = o === 'H' ? 'horizontal' : 'vertical';
      return type === 'WALL' ? `placed a ${kind} wall at ${span}` : `moved the latest wall to ${kind} ${span}`;
    }
    default:
      return String(type).toLowerCase();
  }
}

export function sameAction(a: ActionJson | null | undefined, b: ActionJson | null | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && JSON.stringify(a[1]) === JSON.stringify(b[1]);
}

/** Display name for an agent spec string, e.g. "minimax:depth=2" -> "Minimax (depth 2)". */
export function agentName(spec: string | undefined): string {
  if (!spec || spec === 'human') return 'Human';
  const [family, args = ''] = spec.split(':');
  const depth = /depth=(\d+)/.exec(args)?.[1];
  switch (family) {
    case 'greedy':
      return 'Greedy';
    case 'minimax':
      return depth ? `Minimax (depth ${depth})` : 'Minimax';
    case 'exact':
      return 'Exact solver';
    case 'dqn':
      return 'DQN';
    case 'random':
      return 'Random';
    default:
      return family;
  }
}

export const agentFamily = (spec: string | undefined): string => (spec || 'human').split(':')[0];
