import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import {
  ActionJson,
  AgentInfo,
  ConfigDefaults,
  Explanation,
  GameConfig,
  SessionData,
} from '../api/types';
import { ActionBar, modeInfo } from '../components/ActionBar';
import { AgentCard } from '../components/AgentCard';
import { AgentPicker } from '../components/AgentPicker';
import { ActionMode, Board } from '../components/Board';
import { ConfigForm } from '../components/ConfigForm';
import { PlayersTable } from '../components/PlayerCard';
import { RuleKey, RuleNote } from '../components/RuleNote';
import { TerminalBanner } from '../components/TerminalBanner';
import { OraclePanel } from '../components/OraclePanel';
import { Timeline } from '../components/Timeline';
import { WorkedStep } from '../components/WorkedStep';
import { agentName, describeAction } from '../lib/notation';
import { parsePreset, resolveAgent } from '../lib/presets';

const RULE_FLAG: Record<RuleKey, 'A' | 'B' | 'C'> = { REPLACE: 'A', HOP: 'B', BLOCK: 'C' };

interface HeldNote {
  player: 0 | 1;
  rule: RuleKey;
}

export const PlayPage: React.FC = () => {
  const [config, setConfig] = useState<GameConfig>({
    board_size: 5,
    A: true,
    B: true,
    C: true,
    K: 3,
    M: 10,
  });
  const [defaults, setDefaults] = useState<ConfigDefaults | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [p0, setP0] = useState<string>('human');
  const [p1, setP1] = useState<string>('greedy');

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentMode, setCurrentMode] = useState<ActionMode>('MOVE');
  const [showPaths, setShowPaths] = useState<boolean>(true);
  const [showOverlay, setShowOverlay] = useState<boolean>(false);
  const [latestExplanation, setLatestExplanation] = useState<Explanation | null>(null);
  const [hint, setHint] = useState<Explanation | null>(null);
  const [hintSpec, setHintSpec] = useState<string>('greedy');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startFailed, setStartFailed] = useState<boolean>(false);
  const [notes, setNotes] = useState<HeldNote[]>([]);
  const [announcement, setAnnouncement] = useState<string>('');

  const [aiThinking, setAiThinking] = useState<boolean>(false);
  // Latest session, read by async callbacks to drop responses that belong to an old game
  const sessionRef = useRef<SessionData | null>(null);
  const startedRef = useRef(false);
  // Rule notes already raised in this game, keyed "player:rule"
  const seenRulesRef = useRef<{ game: string; keys: Set<string> }>({ game: '', keys: new Set() });
  const location = useLocation();

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Load defaults on mount
  useEffect(() => {
    api.fetchConfigDefaults().then((res) => {
      setDefaults(res);
      // A preset game sets its own config; don't let late-arriving defaults overwrite it
      if (res.defaults && !parsePreset(location.search)) {
        setConfig((prev) => ({ ...prev, ...res.defaults }));
      }
    }).catch(console.error);
  }, []);

  // Reload agents whenever config changes
  useEffect(() => {
    api.fetchAgents(config).then((list) => {
      setAgents(list);
      // Fallback if selected agent is no longer available
      const p0Avail = list.find((a) => a.spec === p0)?.available;
      if (p0Avail === false) setP0('human');
      const p1Avail = list.find((a) => a.spec === p1)?.available;
      if (p1Avail === false) setP1('greedy');
    }).catch(console.error);
  }, [config, p0, p1]);

  // Start new game
  const handleStartGame = useCallback(async () => {
    try {
      setErrorMessage(null);
      setStartFailed(false);
      setLatestExplanation(null);
      setHint(null);
      setNotes([]);
      const newSession = await api.createGame(config, p0, p1);
      setSession(newSession);
      setCurrentMode('MOVE');
    } catch (err: any) {
      setStartFailed(true);
      setErrorMessage(err?.data?.error || err.message || 'The server could not start a game.');
    }
  }, [config, p0, p1]);

  // Start initial game once (guarded: React StrictMode runs mount effects twice in dev).
  // A game handed over from the Rules page ("Play From This State") is loaded instead.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const handedOver = (location.state as { sessionId?: string } | null)?.sessionId;
    const preset = handedOver ? null : parsePreset(location.search);
    if (preset) {
      // A "Try it" link: start the preset game directly (agents resolved for that board)
      const cfg = { ...config, ...preset.config };
      api.fetchAgents(cfg).then(async (list) => {
        const a0 = resolveAgent(preset.p0, list) ?? 'human';
        const a1 = resolveAgent(preset.p1, list) ?? 'greedy';
        setConfig(cfg);
        setP0(a0);
        setP1(a1);
        setSession(await api.createGame(cfg, a0, a1));
      }).catch((err: any) => {
        setStartFailed(true);
        setErrorMessage(err?.data?.error || err.message || 'The server could not start the preset game.');
      });
      return;
    }
    if (!handedOver) {
      handleStartGame();
      return;
    }
    api.fetchGame(handedOver).then((s) => {
      setSession(s);
      setP0(s.specs['0'] || 'human');
      setP1(s.specs['1'] || 'human');
      const { max_plies, ...cfg } = s.config as GameConfig & { max_plies?: number };
      setConfig((prev) => ({ ...prev, ...cfg }));
    }).catch(() => handleStartGame());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the selected action mode valid: after a hop/block is used (or walls run out)
  // its button is disabled, so fall back to the first available mode.
  useEffect(() => {
    if (!session) return;
    const modes = modeInfo(session.state).filter((m) => m.shown && m.count > 0);
    if (currentMode && modes.some((m) => m.mode === currentMode)) return;
    setCurrentMode(modes[0]?.mode ?? null);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Raise a held note the first time a modified rule becomes usable for the player to move,
  // and drop a note once that player has used the rule.
  useEffect(() => {
    if (!session) return;
    const seen = seenRulesRef.current;
    if (seen.game !== session.id) {
      seenRulesRef.current = { game: session.id, keys: new Set() };
    }
    const keys = seenRulesRef.current.keys;
    const { state, history } = session;
    const last = history[history.length - 1];
    const fresh: HeldNote[] = [];
    if (!state.terminal.over) {
      const p = state.to_move as 0 | 1;
      (Object.keys(RULE_FLAG) as RuleKey[]).forEach((rule) => {
        const key = `${p}:${rule}`;
        if (state.rules[RULE_FLAG[rule]] && (state.legal[rule]?.length || 0) > 0 && !keys.has(key)) {
          keys.add(key);
          fresh.push({ player: p, rule });
        }
      });
    }
    setNotes((prev) => {
      const kept = prev.filter((nt) => !(last && last.player === nt.player && last.action[0] === nt.rule));
      return fresh.length ? [...kept, ...fresh] : kept;
    });
  }, [session]);

  const names: [string, string] = useMemo(() => {
    const specs = session?.specs || { '0': p0, '1': p1 };
    const humans = [specs['0'], specs['1']].filter((s) => s === 'human').length;
    return [0, 1].map((p) => {
      const s = specs[String(p)];
      if (s === 'human') return humans === 1 ? 'You' : `Player ${p}`;
      return agentName(s);
    }) as [string, string];
  }, [session?.specs, p0, p1]);

  // Announce each new ply for screen readers
  useEffect(() => {
    if (!session) return;
    const last = session.history[session.history.length - 1];
    const { terminal, to_move } = session.state;
    const moved = last ? `${names[last.player]} ${describeAction(last.action)}. ` : '';
    const next = terminal.over ? 'Game over.' : `${names[to_move]} to move.`;
    setAnnouncement(moved + next);
  }, [session?.history.length, session?.state.terminal.over]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle user action
  const handleAction = async (action: ActionJson) => {
    if (!session || session.state.terminal.over) return;
    try {
      setErrorMessage(null);
      setHint(null);
      const updated = await api.sendAction(session.id, action);
      setSession(updated);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.data?.error || err.message);
        // Sync state if returned
        if (err.data?.state) {
          setSession((prev) => (prev ? { ...prev, state: err.data.state } : null));
        }
      } else {
        setErrorMessage(err.message);
      }
    }
  };

  // AI stepping loop with 300 ms pacing. Each scheduled step belongs to one game id:
  // cleanup cancels it, and a late response for a game that is no longer shown is dropped.
  useEffect(() => {
    if (!session || session.state.terminal.over) return;
    const moverSpec = session.specs[String(session.state.to_move)];
    if (!moverSpec || moverSpec === 'human') return;

    const gid = session.id;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAiThinking(true);
      try {
        const stepRes = await api.stepGame(gid, true);
        if (cancelled || sessionRef.current?.id !== gid) return;
        setSession(stepRes.session);
        if (stepRes.explanation) setLatestExplanation(stepRes.explanation);
      } catch (err: any) {
        if (!cancelled && sessionRef.current?.id === gid) {
          setErrorMessage(err?.data?.error || err.message || 'The agent could not move.');
        }
      } finally {
        setAiThinking(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session]);

  // Undo
  const handleUndo = async () => {
    if (!session) return;
    try {
      setErrorMessage(null);
      const updated = await api.undoGame(session.id, 1, true);
      setSession(updated);
      setLatestExplanation(null);
      setHint(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Undo failed');
    }
  };

  // Ask an agent what it would play here (human turn)
  const handleHint = async () => {
    if (!session) return;
    try {
      const exp = await api.analyzePosition(session.id, hintSpec);
      setHint(exp);
    } catch (err: any) {
      setErrorMessage(err.message || 'The hint could not be computed.');
    }
  };

  const isHumanTurn = !!session && session.specs[String(session.state.to_move)] === 'human' && !session.state.terminal.over;

  // Number keys 1-6 pick an action mode on a human turn
  useEffect(() => {
    if (!session || !isHumanTurn) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const m = modeInfo(session.state).find((x) => x.key === e.key && x.shown && x.count > 0);
      if (m) {
        e.preventDefault();
        setCurrentMode(m.mode);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, isHumanTurn]);

  const hintAgents = agents.filter((a) => a.explainable && a.available && a.family !== 'human');

  if (!session) {
    return (
      <div className="main-content" data-testid="play-page">
        {startFailed ? (
          <div className="error-panel" role="alert">
            <h2>The game could not start</h2>
            <p>{errorMessage} Check that the Flask server is running, then try again.</p>
            <button className="btn btn-primary" onClick={handleStartGame}>
              Try again
            </button>
          </div>
        ) : (
          <p className="loading-figure">Setting up the board…</p>
        )}
      </div>
    );
  }

  const { state, history, specs } = session;
  const lastExplained = [...history].reverse().find((h) => h.explanation);
  const stepExplanation = hint ?? lastExplained?.explanation ?? latestExplanation;
  const stepPly = hint ? null : lastExplained?.ply ?? (latestExplanation ? history.length : null);
  const thinkingName = aiThinking ? names[state.to_move] : null;
  const status = state.terminal.over
    ? 'game over'
    : isHumanTurn
    ? names[state.to_move] === 'You'
      ? 'your move'
      : `${names[state.to_move]} to move`
    : `${names[state.to_move]} to move`;
  const note = notes[0];
  // Solved small boards only: the solver's verdict is shown beside the worked step
  const exactAvailable = agents.some((a) => a.family === 'exact' && a.available);
  const agentPlayers = ([0, 1] as const).filter((p) => specs[String(p)] && specs[String(p)] !== 'human');

  return (
    <div className="main-content" data-testid="play-page">
      <div className="play-layout">
        <section className="figure-panel" aria-label="Board">
          <p className="fig-caption">
            <b>Fig. {history.length + 1}</b> · {names[0]} (P0, blue) vs {names[1]} (P1, crimson) · {state.n}×{state.n} · after{' '}
            {history.length} {history.length === 1 ? 'ply' : 'plies'}, {status}.{isHumanTurn ? ' Yellow marks where you can play.' : ''}
          </p>
          <TerminalBanner terminal={state.terminal} />
          <Board
            className="fig-board"
            state={state}
            mode={currentMode}
            overlay={showOverlay && hint ? hint.overlay : undefined}
            showPaths={showPaths}
            names={names}
            onAction={handleAction}
            interactive={isHumanTurn}
          />
          <div className="fig-tools">
            <ActionBar
              state={state}
              currentMode={currentMode}
              onSelectMode={setCurrentMode}
              disabled={!isHumanTurn}
            />
            <label className="check">
              <input type="checkbox" checked={showPaths} onChange={(e) => setShowPaths(e.target.checked)} />
              Show shortest paths
            </label>
          </div>
          <PlayersTable state={state} names={names} />
        </section>

        <section className="work-panel" aria-label="Worked solution">
          <details className="setup">
            <summary>
              New game
              <span className="muted">
                {config.board_size}×{config.board_size} · {agentName(p0)} vs {agentName(p1)}
              </span>
            </summary>
            <div className="setup-body">
              <ConfigForm config={config} defaults={defaults} onChange={setConfig} onNewGame={handleStartGame} />
              <AgentPicker agents={agents} p0={p0} p1={p1} onSelectP0={setP0} onSelectP1={setP1} />
            </div>
          </details>

          <div className="work-section">
            <div className="section-head">
              <h2>{hint ? 'Hint' : 'Worked step'}</h2>
              {isHumanTurn && hintAgents.length > 0 && (
                <div className="hint-controls">
                  <label className="form-label" htmlFor="hint-agent" style={{ margin: 0 }}>
                    Hint from
                  </label>
                  <select
                    id="hint-agent"
                    className="form-select"
                    style={{ width: 'auto' }}
                    value={hintSpec}
                    onChange={(e) => setHintSpec(e.target.value)}
                  >
                    {hintAgents.map((a) => (
                      <option key={a.spec} value={a.spec}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn" onClick={handleHint}>
                    Ask for a hint
                  </button>
                </div>
              )}
            </div>
            <WorkedStep explanation={stepExplanation} ply={stepPly} names={names} thinkingName={thinkingName} />
            {hint && (
              <div className="fig-tools" style={{ marginTop: '0.75rem' }}>
                <label className="check">
                  <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />
                  Show the agent's score for every option on the board
                </label>
                <button className="btn" onClick={() => setHint(null)}>
                  Back to last step
                </button>
              </div>
            )}
          </div>

          {exactAvailable && (
            <div className="work-section">
              <OraclePanel session={session} names={names} busy={aiThinking} />
            </div>
          )}

          {note && (
            <div className="work-section">
              <RuleNote
                rule={note.rule}
                who={names[note.player]}
                k={state.rules.K}
                onDismiss={() => setNotes((prev) => prev.slice(1))}
              />
            </div>
          )}

          <div className="work-section">
            <Timeline
              history={history}
              names={names}
              onUndo={handleUndo}
              canUndo={history.length > 0 && !aiThinking}
            />
          </div>

          {agentPlayers.length > 0 && (
            <div className="work-section">
              <h3 style={{ marginBottom: '0.75rem' }}>{agentPlayers.length === 1 ? 'Who you are playing' : 'The agents'}</h3>
              {agentPlayers.map((p) => (
                <AgentCard key={p} spec={specs[String(p)]} player={p} />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      {errorMessage && session && (
        <div className="toast-error" role="alert">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
};
