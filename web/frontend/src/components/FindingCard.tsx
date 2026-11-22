import React from 'react';
import { Link } from 'react-router-dom';
import { source } from '../lib/findings';

export type Verdict = 'holds' | 'refuted' | 'mixed' | 'answered';

const VERDICT: Record<Verdict, { mark: string; text: string }> = {
  holds: { mark: '✓', text: 'Holds' },
  refuted: { mark: '✗', text: 'Refuted' },
  mixed: { mark: '◐', text: 'Partly holds' },
  answered: { mark: '→', text: 'Answered' },
};

/** Verdict shown as mark + word, never colour alone. */
export const VerdictBadge: React.FC<{ verdict: Verdict }> = ({ verdict }) => (
  <span className={`verdict verdict-${verdict}`}>
    <span aria-hidden="true">{VERDICT[verdict].mark}</span> {VERDICT[verdict].text}
  </span>
);

const SourceList: React.FC<{ ids: string[] }> = ({ ids }) => (
  <>
    {ids.map((id, i) => {
      const s = source(id);
      return (
        <span key={id}>
          {i > 0 && '; '}
          <code>{s.path}</code> (commit <code>{s.commit}</code>
          {s.dirty ? ', uncommitted changes' : ''})
        </span>
      );
    })}
  </>
);

interface Props {
  id: string;
  tag: string;
  title: string;
  claim: React.ReactNode;
  verdict: Verdict;
  sources: string[];
  tryIt?: { to: string; label: string };
  children?: React.ReactNode;
  note?: React.ReactNode;
}

/** One research question: the claim, the verdict, one figure, its sources and a "try it" link. */
export const FindingCard: React.FC<Props> = ({ id, tag, title, claim, verdict, sources, tryIt, children, note }) => (
  <article className="finding" id={id} aria-labelledby={`${id}-title`}>
    <header className="finding-head">
      <span className="finding-tag">{tag}</span>
      <h2 id={`${id}-title`}>{title}</h2>
      <VerdictBadge verdict={verdict} />
    </header>
    <div className="finding-claim">{claim}</div>
    {children && <div className="finding-figure">{children}</div>}
    {note && <p className="finding-note">{note}</p>}
    <footer className="finding-foot">
      {tryIt && (
        <Link className="btn" to={tryIt.to}>
          Try it: {tryIt.label}
        </Link>
      )}
      {sources.length <= 3 ? (
        <p className="finding-src">
          Source: <SourceList ids={sources} />
        </p>
      ) : (
        <details className="finding-src">
          <summary>Sources ({sources.length} files)</summary>
          <SourceList ids={sources} />
        </details>
      )}
    </footer>
  </article>
);
