import {
  ActionJson,
  AgentInfo,
  ConfigDefaults,
  Explanation,
  GameConfig,
  ScenarioDetail,
  SessionData,
} from './types';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Empty = same origin (local Flask, Docker). Set at build time for the GitHub Pages site,
// whose API runs on a Hugging Face Space.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

async function send(path: string, options?: RequestInit): Promise<Response> {
  return fetch(API_BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response | null = null;
  // A sleeping Space answers 502/503 (or not at all) while it boots: retry for about a
  // minute, remote API only. Local servers fail fast as before.
  for (let attempt = 0; ; attempt++) {
    try {
      res = await send(path, options);
      if (!API_BASE || (res.status !== 502 && res.status !== 503) || attempt >= 11) break;
    } catch (err) {
      if (!API_BASE || attempt >= 11) throw err;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!res) throw new ApiError(0, 'No response from the game server');

  if (res.status === 204) {
    return {} as T;
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, json.error || `HTTP error ${res.status}`, json);
  }
  return json as T;
}

export const api = {
  // Config & Agents
  fetchConfigDefaults: () => request<ConfigDefaults>('/api/config/defaults'),
  fetchAgents: (cfg: Partial<GameConfig>) => {
    const params = new URLSearchParams();
    if (cfg.board_size) params.set('N', String(cfg.board_size));
    if (cfg.A !== undefined) params.set('A', String(cfg.A));
    if (cfg.B !== undefined) params.set('B', String(cfg.B));
    if (cfg.C !== undefined) params.set('C', String(cfg.C));
    if (cfg.K !== undefined) params.set('K', String(cfg.K));
    if (cfg.M !== undefined) params.set('M', String(cfg.M));
    return request<AgentInfo[]>(`/api/agents?${params.toString()}`);
  },

  // Game Management
  createGame: (config: GameConfig, p0: string, p1: string) =>
    request<SessionData>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ config, p0, p1 }),
    }),
  fetchGame: (id: string) => request<SessionData>(`/api/games/${id}`),
  sendAction: (id: string, action: ActionJson) =>
    request<SessionData>(`/api/games/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  stepGame: (id: string, explain: boolean = true) =>
    request<{ action: ActionJson; explanation: Explanation | null; session: SessionData }>(
      `/api/games/${id}/step`,
      {
        method: 'POST',
        body: JSON.stringify({ explain }),
      }
    ),
  undoGame: (id: string, n: number = 1, toHuman: boolean = false) =>
    request<SessionData>(`/api/games/${id}/undo`, {
      method: 'POST',
      body: JSON.stringify({ n, to_human: toHuman }),
    }),
  deleteGame: (id: string) =>
    request<void>(`/api/games/${id}`, { method: 'DELETE' }),

  // Explain / Analyze
  analyzePosition: (id: string, agentSpec: string) =>
    request<Explanation>(`/api/games/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ agent: agentSpec }),
    }),

  // Scenarios
  fetchScenarios: () => request<any[]>('/api/scenarios'),
  fetchScenario: (name: string) => request<ScenarioDetail>(`/api/scenarios/${name}`),
  createGameFromScenario: (name: string, p0: string = 'human', p1: string = 'human') =>
    request<SessionData>(`/api/games/from-scenario/${name}`, {
      method: 'POST',
      body: JSON.stringify({ p0, p1 }),
    }),

  // Rules Documentation
  fetchRules: () => request<{ rules: string }>('/api/rules'),

};
