import React from 'react';

export type RuleKey = 'REPLACE' | 'HOP' | 'BLOCK';

// Plain-language summary of each modified rule (docs/game_rules.md). Availability comes from the engine.
const TEXT: Record<RuleKey, (k: number) => { title: string; body: string }> = {
  REPLACE: () => ({
    title: 'Reusable walls (Rule A)',
    body: 'can move their most recent wall to another free slot. It costs nothing and works even with no walls left.',
  }),
  HOP: () => ({
    title: 'One-time hop (Rule B)',
    body: 'can step across a wall the opponent placed, into the cell behind it. Once per game.',
  }),
  BLOCK: (k) => ({
    title: 'Temporary block (Rule C)',
    body: `can block an empty cell for ${k} plies so neither pawn can enter it. Once per game.`,
  }),
};

interface RuleNoteProps {
  rule: RuleKey;
  who: string;
  k: number;
  onDismiss: () => void;
}

/** A rule that just became usable. It stays until the player uses it or dismisses it. */
export const RuleNote: React.FC<RuleNoteProps> = ({ rule, who, k, onDismiss }) => {
  const t = TEXT[rule](k);
  return (
    <div className="rule-note" role="status">
      <p>
        <b>{t.title} is now available.</b> {who} {t.body}
      </p>
      <button className="btn" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
};
