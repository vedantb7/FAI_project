import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FindingCard } from '../components/FindingCard';
import { findings } from '../lib/findings';
import { parsePreset, presetQuery, resolveAgent } from '../lib/presets';
import { MethodPage } from '../pages/Method';
import { ResultsPage } from '../pages/Results';

beforeAll(() => {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

describe('presets', () => {
  it('round-trips a Try-it link', () => {
    const q = presetQuery({ n: 3, k: 1, m: 2, abc: '010', p0: 'human', p1: 'exact' });
    expect(parsePreset(q)).toEqual({
      config: { board_size: 3, K: 1, M: 2, A: false, B: true, C: false },
      p0: 'human',
      p1: 'exact',
    });
  });

  it('ignores an empty or malformed query', () => {
    expect(parsePreset('')).toBeNull();
    expect(parsePreset('?abc=12x&n=foo')).toBeNull();
  });

  it('resolves a family name to an available agent', () => {
    const agents = [
      { spec: 'dqn:path=a.pt', family: 'dqn', available: false },
      { spec: 'dqn:path=b.pt', family: 'dqn', available: true },
    ] as any;
    expect(resolveAgent('dqn', agents)).toBe('dqn:path=b.pt');
    expect(resolveAgent('exact', agents)).toBeNull();
    expect(resolveAgent('human', agents)).toBe('human');
  });
});

describe('FindingCard', () => {
  it('shows the verdict as text and the source file with its commit', () => {
    const id = findings.h1.source;
    render(
      <MemoryRouter>
        <FindingCard id="x" tag="H1" title="Title" claim="Claim" verdict="refuted" sources={[id]} />
      </MemoryRouter>
    );
    expect(screen.getByText('Refuted')).toBeInTheDocument();
    expect(screen.getByText(findings.sources[id].path)).toBeInTheDocument();
  });
});

describe('showcase pages render from findings.json without the backend', () => {
  it('Results has a card for every hypothesis and question', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>
    );
    for (const id of ['h1', 'ablation', 'h2', 'h3', 'h4', 'rq1', 'rq2', 'rq3']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Method renders the solve grid and the example board', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <MemoryRouter>
        <MethodPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId('wallz-board')).toBeInTheDocument();
    expect(screen.getByText(/Design decision/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
