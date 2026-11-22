import React from 'react';

export const GITHUB_URL = 'https://github.com/vedantb7/FAI_project';

// Team and tasks as in the final report's Table 5 (report/final_report/final_report.tex) and README
const TEAM = [
  {
    name: 'Vedant Bondekar',
    role: 'Minimax search with Alpha-Beta pruning, leaf evaluation, move ordering, iterative deepening; validation on the final rules; hop-aware evaluator',
  },
  {
    name: 'Abhishek Tagalpallewar',
    role: 'Core game engine and legal-action generator, Greedy heuristic baseline, rule freeze and test suite, interactive web demo (game, arena, replays)',
  },
  {
    name: 'Chaitanya Chaudhary',
    role: 'Match runner and logging, state-graph builder, exact retrograde solver and its validation, agreement metrics, 2³ factorial ablation and statistics, multi-seed study, result tables',
  },
  {
    name: 'Dhruv Meshram',
    role: 'Masked DQN (CNN+MLP), action codec, self-play training pipeline, replay buffer, training and evaluation on 3×3–9×9, H2/H3/RQ1 runs',
  },
];

export const SiteFooter: React.FC = () => (
  <footer className="site-foot">
    <div>
      <h2>About the project</h2>
      <p>CS 329 · Foundations of AI: Multiagent Systems · IIT Gandhinagar.</p>
      <p>
        Source code, report and rules:{' '}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          github.com/vedantb7/FAI_project
        </a>
      </p>
    </div>
    <div>
      <h2>Team</h2>
      <ul>
        {TEAM.map((m) => (
          <li key={m.name}>
            <b>{m.name}</b> · {m.role}
          </li>
        ))}
      </ul>
    </div>
  </footer>
);
