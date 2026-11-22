/**
 * Plain-language narration for the nine rule scenarios (web/backend/scenarios.py).
 * Display text only: the positions, legal moves and checks all come from the engine.
 * steps[i] describes frame i (0 = the starting position); an empty string means "just say who moved where".
 */

export interface Lesson {
  name: string;
  short: string;
  rule: string;
  steps: string[];
}

export interface LessonGroup {
  title: string;
  lessons: Lesson[];
}

export const LESSON_GROUPS: LessonGroup[] = [
  {
    title: 'The basic game',
    lessons: [
      {
        name: 'move_basics',
        short: 'Moving',
        rule: 'On your turn, either step one cell up, down, left or right, or place a wall. Pawns cannot step through walls, share a cell, or jump over each other.',
        steps: [
          'Blue (P0) starts on C1 and races to row 5. Red (P1) starts on C5 and races to row 1. The engine refuses a long jump to C5 and a diagonal step to B2.',
          'Blue places a wall just above its own pawn. Walls block everyone, including their owner, so Blue can no longer step straight up.',
          'Red steps sideways to B5. Blue can still go left to B1 or right to D1.',
          'Blue steps left to B1 to walk around its own wall.',
        ],
      },
      {
        name: 'goal_win',
        short: 'Winning',
        rule: 'The first pawn to reach the far row wins at once.',
        steps: [
          'A 3×3 board. Blue on B1 needs row 3; Red on B3 needs row 1.',
          'Blue steps up to B2.',
          'Red steps aside to A3, leaving B3 free.',
          'Blue steps onto B3, which is on row 3. Blue wins immediately.',
        ],
      },
      {
        name: 'wall_place_and_budget',
        short: 'Wall supply',
        rule: 'Each player starts with M walls (here M = 1). A wall covers two cell edges. Placing one uses one from your supply; with none left, you cannot place more.',
        steps: [
          'Both players have 1 wall.',
          'Blue places a wall above A1 and B1. Blue now has 0 walls left.',
          'Red steps to C4. Blue tries to place another wall and the engine refuses: Blue has no walls left.',
        ],
      },
      {
        name: 'path_preservation_rejects_wall',
        short: 'No trapping',
        rule: 'Walls can slow a pawn down, but never trap it: after every move, both pawns must still have some path to their goal row.',
        steps: [
          'A 3×3 board. Blue on B1, Red on B3.',
          'Blue places a wall above A1 and B1. Blue can still leave row 1 through C1.',
          'Red steps to A3. Blue tries a wall above B1 and C1. With the first wall it would close every exit from row 1 (and it shares an edge with it), so the engine refuses it.',
        ],
      },
    ],
  },
  {
    title: 'The three rule changes',
    lessons: [
      {
        name: 'replace_latest_only',
        short: 'A · Reusable walls',
        rule: 'Rule A: instead of placing a new wall, you may move your most recent wall to another slot. It costs nothing, even with no walls left. Older walls stay fixed.',
        steps: [
          'Each player has 5 walls.',
          'Blue places its first wall, above A1 and B1.',
          'Red steps to C4.',
          'Blue places a second wall, above B2 and C2. This is now Blue’s latest wall, so the first one is fixed for good.',
          'Red steps to B4. Blue has 3 walls left. Trying to move the older wall is refused: only the latest wall can move.',
          'Blue moves its latest wall one slot right. Its supply is still 3, because moving a wall is free.',
        ],
      },
      {
        name: 'hop_over_wall',
        short: 'B · One-time hop',
        rule: 'Rule B: once per game, you may step across a wall your opponent placed, into the cell behind it. Open space, your own walls and pawns do not allow a hop.',
        steps: [
          'Blue on C1, Red on C5. Blue tries a hop and the engine refuses: there is no opponent wall to hop over.',
          'Blue steps up to C2. Still no hop, because the space ahead is open.',
          'Red places a wall right above Blue. Blue can no longer step up to C3, but it can now hop across Red’s wall.',
          'Blue hops across the wall to C3. Blue’s hop is now used up.',
          'Red steps to B5. Blue tries a second hop and the engine refuses: one hop per game.',
        ],
      },
      {
        name: 'block_expires_after_K',
        short: 'C · Temporary block',
        rule: 'Rule C: once per game, you may close an empty cell for K plies (here K = 3). No pawn may enter it until the timer runs out.',
        steps: [
          'Neither player has walls; both have one block.',
          'Blue blocks C4, the cell in front of Red. The timer starts at 3 and Red cannot step into C4.',
          'Red goes around to B5. The timer drops to 2.',
          'Blue steps to B1. The timer drops to 1.',
          'Red steps back to C5. The timer reaches 0 and C4 is open again.',
        ],
      },
    ],
  },
  {
    title: 'How a game can be drawn',
    lessons: [
      {
        name: 'no_legal_move_draw',
        short: 'No legal move',
        rule: 'If the player to move has no legal action at all, the game ends in a draw.',
        steps: [
          'A set-up position: Blue on B2, Red on B3. A3 is already blocked, nobody has walls, Red has no hop or block left.',
          'Blue blocks C3. Red’s only neighbours are now blocked (A3, C3) or occupied (B2), and Red has nothing else to play: draw.',
        ],
      },
      {
        name: 'fivefold_repetition_draw',
        short: 'Repetition',
        rule: 'If the exact same position occurs five times, the game ends in a draw.',
        // Plies 4, 8, 12, 16 return to the start; the plies in between use the generic move line
        steps: Array.from({ length: 17 }, (_, i) =>
          i === 0
            ? 'The starting position (1st time). Both pawns will shuffle sideways and back.'
            : i === 16
              ? 'Back to the start for the 5th time: draw by repetition.'
              : i % 4 === 0
                ? `Back to the starting position (${i / 4 + 1}${['', '', 'nd', 'rd', 'th'][i / 4 + 1]} time).`
                : ''
        ),
      },
    ],
  },
];

export const LESSONS: Lesson[] = LESSON_GROUPS.flatMap((g) => g.lessons);
