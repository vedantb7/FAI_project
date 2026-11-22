import React, { Suspense, lazy } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { PlayPage } from './pages/Play';
import { GITHUB_URL, SiteFooter } from './components/SiteFooter';

// Only Overview and Play are in the initial bundle; the other pages (and recharts, used by
// Results) load on first visit, which keeps the first paint fast.
const RulesPage = lazy(() => import('./pages/Rules').then((m) => ({ default: m.RulesPage })));
const ResultsPage = lazy(() => import('./pages/Results').then((m) => ({ default: m.ResultsPage })));
const MethodPage = lazy(() => import('./pages/Method').then((m) => ({ default: m.MethodPage })));

const link = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`;

export const App: React.FC = () => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="app-container">
        <header className="navbar">
          <div className="nav-brand">
            <strong>Modified Wallz</strong>
            <span>CS 329 Foundations of AI: Multiagent Systems</span>
          </div>
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/" end className={link}>
              Overview
            </NavLink>
            <NavLink to="/rules" className={link}>
              Rules
            </NavLink>
            <NavLink to="/play" className={link}>
              Play
            </NavLink>
            <NavLink to="/method" className={link}>
              How it works
            </NavLink>
            <NavLink to="/results" className={link}>
              Results
            </NavLink>
            <a className="nav-link nav-gh" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
        </header>

        <Suspense fallback={<div className="main-content"><p className="loading-figure">Loading…</p></div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/method" element={<MethodPage />} />
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
        <SiteFooter />
      </div>
    </BrowserRouter>
  );
};
