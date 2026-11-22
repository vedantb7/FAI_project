import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// The rules file writes maths as TeX ($N \times N$). Map the few commands it uses to Unicode
// so the dialog needs no maths library.
const TEX: [RegExp, string][] = [
  [/\\operatorname\{([^}]*)\}/g, '$1'],
  [/\\text\{([^}]*)\}/g, '$1'],
  [/\\quad/g, ' '],
  [/\\\{/g, '{'],
  [/\\\}/g, '}'],
  [/\\leftarrow/g, '←'],
  [/\\times/g, '×'],
  [/\\ge(q)?/g, '≥'],
  [/\\le(q)?/g, '≤'],
  [/\\neq/g, '≠'],
  [/\\in/g, '∈'],
  [/\\dots/g, '…'],
  [/\\to/g, '→'],
  [/\\varnothing/g, '∅'],
  [/\\tau/g, 'τ'],
  [/_([a-zA-Z0-9])/g, '<sub>$1</sub>'],
  [/\^\*/g, '*'],
];

function texToHtml(src: string): string {
  return src.replace(/\$\$([^$]+)\$\$|\$([^$\n]+)\$/g, (_m, block, inline) => {
    let t: string = (block ?? inline).trim();
    for (const [re, sub] of TEX) t = t.replace(re, sub);
    return block ? `<div class="md-math">${t}</div>` : `<i class="math">${t}</i>`;
  });
}

/** Full rules (docs/game_rules.md, served by the API) as rendered markdown in a modal dialog. */
export const RulesDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);

  useEffect(() => {
    if (!open || html !== null) return;
    // Loaded on first open only, so marked stays out of the page bundle
    Promise.all([api.fetchRules(), import('marked')])
      // The markdown is the project's own rules file from our API, not user input
      .then(([res, { marked }]) => setHtml(marked.parse(texToHtml(res.rules), { async: false }) as string))
      .catch((e) => setError(e?.message || 'Could not load the rules.'));
  }, [open, html]);

  return (
    <dialog ref={ref} className="rules-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-labelledby="rules-dialog-title">
      <div className="rules-dialog-head">
        <h2 id="rules-dialog-title">Full rules</h2>
        <button className="btn" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
      <div className="rules-dialog-body">
        {error ? <p role="alert">{error}</p> : html === null ? <p>Loading the rules…</p> : <div className="md" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </dialog>
  );
};
