import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { OraclePanel } from '../components/OraclePanel';

const session = (toMove: 0 | 1, history: any[] = []) =>
  ({ id: 'g1', history, state: { to_move: toMove, terminal: { over: false } } } as any);

describe('OraclePanel', () => {
  it('flags a move that throws away value, judged from the position it was played from', async () => {
    const spy = vi.spyOn(api, 'analyzePosition');
    // Ply 0: P0 to move, position is a WIN; the wall loses, the step keeps the win
    spy.mockResolvedValueOnce({
      player: 0,
      details: { status: 'WIN', rank: 5 },
      overlay: [
        { action: ['MOVE', [1, 1]], value: 1, label: 'WIN in 5' },
        { action: ['WALL', [0, 0, 'H']], value: -1, label: 'LOSS in 4' },
      ],
    } as any);
    const names: [string, string] = ['You', 'Solver'];
    const { rerender } = render(<OraclePanel session={session(0)} names={names} busy={false} />);
    await screen.findByText(/WIN in 5/);

    // Ply 1: P0 played the losing wall; now P1 to move with a WIN
    spy.mockResolvedValueOnce({ player: 1, details: { status: 'WIN', rank: 4 }, overlay: [] } as any);
    rerender(
      <OraclePanel session={session(1, [{ ply: 0, player: 0, action: ['WALL', [0, 0, 'H']] }])} names={names} busy={false} />
    );
    await waitFor(() => expect(screen.getByText(/threw away value: WIN became LOSS for You/)).toBeInTheDocument());
  });

  it('drops a stale answer for the wrong player', async () => {
    vi.spyOn(api, 'analyzePosition').mockResolvedValueOnce({ player: 1, details: { status: 'DRAW', rank: null }, overlay: [] } as any);
    render(<OraclePanel session={session(0)} names={['You', 'Solver']} busy={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/With best play/)).toBeNull();
  });
});
