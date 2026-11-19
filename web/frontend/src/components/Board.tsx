import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActionJson, GameState, OverlayItem } from '../api/types';
import {
  boardDimensions,
  cellCenter,
  cellRect,
  wallSlotRect,
  DEFAULT_GEOMETRY,
} from '../lib/geometry';
import { cellName } from '../lib/notation';
import { buildOverlayLookup, getHeatmapColor } from './Heatmap';

export type ActionMode =
  | 'MOVE'
  | 'HOP'
  | 'WALL_H'
  | 'WALL_V'
  | 'REPLACE'
  | 'BLOCK'
  | null;

export interface BoardProps {
  state: GameState;
  mode?: ActionMode;
  overlay?: OverlayItem[];
  showPaths?: boolean;
  /** Player names for the path-length labels (d_You = 6); labels are drawn when given. */
  names?: [string, string];
  onAction?: (action: ActionJson) => void;
  interactive?: boolean;
  className?: string;
}

// Wall-slot tap target thickness in SVG units (about 24px at phone scale)
const SLOT_HIT = 26;

const isTypingTarget = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;
};

const activate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

export const Board: React.FC<BoardProps> = ({
  state,
  mode = null,
  overlay,
  showPaths = true,
  names,
  onAction,
  interactive = true,
  className = '',
}) => {
  const n = state.n;
  const { width, height } = useMemo(() => boardDimensions(n), [n]);
  const viewWidth = width;
  const { cellSize, wallGap, padding } = DEFAULT_GEOMETRY;

  // The SVG scales to its column. k = SVG units per screen pixel, so annotations (labels,
  // badges) can be sized in pixels and stay readable at any board size or viewport.
  const svgRef = useRef<SVGSVGElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setK(viewWidth / w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewWidth]);
  // px -> SVG units, never larger than a fraction of a cell
  const px = (v: number, maxCell = 0.45) => Math.min(v * k, cellSize * maxCell);
  // Pawns: about 40px across on screen, but always inside their cell
  const pawnR = Math.min(px(20, 0.42), cellSize * 0.42);
  // label at least 9px on screen, but never wider than the pawn
  const pawnFont = Math.min(Math.max(pawnR * 0.8, 9 * k), pawnR * 1.05);
  const overlayLookup = useMemo(() => buildOverlayLookup(overlay), [overlay]);

  // Arrow keys play MOVE; ignored while a form field has focus
  useEffect(() => {
    if (!interactive || !onAction || state.terminal.over) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      const pos = state.pawns[state.to_move];
      if (!pos) return;

      let targetR = pos[0];
      let targetC = pos[1];
      if (e.key === 'ArrowUp') targetR += 1;
      else if (e.key === 'ArrowDown') targetR -= 1;
      else if (e.key === 'ArrowLeft') targetC -= 1;
      else if (e.key === 'ArrowRight') targetC += 1;
      else return;

      const match = (state.legal.MOVE || []).find(([r, c]) => r === targetR && c === targetC);
      if (match) {
        e.preventDefault();
        onAction(['MOVE', match]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, interactive, onAction]);

  const targetCells = useMemo(() => {
    const set = new Set<string>();
    if (!interactive) return set;
    const src = mode === 'MOVE' ? state.legal.MOVE : mode === 'HOP' ? state.legal.HOP : mode === 'BLOCK' ? state.legal.BLOCK : [];
    (src || []).forEach(([r, c]) => set.add(`${r},${c}`));
    return set;
  }, [state.legal, mode, interactive]);

  const targetWallSlots = useMemo(() => {
    const set = new Set<string>();
    if (!interactive) return set;
    if (mode === 'WALL_H' || mode === 'WALL_V') {
      const o = mode === 'WALL_H' ? 'H' : 'V';
      (state.legal.WALL || []).filter(([, , wo]) => wo === o).forEach(([r, c]) => set.add(`${r},${c},${o}`));
    } else if (mode === 'REPLACE') {
      (state.legal.REPLACE || []).forEach(([r, c, o]) => set.add(`${r},${c},${o}`));
    }
    return set;
  }, [state.legal, mode, interactive]);

  const blockedMap = useMemo(() => {
    const map = new Map<string, number>();
    (state.blocked || []).forEach((b) => map.set(`${b.r},${b.c}`, b.remaining));
    return map;
  }, [state.blocked]);

  const handleCellClick = (r: number, c: number) => {
    if (!interactive || !onAction || state.terminal.over) return;
    if (mode === 'MOVE' || mode === 'HOP' || mode === 'BLOCK') onAction([mode, [r, c]]);
  };

  const slotClickable = (m: ActionMode, o: 'H' | 'V'): boolean =>
    interactive && (m === 'REPLACE' || (m === 'WALL_H' && o === 'H') || (m === 'WALL_V' && o === 'V'));

  const handleWallSlotClick = (r: number, c: number, o: 'H' | 'V') => {
    if (!interactive || !onAction || state.terminal.over) return;
    if (mode === 'WALL_H' || mode === 'WALL_V') {
      // The H and V slot hit-areas overlap at wall junctions; never place the other orientation
      if ((mode === 'WALL_H' ? 'H' : 'V') !== o) return;
      onAction(['WALL', [r, c, o]]);
    } else if (mode === 'REPLACE') {
      onAction(['REPLACE', [r, c, o]]);
    }
  };

  const verb = mode === 'HOP' ? 'Hop to' : mode === 'BLOCK' ? 'Block' : 'Move to';

  const renderSlot = (r: number, c: number, o: 'H' | 'V') => {
    const slot = wallSlotRect(r, c, o, n);
    const key = `${r},${c},${o}`;
    const isTarget = targetWallSlots.has(key);
    const color = getHeatmapColor(overlayLookup.walls.get(key), overlayLookup.scale);
    const label = `${mode === 'REPLACE' ? 'Move latest wall to' : 'Place wall at'} ${o === 'H' ? 'horizontal' : 'vertical'} ${cellName(r, c)}`;
    // Each candidate is a pill centred on its junction, so neighbouring slots stay distinct
    const trim = cellSize / 2 + 4;
    const pill = o === 'H'
      ? { x: slot.x + trim, y: slot.y + 2, width: slot.width - 2 * trim, height: slot.height - 4 }
      : { x: slot.x + 2, y: slot.y + trim, width: slot.width - 4, height: slot.height - 2 * trim };
    const hit = o === 'H'
      ? { x: pill.x, y: slot.y + slot.height / 2 - SLOT_HIT / 2, width: pill.width, height: SLOT_HIT }
      : { x: slot.x + slot.width / 2 - SLOT_HIT / 2, y: pill.y, width: SLOT_HIT, height: pill.height };
    const rect = (
      <>
        {(isTarget || color) && (
          <rect
            className={`bd-slot${isTarget ? ' target' : ''}`}
            {...pill}
            rx={3}
            style={color && !isTarget ? { fill: color, opacity: 0.8 } : undefined}
            pointerEvents="none"
          />
        )}
        <rect
          className="bd-slot-hit"
          {...hit}
          fill="transparent"
          onClick={() => handleWallSlotClick(r, c, o)}
          pointerEvents={slotClickable(mode, o) && isTarget ? 'all' : 'none'}
          cursor={isTarget ? 'pointer' : 'default'}
        />
      </>
    );
    if (!isTarget) return <React.Fragment key={key}>{rect}</React.Fragment>;
    return (
      <g
        key={key}
        className="bd-target"
        tabIndex={0}
        role="button"
        aria-label={label}
        onKeyDown={activate(() => handleWallSlotClick(r, c, o))}
      >
        {rect}
      </g>
    );
  };

  const dist = (p: 0 | 1) => {
    const path = state.paths?.[p];
    return path && path.length > 0 ? path.length - 1 : null;
  };

  return (
    <svg
      ref={svgRef}
      className={`svg-board ${className}`}
      width={viewWidth}
      height={height}
      viewBox={`0 0 ${viewWidth} ${height}`}
      data-testid="wallz-board"
      role="group"
      aria-label={`${n} by ${n} board. Player 0 at ${cellName(...state.pawns[0])}, Player 1 at ${cellName(...state.pawns[1])}.`}
    >
      <defs>
        <pattern id="block-hatch" width="7" height="7" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line className="bd-hatch" x1="0" y1="0" x2="0" y2="7" />
        </pattern>
      </defs>

      {/* Figure plate */}
      <rect
        className="bd-plate"
        x={padding - 8}
        y={padding - 8}
        width={n * cellSize + (n - 1) * wallGap + 16}
        height={n * cellSize + (n - 1) * wallGap + 16}
      />

      {/* Cells */}
      {Array.from({ length: n }).map((_, r) =>
        Array.from({ length: n }).map((__, c) => {
          const rect = cellRect(r, c, n);
          const key = `${r},${c}`;
          const isTarget = targetCells.has(key);
          const blockRemaining = blockedMap.get(key);
          const overlayItem = overlayLookup.cells.get(key);
          const heat = getHeatmapColor(overlayItem, overlayLookup.scale);
          // Goal rows: P1 aims for row 0, P0 for row n-1
          const goal = r === n - 1 ? ' goal-p0' : r === 0 ? ' goal-p1' : '';

          return (
            <g
              key={`cell-${key}`}
              onClick={() => handleCellClick(r, c)}
              style={{ cursor: isTarget ? 'pointer' : 'default' }}
              className={isTarget ? 'bd-target' : undefined}
              tabIndex={isTarget ? 0 : undefined}
              role={isTarget ? 'button' : undefined}
              aria-label={isTarget ? `${verb} ${cellName(r, c)}` : undefined}
              onKeyDown={isTarget ? activate(() => handleCellClick(r, c)) : undefined}
            >
              <rect
                className={`bd-cell${goal}${isTarget ? ' target' : ''}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                style={heat && !isTarget ? { fill: heat } : undefined}
              />
              {blockRemaining !== undefined && (
                <>
                  <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="url(#block-hatch)" />
                  <circle className="bd-badge" cx={rect.x + rect.width - px(11, 0.25)} cy={rect.y + px(11, 0.25)} r={px(9, 0.2)} />
                  <text
                    className="bd-badge-text"
                    x={rect.x + rect.width - px(11, 0.25)}
                    y={rect.y + px(11, 0.25) + px(4, 0.1)}
                    textAnchor="middle"
                    style={{ fontSize: px(12, 0.26) }}
                  >
                    {blockRemaining}
                  </text>
                  <title>{`Blocked for ${blockRemaining} more plies`}</title>
                </>
              )}
              {overlayItem && (
                <text
                  className="bd-overlay-label"
                  x={rect.x + rect.width / 2}
                  y={rect.y + rect.height - px(5, 0.12)}
                  textAnchor="middle"
                  style={{ fontSize: px(11, 0.24) }}
                >
                  {overlayItem.label}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Shortest paths, offset so both stay visible when they share a column */}
      {showPaths &&
        state.paths &&
        state.paths.map((path, p) => {
          if (!path || path.length < 2) return null;
          const points = path.map(([r, c]) => {
            const pt = cellCenter(r, c, n);
            return `${pt.x},${pt.y}`;
          });
          return (
            <polyline
              key={`path-${p}`}
              className={`bd-path p${p}`}
              points={points.join(' ')}
              pointerEvents="none"
            />
          );
        })}

      {/* Wall slots: legal targets are focusable */}
      {Array.from({ length: n - 1 }).map((_, r) =>
        Array.from({ length: n - 1 }).map((__, c) => (
          <React.Fragment key={`slots-${r}-${c}`}>
            {renderSlot(r, c, 'H')}
            {renderSlot(r, c, 'V')}
          </React.Fragment>
        ))
      )}

      {/* Placed walls: P1 walls carry a dashed centre mark so owners differ without colour */}
      {(state.walls || []).map((w, idx) => {
        const slot = wallSlotRect(w.r, w.c, w.o, n);
        const replaceable = w.latest && state.rules.A;
        const inset = 4;
        const vertical = w.o === 'V';
        return (
          <g key={`wall-${idx}`} aria-label={replaceable ? 'Replaceable Wall' : undefined} pointerEvents="none">
            <rect
              className={`bd-wall p${w.owner}${replaceable ? ' latest' : ''}`}
              x={slot.x + (vertical ? 2 : 0)}
              y={slot.y + (vertical ? 0 : 2)}
              width={slot.width - (vertical ? 4 : 0)}
              height={slot.height - (vertical ? 0 : 4)}
            />
            {w.owner === 1 && (
              <line
                className="bd-wall-mark"
                x1={vertical ? slot.x + slot.width / 2 : slot.x + inset}
                y1={vertical ? slot.y + inset : slot.y + slot.height / 2}
                x2={vertical ? slot.x + slot.width / 2 : slot.x + slot.width - inset}
                y2={vertical ? slot.y + slot.height - inset : slot.y + slot.height / 2}
              />
            )}
            <title>{`${w.owner === 0 ? 'Player 0' : 'Player 1'} wall${replaceable ? ', latest: can be moved (Rule A)' : ''}`}</title>
          </g>
        );
      })}

      {/* Pawns */}
      {state.pawns &&
        state.pawns.map(([r, c], p) => {
          const pt = cellCenter(r, c, n);
          return (
            <g key={`pawn-${p}`} pointerEvents="none">
              <circle className={`bd-pawn p${p}`} cx={pt.x} cy={pt.y} r={pawnR} />
              <text
                className="bd-pawn-label"
                x={pt.x}
                y={pt.y + pawnFont * 0.36}
                textAnchor="middle"
                style={{ fontSize: pawnFont }}
              >
                {`P${p}`}
              </text>
            </g>
          );
        })}

      {/* Path lengths in the worked step's own notation, set beside each dashed path */}
      {showPaths &&
        names &&
        ([0, 1] as const).map((p) => {
          const path = state.paths?.[p];
          const d = dist(p);
          if (!path || path.length < 2 || d === null) return null;
          // Never on the pawn's own cell: start one step along the path
          const [mr, mc] = path[Math.max(1, Math.floor((path.length - 1) / 2))];
          const pt = cellCenter(mr, mc, n);
          const left = p === 0;
          const fs = px(15, 0.9);
          const sub = px(11, 0.65);
          // paper backing so the label reads over cells and highlights
          const w = fs * 0.55 + names[p].length * sub * 0.55 + fs * 1.6;
          const x0 = pt.x + (left ? -px(8, 0.2) - w : px(12, 0.25));
          return (
            <g key={`d-${p}`} pointerEvents="none">
            <rect className="bd-label-back" x={x0 - fs * 0.2} y={pt.y + px(5, 0.12) - fs * 0.95} width={w + fs * 0.4} height={fs * 1.45} />
            <text
              className={`bd-dim-label p${p}`}
              x={pt.x + (left ? -px(8, 0.2) : px(12, 0.25))}
              y={pt.y + px(5, 0.12)}
              style={{ fontSize: px(15, 0.9) }}
              textAnchor={left ? 'end' : 'start'}
              pointerEvents="none"
            >
              d<tspan className="bd-dim-sub" dy={px(4, 0.1)} style={{ fontSize: sub }}>{names[p]}</tspan>
              <tspan dy={-px(4, 0.1)}>{` = ${d}`}</tspan>
            </text>
            </g>
          );
        })}
    </svg>
  );
};
