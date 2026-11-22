import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkedStep } from '../components/WorkedStep';
import { describeAction } from '../lib/notation';

const base = { spec: 'x', decision_seconds: 0, summary: 's', overlay: [] as any[] };

describe('WorkedStep', () => {
  it('writes the Greedy choice as H = d_opp − d_self from the chosen row', () => {
    const exp = {
      ...base,
      agent: 'Greedy',
      player: 1,
      chosen: ['WALL', [0, 0, 'H']] as any,
      overlay: new Array(59).fill({}),
      details: {
        objective: 'H',
        rows: [
          { action: ['MOVE', [3, 2]], H: 1, d_self: 3, d_opp: 4 },
          { action: ['WALL', [0, 0, 'H']], H: 3, d_self: 3, d_opp: 6 },
        ],
      },
    };
    render(<WorkedStep explanation={exp as any} ply={4} names={['You', 'Greedy']} />);
    expect(screen.getByText(/Step 4 · Greedy placed a horizontal wall at A1–B1/)).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText(/of 59 legal actions/)).toBeInTheDocument();
  });

  it('shows Minimax search stats and never invents distances', () => {
    const exp = {
      ...base,
      agent: 'Minimax',
      player: 0,
      chosen: ['MOVE', [1, 2]] as any,
      details: { nodes_expanded: 1284, depth_completed: 2, depth_requested: 2, cutoffs: 37, root_value: 1.5 },
    };
    const { container } = render(<WorkedStep explanation={exp as any} ply={1} names={['Minimax (depth 2)', 'Greedy']} />);
    expect(screen.getByText(/searched 1,284 positions to depth 2 of 2/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/d_/);
  });

  it('names wall slots by the two cells they span', () => {
    expect(describeAction(['WALL', [1, 2, 'V']] as any)).toBe('placed a vertical wall at C2–C3');
    expect(describeAction(['MOVE', [0, 0]] as any)).toBe('moved to A1');
  });
});
