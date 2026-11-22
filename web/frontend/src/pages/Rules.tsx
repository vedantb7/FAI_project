import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ScenarioDetail } from '../api/types';
import { Board } from '../components/Board';
import { RulesDialog } from '../components/RulesDialog';
import { TerminalBanner } from '../components/TerminalBanner';
import { LESSON_GROUPS, LESSONS } from '../lib/lessons';
import { describeAction } from '../lib/notation';

const NAMES = ['Blue', 'Red'];

export const RulesPage: React.FC = () => {
  const [lessonIdx, setLessonIdx] = useState(0);
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [ply, setPly] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  const navigate = useNavigate();
  const lesson = LESSONS[lessonIdx];

  useEffect(() => {
    let live = true;
    setDetail(null);
    setPly(0);
    setError(null);
    api
      .fetchScenario(lesson.name)
      .then((d) => live && setDetail(d))
      .catch((e) => live && setError(e?.message || 'Could not load this lesson.'));
    return () => {
      live = false;
    };
  }, [lesson.name]);

  const frames = detail?.frames ?? [];
  const last = Math.max(0, frames.length - 1);
  const frame = frames[ply];
  const atEnd = ply >= last;

  const next = useCallback(() => {
    if (!atEnd) setPly((p) => p + 1);
    else if (lessonIdx < LESSONS.length - 1) setLessonIdx((i) => i + 1);
  }, [atEnd, lessonIdx]);
  const prev = useCallback(() => setPly((p) => Math.max(0, p - 1)), []);

  // Arrow keys step through the lesson (ignored while typing or with the rules open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showDoc || (e.target as HTMLElement)?.closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, showDoc]);

  const playFromHere = async () => {
    try {
      const created = await api.createGameFromScenario(lesson.name, 'human', 'greedy');
      navigate('/play', { state: { sessionId: created.id } });
    } catch (err: any) {
      setError(err?.data?.error || err.message || 'Could not start a game from this position.');
    }
  };

  // Who moved into frame i: the player to move in the frame before it
  const mover = ply > 0 ? frames[ply - 1]?.state.to_move : null;
  const moveLine = frame?.action && mover !== null && mover !== undefined ? `${NAMES[mover]} ${describeAction(frame.action)}.` : 'Starting position.';
  const story = lesson.steps[ply] || '';
  const checks = frame?.checks ?? [];
  const failed = checks.filter((c) => !c.ok);

  return (
    <div className="main-content rules-page" data-testid="rules-page">
      <nav className="rules-lessons" aria-label="Lessons">
        {LESSON_GROUPS.map((g) => (
          <div key={g.title}>
            <h2>{g.title}</h2>
            <ol>
              {g.lessons.map((l) => {
                const i = LESSONS.indexOf(l);
                return (
                  <li key={l.name}>
                    <button className={i === lessonIdx ? 'active' : ''} aria-current={i === lessonIdx ? 'step' : undefined} onClick={() => setLessonIdx(i)}>
                      <span className="rules-num">{i + 1}</span>
                      {l.short}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        <button className="btn rules-doc-btn" onClick={() => setShowDoc(true)}>
          Show full rules
        </button>
      </nav>

      <section className="rules-board" aria-label="Lesson board">
        {frame ? (
          <>
            <TerminalBanner terminal={frame.state.terminal} />
            <Board state={frame.state} showPaths={true} interactive={false} />
          </>
        ) : (
          <p className="loading-figure">{error ?? 'Setting up the position…'}</p>
        )}
      </section>

      <section className="rules-explain" aria-live="polite">
        <p className="rules-kicker">
          Lesson {lessonIdx + 1} of {LESSONS.length}
        </p>
        <h1>{lesson.short}</h1>
        <p className="rules-rule">{lesson.rule}</p>

        <div className="rules-step">
          <p className="rules-step-head">
            {ply === 0 ? 'Start' : `Move ${ply} of ${last}`}
          </p>
          <p className="rules-move">{moveLine}</p>
          {story && <p>{story}</p>}
          {checks.length > 0 && (
            <p className={`rules-checks${failed.length ? ' bad' : ''}`}>
              {failed.length
                ? `✗ ${failed.length} engine check${failed.length > 1 ? 's' : ''} failed: ${failed.map((c) => c.message).join('; ')}`
                : `✓ Confirmed by the game engine (${checks.length} check${checks.length > 1 ? 's' : ''})`}
            </p>
          )}
        </div>

        <div className="rules-controls">
          <button className="btn" onClick={prev} disabled={ply === 0}>
            ← Back
          </button>
          <div className="rules-dots" role="group" aria-label="Moves">
            {frames.map((_, i) => (
              <button key={i} className={i === ply ? 'on' : ''} aria-label={i === 0 ? 'Start' : `Move ${i}`} aria-current={i === ply ? 'step' : undefined} onClick={() => setPly(i)} />
            ))}
          </div>
          <button className="btn btn-primary" onClick={next} disabled={!frame || (atEnd && lessonIdx === LESSONS.length - 1)}>
            {atEnd && lessonIdx < LESSONS.length - 1 ? 'Next lesson →' : 'Next →'}
          </button>
        </div>
        <p className="rules-hint muted">Tip: use the ← and → keys.</p>

        <button className="btn rules-play" onClick={playFromHere} disabled={!frame}>
          Play on from the end of this lesson
        </button>
        {error && frame && (
          <p className="home-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <RulesDialog open={showDoc} onClose={() => setShowDoc(false)} />
    </div>
  );
};
