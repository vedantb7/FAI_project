import React from 'react';
import { agentFamily, agentName } from '../lib/notation';

// How each agent decides, and where its final-rule results are committed (README, docs/reports).
const ABOUT: Record<string, { how: string; results: string | null }> = {
  greedy: {
    how: 'Looks one move ahead and plays the action with the largest gap between your shortest path and its own.',
    results: 'experiments/results/final_greedy/',
  },
  minimax: {
    how: 'Searches several moves ahead with alpha-beta pruning, assuming you always reply with your best move.',
    results: 'experiments/results/final_minimax/',
  },
  exact: {
    how: 'Has solved every position of this small game exactly, so it always plays a move that keeps the true result.',
    results: 'experiments/results/final_eval/',
  },
  dqn: {
    how: 'A Double-DQN neural network trained by self-play; it picks the action with the highest predicted value.',
    results: 'experiments/results/final_dqn/',
  },
  random: {
    how: 'Picks any legal action with equal probability. It is the floor every other agent is measured against.',
    results: null,
  },
};

export const AgentCard: React.FC<{ spec: string; player: 0 | 1 }> = ({ spec, player }) => {
  const family = agentFamily(spec);
  const about = ABOUT[family];
  // Release DQN checkpoints predate the final HOP rule (README "Status and results")
  const staleDqn = family === 'dqn' && spec.includes('release');
  return (
    <div className="agent-card">
      <span className="dot" style={{ background: player === 0 ? 'var(--ink)' : 'var(--crimson)' }} aria-hidden="true" />
      <div>
        <h3>
          P{player} · {agentName(spec)}
        </h3>
        <p>{about ? about.how : 'An agent from the project registry.'}</p>
        {staleDqn && (
          <p className="warn">This release model was trained before the final HOP rule, so it is not a final-rule result.</p>
        )}
        {about?.results && (
          <p className="src">
            Final-rule results: <code>{about.results}</code>
          </p>
        )}
      </div>
    </div>
  );
};
