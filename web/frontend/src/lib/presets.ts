// URL presets for "Try it" links: /play?n=3&k=1&m=1&abc=111&p0=human&p1=exact
// A player may be a full agent spec ("minimax:depth=2") or a family name ("dqn", "exact"),
// which resolves to the first available agent of that family for the chosen board.
import { AgentInfo, GameConfig } from '../api/types';

export interface Preset {
  config: Partial<GameConfig>;
  p0?: string;
  p1?: string;
}

const int = (v: string | null): number | undefined => {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
};

export function parsePreset(search: string): Preset | null {
  const q = new URLSearchParams(search);
  const config: Partial<GameConfig> = {};
  const n = int(q.get('n'));
  const k = int(q.get('k'));
  const m = int(q.get('m'));
  if (n !== undefined) config.board_size = n;
  if (k !== undefined) config.K = k;
  if (m !== undefined) config.M = m;
  const abc = q.get('abc');
  if (abc && /^[01]{3}$/.test(abc)) {
    config.A = abc[0] === '1';
    config.B = abc[1] === '1';
    config.C = abc[2] === '1';
  }
  const p0 = q.get('p0') ?? undefined;
  const p1 = q.get('p1') ?? undefined;
  if (Object.keys(config).length === 0 && !p0 && !p1) return null;
  return { config, p0, p1 };
}

export function presetQuery(p: { n?: number; k?: number; m?: number; abc?: string; p0?: string; p1?: string }): string {
  const q = new URLSearchParams();
  if (p.n !== undefined) q.set('n', String(p.n));
  if (p.k !== undefined) q.set('k', String(p.k));
  if (p.m !== undefined) q.set('m', String(p.m));
  if (p.abc) q.set('abc', p.abc);
  if (p.p0) q.set('p0', p.p0);
  if (p.p1) q.set('p1', p.p1);
  return `?${q.toString()}`;
}

/** Resolve a preset player against the agents the server offers; null if none fits. */
export function resolveAgent(want: string | undefined, agents: AgentInfo[]): string | null {
  if (!want) return null;
  if (want === 'human') return 'human';
  const usable = agents.filter((a) => a.available);
  const exact = usable.find((a) => a.spec === want);
  if (exact) return exact.spec;
  const family = usable.find((a) => a.family === want);
  return family ? family.spec : null;
}
