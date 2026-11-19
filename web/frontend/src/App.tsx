import React, { Suspense, lazy } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { PlayPage } from './pages/Play';

// Only the Play page is in the initial bundle; the other pages (and recharts, used by
// Training) load on first visit, which keeps the first paint fast.
const ArenaPage = lazy(() => import('./pages/Arena').then((m) => ({ default: m.ArenaPage })));
const ReplaysPage = lazy(() => import('./pages/Replays').then((m) => ({ default: m.ReplaysPage })));
const RulesPage = lazy(() => import('./pages/Rules').then((m) => ({ default: m.RulesPage })));
const TrainingPage = lazy(() => import('./pages/Training').then((m) => ({ default: m.TrainingPage })));

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="navbar">
          <div className="nav-brand">
            <strong>Modified Wallz</strong>
            <span>CS 329 multi-agent study</span>
          </div>
          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Home
            </NavLink>
            <NavLink to="/play" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Play
            </NavLink>
            <NavLink to="/arena" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Arena
            </NavLink>
            <NavLink to="/training" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Training
            </NavLink>
            <NavLink to="/replays" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Replays
            </NavLink>
            <NavLink to="/rules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Rules
            </NavLink>
          </nav>
        </header>

        <Suspense fallback={<div className="main-content"><p className="loading-figure">Loading…</p></div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/arena" element={<ArenaPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/replays" element={<ReplaysPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route
            path="*"
            element={
              <div className="main-content">
                <h2>Page not found</h2>
                <p>
                  Use the navigation above, or go to the <NavLink to="/">home page</NavLink>.
                </p>
              </div>
            }
          />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
};
