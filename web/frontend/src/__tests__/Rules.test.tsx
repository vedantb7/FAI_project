import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { RulesPage } from '../pages/Rules';
import stateInitial from './fixtures/state_initial_5x5.json';
import { LESSONS } from '../lib/lessons';

describe('Rules page', () => {
  it('narrates each move of a lesson in plain words and steps on with Next', async () => {
    const s0 = { ...(stateInitial as any), to_move: 0 };
    const s1 = { ...(stateInitial as any), to_move: 1 };
    vi.spyOn(api, 'fetchScenario').mockResolvedValue({
      scenario: {} as any,
      frames: [
        { ply: 0, action: null, state: s0, checks: [] },
        { ply: 1, action: ['WALL', [0, 2, 'H']], state: s1, checks: [{ ok: true, message: 'x' } as any] },
      ],
    });
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(LESSONS[0].steps[0])).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Blue placed a horizontal wall at C1–D1.')).toBeInTheDocument();
    expect(screen.getByText(/Confirmed by the game engine/)).toBeInTheDocument();
  });

  it('has narration for every scenario frame the backend serves', () => {
    // Frame counts from web/backend/scenarios.py (script length + 1)
    const frames: Record<string, number> = {
      move_basics: 4, goal_win: 4, wall_place_and_budget: 3, path_preservation_rejects_wall: 3,
      replace_latest_only: 6, hop_over_wall: 5, block_expires_after_K: 5, no_legal_move_draw: 2, fivefold_repetition_draw: 17,
    };
    for (const l of LESSONS) expect([l.name, l.steps.length]).toEqual([l.name, frames[l.name]]);
  });
});
