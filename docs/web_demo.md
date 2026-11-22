# Modified Wallz — Web Demo User & API Guide

## 1. Overview
The Modified Wallz Web Application provides a rich, interactive visualization and evaluation interface for human players, classical AI baselines (Greedy, Minimax), exact retrograde solvers, and deep reinforcement learning agents (Double-DQN).

The application is structured into two completely decoupled layers:
- **Backend (Python / Flask)**: Runs the canonical game engine (`WallzEngine`), maintains transactional session histories, introspects agent decision models, and executes verified replay checks.
- **Frontend (React 18 / TypeScript / Vite)**: An SVG board and dashboard that draws what the backend sends (Contract C-STATE and Contract C-EXPL). It holds no copy of the rules: legal targets, block timers, wall counts, hop/block flags, paths and the terminal reason all come from the engine through the API. Section 7 lists every place the frontend touches game data and how the team checks it.

---

## 2. Quick Start & Setup

### Prerequisites
- Python $\ge 3.10$ with virtual environment created (`.venv`)
- Node.js $\ge 20$ and npm $\ge 10$

### Production Mode (Recommended: Single Process)
Build the frontend production bundle and launch the Flask server:
```bash
# 1. Install frontend dependencies and build production distribution
npm --prefix web/frontend ci
npm --prefix web/frontend run build

# 2. Start the unified Flask server
.venv/bin/python -m web.backend.app --port 5000
```
Open your browser at **`http://localhost:5000`**. The Flask server automatically serves the compiled React single-page app and routes all `/api/*` endpoints.

### Development Mode (Two Processes with Hot Reloading)
```bash
# Terminal 1: Start Flask API backend on port 5000
.venv/bin/python -m web.backend.app --port 5000 --debug

# Terminal 2: Start Vite development server with proxy on port 5173
npm --prefix web/frontend run dev
```
Open **`http://localhost:5173`**. Vite automatically proxies API requests to `http://localhost:5000`.

---

## 3. Pages

The navigation has five pages: **Overview** (`/`), **Rules** (`/rules`), **Play** (`/play`), **How it works** (`/method`) and **Results** (`/results`). The screenshots are in `docs/assets/screenshots/` (`home_view.png`, `rules_view.png`, `play_view.png`, `method_view.png`, `results_view.png`). They were taken from the running production build.

### Overview (`/`)
- Explains the three rule changes (A reusable walls, B one-time hop, C temporary block), each drawn on a small board.
- **Play against an agent** form: pick a board (3×3, 4×4, 5×5 or 9×9, all three rules on) and an opponent. The opponent list only offers agents available for that board. **Start a game** opens Play.

### Rules (`/rules`)
- Nine lessons in three groups:
  - **The basic game**: moving, winning, wall supply, no trapping.
  - **The three rule changes**: A, B, C.
  - **How a game can be drawn**: no legal move, repetition.
- Each lesson steps through a scenario from `tests/scenarios/*.json`. These are the same files `tests/test_scenarios.py` runs (`GET /api/scenarios/<name>`). Each step shows "Confirmed by the game engine (n checks)" when its expectations hold.
- Back/Next buttons and the ← / → keys move between steps. **Play on from the end of this lesson** starts a game from the scenario's final position (`POST /api/games/from-scenario/<name>`).
- **Show full rules** opens `docs/game_rules.md` (served by `GET /api/rules`) in a dialog.

### Play (`/play`)
- **New game** panel:
  - Presets for the trained DQN boards.
  - Board size N ∈ {3, 4, 5, 9}, wall inventory M ∈ [0, 20], block duration K ∈ [1, 9], and the A / B / C toggles.
  - Player 0 and Player 1 chosen independently: human, Random, Greedy, Minimax, the exact solver (on solved boards) or a DQN model (on its own rule set).
- **Board** (SVG):
  - Pawns: P0 blue, P1 crimson. Walls are coloured by owner, and the latest wall is marked as movable under Rule A.
  - Blocked cells are hatched, with a countdown of the plies left.
  - Shortest-path overlays show each player's distance to goal.
- **Action buttons**: Move, Horizontal wall, Vertical wall, Move wall, Hop, Block. Keys 1–6 pick a button on a human turn. Only actions the engine reports as legal are enabled.
- **Worked step** panel: explains the last agent move. For example, the DQN shows Q(chosen), max Q and the number of legal actions; Minimax shows its search result. On a human turn, **Ask for a hint** asks any explainable agent for its move without playing it (`POST /api/games/<id>/analyze`).
- **Exact solver's view**: on boards the solver has solved (3×3 and small 4×4), it shows the position's value under best play. It also says whether each move kept the value or threw some away (e.g. "WIN became DRAW").
- **Plies** list with **Undo**. Undo replays the history through a fresh engine. A notice appears when a rule becomes available (for example "Temporary block (Rule C) is now available").
- **Agent vs agent**: when neither player is human, the agents play on their own until the game ends.
- **URL presets** start a game directly, for example `/play?n=5&k=3&m=10&abc=111&p0=dqn&p1=greedy`. A player can be a full spec (`minimax:depth=2`) or a family name (`dqn`, `exact`). A family name resolves to the first available agent of that family for the board (`web/frontend/src/lib/presets.ts`). The Results and How it works pages link to games this way.

### How it works (`/method`)
- The game as a model: the state (pawns, walls with owners and the latest wall, walls left, hop/block flags, block timers, side to move) and the six action types.
- How each agent gets the value of a position: Greedy and Minimax estimate it, the DQN learns it, and the exact solver computes it. This includes the solve-coverage grid and the evaluation method.

### Results (`/results`)
- Headline numbers, then one card per hypothesis (H1–H4) and research question (RQ1–RQ3). Each card has a verdict, a chart, the numbers, the source file with its commit, and a "Try it" game link.
- **No hand-typed numbers.** Every number on Overview, How it works and Results comes from `web/frontend/src/data/findings.json`. That file is generated by `scripts/export_web_findings.py` from `experiments/results/`. `tests/web/test_web_findings.py` fails if the JSON is stale, so rerun the script after any result changes. How it works and Results do not call the API, so they render without a backend.

---

## 4. Backend REST API Specification

### Game Session Endpoints (`web/backend/routes_games.py`)

| Method | Endpoint | Request Body | Response Body | Description |
|---|---|---|---|---|
| `GET` | `/api/config/defaults` | — | `{defaults, limits, presets}` | Default rules, board limits, and DQN presets |
| `GET` | `/api/agents` | Query params: `N,A,B,C,K,M` | `[AgentInfo]` | List of agents with availability status and reason strings |
| `POST` | `/api/games` | `{config, p0, p1}` | `SessionData` | Create a new game session |
| `GET` | `/api/games/<id>` | — | `SessionData` | Retrieve game session state and history |
| `POST` | `/api/games/<id>/action` | `{"action": [type, value]}` | `SessionData` | Submit a human move (returns 400 with engine error if illegal) |
| `POST` | `/api/games/<id>/step` | `{"explain": true}` | `{action, explanation, session}` | Trigger active AI agent turn and return decision explanation |
| `POST` | `/api/games/<id>/analyze`| `{"agent": "spec"}` | `ExplanationData` | Introspect position using specified agent without advancing state |
| `POST` | `/api/games/<id>/undo` | `{"n": 1, "to_human": true}` | `SessionData` | Undo moves (replays history through fresh engine) |
| `DELETE`| `/api/games/<id>` | — | `204 No Content` | Terminate and clean up session |

### Data & Tournament Endpoints (`web/backend/routes_data.py`)

The current frontend uses only the scenario, from-scenario and rules endpoints below. The arena, replay and training endpoints are API-only: no page calls them. They remain for scripts and for the backend tests in `tests/web/`.

| Method | Endpoint | Request Body | Response Body | Description |
|---|---|---|---|---|
| `POST` | `/api/arena/batch` | `{config, p0, p1, n, seed}` | `{games, by_spec, mean_length, categories, replays}` | Run synchronous AI tournament with Wilson CIs |
| `GET` | `/api/arena/batch/<bid>` | — | Arena batch summary | Retrieve stored tournament results |
| `GET` | `/api/arena/batch/<bid>/<idx>`| — | Replay data with frames | Retrieve individual match from batch |
| `GET` | `/api/replays` | Query: `offset, limit, q` | `{total, items: [ReplaySummary]}` | List experiment result files |
| `GET` | `/api/replays/item` | Query: `file, index` | `{result, verified, frames}` | Retrieve and verify replay ply-by-ply |
| `POST` | `/api/replays/upload` | Raw replay JSON | `{result, verified, frames}` | Verify and frame uploaded replay JSON |
| `GET` | `/api/scenarios` | — | `[ScenarioSummary]` | List 9 canonical rule scenarios |
| `GET` | `/api/scenarios/<name>` | — | `{scenario, frames: [...]}` | Execute scenario and return verification frames |
| `POST` | `/api/games/from-scenario/<name>`| `{"p0": "spec", "p1": "spec"}` | `SessionData` | Create playable game starting from scenario end |
| `GET` | `/api/training/runs` | — | `[RunSummary]` | List available DQN training runs and checkpoints |
| `GET` | `/api/training/runs/<id>` | — | `{meta, curves, evals, opponents}` | Downsampled training curves (win-rate, loss) |
| `GET` | `/api/training/summary` | — | Aggregated benchmark metrics | Summary of gates and experimental ladders |
| `GET` | `/api/training/config` | — | `DQNConfig` dict | Live hyperparameters from `agents.dqn.trainer` |
| `GET` | `/api/rules` | — | `{"rules": markdown_text}` | Raw markdown text of `docs/game_rules.md` |
| `POST` | `/api/training/live` | Training settings | Run status | Start a short live DQN training run (API only) |
| `GET` | `/api/training/live/status` | — | Run status | Status of the live training run |
| `POST` | `/api/training/live/stop` | — | Run status | Stop the live training run |
| `GET` | `/api/training/live/stream` | — | Server-sent events | Progress stream of the live training run |

---

## 5. Agent Explanation Semantics (Contract C-EXPL)

When `/step` or `/analyze` is called, the backend generates an explanation envelope tailored to the agent family:

| Family | Explanation Semantics | Overlay Data | Source of Truth |
|---|---|---|---|
| **Random** | Uniform distribution over all legal actions. | `value = 1 / len(legal)` for all legal moves. | `RandomAgent` |
| **Greedy** | Distance advantage heuristic $H = d_{\text{opp}} - d_{\text{self}}$. Immediate wins assigned $+\infty$. Rows sorted by score. | `value = H` (wins shown as gold star). | `GreedyAgent.score_actions()` |
| **Minimax** | Root move search. Each candidate move value is evaluated using a full-window Negamax search at depth $D-1$. Features $f_1 \dots f_6$ extracted for chosen move. | Per-move value from mover's perspective. | `MinimaxAgent` stats & full-window child search |
| **DQN** | Action-value distribution $Q(s, a)$ computed by the online neural network. Top-5 candidates and network metadata. | $Q(s, a)$ mapped across board heatmap. | `ActionCodec` + `DQNAgent.model(obs)` |
| **Exact** | Game-theoretic status ($\text{WIN}, \text{DRAW}, \text{LOSS}$), distance-to-terminal rank, and optimal moves. | Categorical values $\{+1, 0, -1\}$ with ply distance labels. | `evaluation.retrograde.Solution` |

---

## 6. Performance & Availability Limits

1. **Minimax Interactive Latency**:
   - On boards with $N \ge 7$ only `minimax:depth=1` is offered; `minimax:depth=2` and `minimax:depth=3,time_limit=2.0` are marked unavailable ("too slow for interactive play", `web/backend/registry.py`).
2. **Exact Solver Tractability**:
   - The retrograde solver is offered only for $N \le 4$ with $M \le 1$; otherwise it is marked unavailable with the reason.
   - Solves never block a request. Each runs in a separate process (one at a time) and is written to `experiments/cache/exact/<config>__<source-hash>.pkl`. Until it finishes the agent shows "solving in background". The server pre-solves the preset configs at start-up (disable with `--no-warmup`). On later starts a cached solution is available immediately and loads in about 0.5 s when first used. The source hash covers the engine and solver files, so a rule change automatically invalidates old caches.
   - Before 2026-11-09 the warm-up ran on a thread inside the server. Its pure-Python search held the GIL and made the first page load take about 47 s.
3. **DQN Compatibility Gate**:
   - Checkpoints are strictly validated against board size and rules (`meta.N == config.N` and `meta.rules == config.rules`). Incompatible models are disabled with a message indicating the configuration they were trained for.
   - The demo discovers `checkpoints/release/*` and `checkpoints/dqn_*`. There are four release models. The 3x3, 4x4 and 5x5 models were trained under the final rules on 2026-11-20; the 9x9 model (5M steps) was trained later on a CUDA machine. Each is offered only for the rule set it was trained on, and a matching "DQN N×N" preset is added. Their evaluation is in `experiments/results/final_dqn/overnight/` and `docs/reports/stage2_dqn.md` Section 12. Hardware and training provenance: `docs/dqn_provenance.md`.
4. **Arena Batch Caps** (API only):
   - Batch tournaments are capped at $n \le 50$ games synchronously to prevent server worker timeouts.

---

## 7. How the Demo Stays Consistent with the Engine

The browser cannot run the Python engine, so the rules live only on the server:

1. Every game, arena match, scenario and replay runs on `WallzEngine` (`web/backend/sessions.py`, `arena.py` via `evaluation.match_runner.run_match`, `scenarios.py`, `replays.py`).
2. `web/backend/serialize.py::state_json` sends the engine's own data: `legal` is `engine.get_legal_actions()` grouped by type, and `inventory`, `hop`, `block`, `blocked` (with `remaining` timers), `walls` (with `owner` and `latest`), `paths` (`engine.shortest_path_cells`) and `terminal` (`winner`, `terminal_reason`) are read straight from engine fields.
3. The frontend only highlights the `legal` lists, sends the clicked action back, and shows the server's answer. A click on anything else is sent too and rejected by the engine with HTTP 400 and the engine's error text; the state is unchanged.
4. Undo rebuilds a fresh engine and replays the kept history.

Checks:

| Check | File | What it proves |
|---|---|---|
| API vs engine, ply by ply | `tests/web/test_engine_sync.py` | After every scripted ply the served state equals a shadow `WallzEngine` that replays the same actions (legal set, inventory, walls + latest, hop/block flags, block timers, side to move, terminal). Covers MOVE, WALL with inventory running out, REPLACE of the latest wall only, the one-time HOP across an opponent's wall, BLOCK lasting exactly K plies for K = 1, 2, 3, a path-sealing wall being rejected, and the terminal reasons `goal`, `no_legal_actions`, `repetition` and `truncated`. Also checks the Arena counts come from the match outcome. |
| Single-source guard | `tests/test_single_source.py` | No BFS / legality code in `web/backend` (AST) or `web/frontend/src` (regex). |
| Scenarios | `tests/test_scenarios.py`, `tests/web/test_api_data.py` | The 9 scenario files pass in pytest and through `/api/scenarios`. |
| Replays | `tests/web/test_api_data.py` | A tampered or substituted replay fails verification at the right ply. |

The frontend audit (every place `web/frontend/src` touches game data, with file:line) is in `docs/reports/stage3_greedy_demo_docs.md`.

## 8. Docker

```bash
docker build -t wallz-demo .
docker run --rm -p 5000:5000 wallz-demo
```

Inside the container the server binds `0.0.0.0` on `$PORT` (5000 by default; 7860 on Hugging Face), so the published port is reachable. Run outside Docker, `python -m web.backend.app` keeps its default `--host 127.0.0.1`.

## 9. Public deployment (GitHub Pages + Hugging Face Space)

The site is static and goes to GitHub Pages; the game API (engine and agents) needs Python and runs as a Hugging Face Docker Space built from the same `Dockerfile`.

1. **Space.** Create a Docker Space and push this repository to it. The Space's `README.md` must start with:
   ```yaml
   ---
   title: Modified Wallz
   sdk: docker
   app_port: 7860
   ---
   ```
   In the Space settings add the variables `PORT=7860`, `WALLZ_PUBLIC=1` (disables live training and replay uploads) and `WALLZ_ALLOWED_ORIGIN=https://<user>.github.io` (CORS for the Pages site only; no trailing path).
2. **Pages.** In the GitHub repository, set Pages to "GitHub Actions" and add the Actions variable `API_BASE=https://<user>-<space>.hf.space`. `.github/workflows/pages.yml` builds with `VITE_BASE=/<repo>/` and `VITE_API_BASE=$API_BASE` and copies `index.html` to `404.html` so deep links like `/results` work.
3. **Cold starts.** A sleeping Space answers 502/503 while it boots; the client retries remote calls for about a minute (`web/frontend/src/api/client.ts`). Overview, How it works and Results need no API at all.

Local check of the split setup:
```bash
WALLZ_ALLOWED_ORIGIN=http://localhost:4173 .venv/bin/python -m web.backend.app --port 5000
cd web/frontend && VITE_API_BASE=http://localhost:5000 npm run build && npm run preview
```

