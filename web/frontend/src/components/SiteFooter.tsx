import React from 'react';

export const GITHUB_URL = 'https://github.com/vedantb7/FAI_project';

// Team and roles as listed in the proposal (report/project_idea.pdf, Table 1)
const TEAM = [
  { name: 'Chaitanya Chaudhary', role: 'Minimax search, move ordering, factorial ablation' },
  { name: 'Dhruv Meshram', role: 'Game engine, legal actions and masking, Greedy baseline' },
  { name: 'Abhishek Tagalpallewar', role: 'Exact retrograde solver, equilibrium metrics, web prototype' },
  { name: 'Vedant Bondekar', role: 'DQN network, self-play training, replay buffer' },
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
