# DQN Release Models: Hardware, Provenance and Benchmarks

This page records where and how each released Double-DQN model (`checkpoints/release/dqn_*/`)
was trained, with what software, how long it took, and how fast it decides. The models came
from two machines:

- **3x3, 4x4 and 5x5**: trained on a CPU-only laptop (Machine A, Section 2). The latency in
  Section 2.4 was measured on that machine on 2026-11-22.
- **9x9**: trained on a laptop with a CUDA GPU (Machine B, Section 3). Its figures come from
  the team member's benchmark and provenance report of 2026-11-22. The training log, resume
  checkpoint and step checkpoints of that run are not in the repository.

Match strength under the project's evaluation protocol (100-200 games, both seats, distinct
openings) is in `docs/reports/stage2_dqn.md` Section 12 and `experiments/results/final_dqn/`.
The in-training evaluations below are only 20 matches per opponent with no opening
randomisation, so they are a coarse signal.

## 1. Summary

| Model | Rules | Seed | Env steps | Params | Train commit | Machine / device | Wall time | Steps/s | `model.pt` SHA-256 (prefix) |
|---|---|---:|---:|---:|---|---|---:|---:|---|
| `dqn_3x3` | A B C, K=1, M=1 | 46 | 200,069 | 275,105 | `6519e63` (clean) | A / CPU, 4 threads | 1,136.9 s (19 min) | 176 | `645da070389e3300` |
| `dqn_4x4` | A B C, K=1, M=0 | 42 | 500,001 | 396,732 | `6519e63` (clean) | A / CPU, 4 threads | 4,240.3 s (71 min) | 118 | `a6f8178feac53577` |
| `dqn_5x5` | A B C, K=3, M=10 | 42 | 2,000,035 | 553,697 | `6519e63` (clean) | A / CPU, 4 threads | 24,695.6 s (6.9 h) | 81 | `1f3e5e11cb61a02a` |
| `dqn_9x9` | A B C, K=3, M=10 | 42 | 5,000,015 | 1,534,937 | `c05483a` (in `meta.json`) | B / CUDA | 71,744.5 s (19.9 h) | 69.7 | `7b2c15572a266b1b` |

All four use the same network: a 14-plane input, a 3x3 convolution to 64 channels, 3 more
64-channel convolution blocks, a 256-unit hidden layer and one output per codec action.
Double DQN is on and dueling is off. Training hyperparameters are in `configs/training.yaml`
(batch 128, gamma 0.99, `train_freq` 4, `target_update_freq` 1000, opponent mixture
`[0.5, 0.4, 0.1]` = online network / snapshot pool / Greedy, mirror augmentation p = 0.5).
Each model's own `meta.json` records its board, rules, seed, step and commit.

## 2. 3x3, 4x4 and 5x5 (Machine A)

### 2.1 Hardware

| Component | Specification |
|---|---|
| CPU | 13th Gen Intel Core i7-1355U: 10 cores (2 performance + 8 efficient), 12 threads, up to 5.0 GHz |
| RAM | 16 GB (15.2 GB visible) |
| GPU | Intel Iris Xe (integrated). No CUDA, so training and inference ran on the CPU |
| Storage | 512 GB NVMe SSD (Solidigm SSDPFINW512GZL) |

### 2.2 Software

| Layer | Version |
|---|---|
| OS | Fedora Linux 44 Workstation, kernel 6.19.10 (at the time of the 2026-11-22 benchmark) |
| Python | 3.14.3 (recorded in each run's `run_config.json`) |
| PyTorch | 2.15.0+cpu (recorded in each run's `run_config.json`) |
| NumPy | 2.5.5 (installed at benchmark time; training runs do not record it) |
| Training commit | `6519e63`, clean tree (recorded in each run's `run_config.json`) |

### 2.3 Training runs (2026-11-20)

The runs were trained one at a time through `scripts/train_dqn_all.sh`, with `--threads 4` and
60-minute chunks (`--max-minutes 60 --resume`). The recorded command was:

```
python scripts/train_dqn.py --board-size <N> --seed <S> --threads 4 --max-minutes 60 --resume --output-dir checkpoints/overnight/<N>x<N>_s<S>
```

Each release `model.pt` is byte-identical to its run's `checkpoints/runs/<run>/model.pt`. The run
folders are git-ignored. Wall time is `elapsed_seconds` of the last eval entry in
`train_log.jsonl`, so it includes the in-training evaluations.

| Run | Episodes | Grad steps | Final in-training eval vs Greedy (W / D / L, 20 matches) | vs Random (W / D / L) | Q-probe mean / min / max / start |
|---|---:|---:|---|---|---|
| 3x3 s46 | 6,868 | 49,765 | 50% / 50% / 0% | 100% / 0% / 0% | 0.233 / -1.050 / 1.120 / 0.061 (88 states) |
| 4x4 s42 | 50,521 | 124,749 | 50% / 0% / 50% | 90% / 0% / 10% | 0.151 / -0.977 / 1.003 / -0.887 (96 states) |
| 5x5 s42 | 62,259 | 499,755 | 100% / 0% / 0% | 100% / 0% / 0% | 0.084 / -0.298 / 0.380 / 0.070 (96 states) |

Results under the full protocol (`docs/reports/stage2_dqn.md` Section 12; win / rule draw /
truncated / loss, %):

| Model | vs Random | vs Greedy | vs Minimax d2 | vs Exact | Exact ground truth |
|---|---|---|---|---|---|
| 3x3 s46 | 99.0 / 0.5 / 0 / 0.5 | 64.0 / 21.5 / 0 / 14.5 | 64.0 / 18.0 / 0 / 18.0 | 28.0 / 44.0 / 0 / 28.0 | 96.72% value-optimal, 98.09% sign agreement |
| 4x4 s42 | 97.0 / 0 / 0 / 3.0 | 50.0 / 22.0 / 0 / 28.0 | 39.0 / 32.0 / 0 / 29.0 | 29.0 / 42.0 / 0 / 29.0 | 96.14% value-optimal, 97.56% sign agreement |
| 5x5 s42 | 100.0 / 0 / 0 / 0 | 78.0 / 16.0 / 0 / 6.0 | 74.0 / 4.0 / 0 / 22.0 | — | no exact solve |

### 2.4 Decision latency on Machine A (2026-11-22)

Measured with `scripts/benchmark_latency.py`. Results:
`experiments/results/benchmarks/latency_{3x3,4x4,5x5}.json`. The run was made at `ca301f6`
plus the uncommitted edits that added the script, so the files record `dirty: true`.

Method:
- Batch size 1, CPU, torch default threads (10).
- 5 series of 1,000 timed decisions each, after 100 warm-up decisions per series.
- Positions are taken from seeded uniform-random games under each model's own rules. All
  agents are timed on the same positions.
- Minimax has no time limit, so it searches to the full depth.
- Mean ± std is over the 5 series means. Median, p95 and max are over all 5,000 decisions.

| Board | Agent | Mean (ms) | Median (ms) | p95 (ms) | Max (ms) |
|---|---|---:|---:|---:|---:|
| 3x3 | DQN | 0.188 ± 0.005 | 0.180 | 0.237 | 0.646 |
| 3x3 | Greedy | 0.276 ± 0.010 | 0.240 | 0.725 | 1.346 |
| 3x3 | Minimax d1 | 0.370 ± 0.020 | 0.309 | 0.844 | 1.588 |
| 3x3 | Minimax d2 | 1.227 ± 0.050 | 0.979 | 3.084 | 6.970 |
| 4x4 | DQN | 0.367 ± 0.028 | 0.339 | 0.435 | 14.553 |
| 4x4 | Greedy | 0.170 ± 0.011 | 0.115 | 0.797 | 1.019 |
| 4x4 | Minimax d1 | 0.213 ± 0.014 | 0.141 | 0.887 | 1.184 |
| 4x4 | Minimax d2 | 0.551 ± 0.037 | 0.349 | 2.045 | 3.835 |
| 5x5 | DQN | 0.369 ± 0.054 | 0.297 | 0.622 | 36.640 |
| 5x5 | Greedy | 1.132 ± 0.075 | 0.313 | 4.232 | 7.197 |
| 5x5 | Minimax d1 | 1.299 ± 0.090 | 0.423 | 4.717 | 7.235 |
| 5x5 | Minimax d2 | 7.400 ± 0.502 | 1.119 | 33.369 | 60.696 |

On these small boards the DQN's cost is one forward pass, which is nearly constant (about
0.2-0.4 ms). Greedy and Minimax get slower as the board and the number of legal actions grow. On
4x4 (M = 0, no walls) Greedy is faster than the network. The single DQN maxima of 14.6 ms and
36.6 ms are isolated outliers; the p95 stays under 0.7 ms.

Random-play positions are not the same as positions from real games, so treat these numbers
as relative costs on this machine. Latency depends on the machine and its load.

## 3. 9x9 (Machine B)

Source: the team member's benchmark and provenance report for the 5M-step run (2026-11-22).
This repository does not contain that run's `run_config.json`, `train_log.jsonl`, resume
checkpoint or step checkpoints. The figures in this section therefore cannot be re-derived
from committed files, except the `meta.json` fields and the 100-game evaluation in Section 3.5.

### 3.1 Hardware

| Component | Specification |
|---|---|
| CPU | 13th Gen Intel Core i7-13620H: 10 cores (6 performance + 4 efficient), 16 threads, 2.4 GHz base / 4.9 GHz boost |
| RAM | 16 GB DDR5 (15.64 GB visible) |
| GPU | NVIDIA GeForce RTX 4060 Laptop GPU, 8 GB GDDR6, driver 566.07 |
| Device used | `cuda`, chosen by `resolve_device("auto")` |
| Storage | 1 TB NVMe SSD (Samsung MZVMA1T0HCLD-00BTW) |
| Power | on AC power, Windows "Turbo" power profile, active fan cooling |

### 3.2 Software

| Layer | Version |
|---|---|
| OS | Windows 11 (build 10.0.26300) |
| Python | 3.11.9 (64-bit, MSC v.1938) |
| PyTorch | 2.6.0+cu124 |
| CUDA / cuDNN | CUDA 12.4 runtime (driver supports 12.7) / cuDNN 9.1.0 |
| NumPy | 2.4.4 |

### 3.3 Provenance

- **Initial training commit `5cbcced`.** The original `run_config.json` records it, with a
  500,000-step target.
- **Checkpoint commit `c05483a`.** The final `meta.json` records it, with 5,000,015 steps and
  seed 42. This commit fixes resuming on CUDA (the torch RNG state is moved to the CPU).
- **Release commit `cf5fe30`.** This commit added `checkpoints/release/dqn_9x9/model.pt` and
  `meta.json`. It only publishes the model; it is not the training-code commit.
- **Resume command not recorded.** The exact command used to resume to 5M steps is not
  recorded. The command in Section 4 is a template, not a historical record.
- **What is published.** The release folder holds only `model.pt` and `meta.json`.

### 3.4 Run settings and training

| Setting | Value |
|---|---|
| Seed | 42 |
| PyTorch CPU threads | 10 (`torch.get_num_threads()`, default) |
| Batch size / `train_freq` / `target_update_freq` | 128 / 4 / 1000 |
| Replay buffer | 100,000 transitions, FP16 observations, FP32 weights and gradients |
| Opponent mixture | `[0.5, 0.4, 0.1]` (online / snapshot pool of up to 10 / Greedy) |
| Environment workers | 1 (synchronous) |
| Target / final steps | 5,000,000 / 5,000,015 |
| Wall time | 71,744.5 s (about 19.93 h), about 69.69 environment steps/s |
| Last recorded episode | 74,800, at 4,973,170 steps (the final episode count is not recorded) |

Final in-training evaluation at 5,000,015 steps (20 matches per opponent):

| Opponent | Wins | Draws | Losses | Win rate |
|---|---:|---:|---:|---:|
| Greedy | 10 | 10 | 0 | 50% |
| Random | 14 | 6 | 0 | 70% |

Q-probe over 96 states: mean max-Q 0.0015, min -0.0118, max 0.0146, start state -0.0005.

Earlier in-training evaluations reached:
- 50% vs Greedy at 500k steps (1.67 h).
- 100% vs Greedy at 1,700,550 steps (5.20 h) and at 3,301,137 steps (11.52 h).
- 100% vs Random at 2,600,879 steps (8.48 h) and at 3.5M steps.

These intermediate results do not mean the final checkpoint kept a 100% rate.

### 3.5 Evaluation under the project protocol

`experiments/results/final_dqn/overnight/dqn_9x9_s42_5M_eval.json` was produced by
`scripts/eval_dqn_final.py` at `cf5fe30` (dirty tree). It uses 50 distinct 4-ply openings in
both seats and a 200-ply cap:

| Opponent | Games | Win % [95% Wilson] | Rule draw % | Truncated % | Loss % |
|---|---:|---|---:|---:|---:|
| Random | 100 | 92.0 [85.0, 95.9] | 0 | 8 | 0 |
| Greedy | 100 | 50.0 [40.4, 59.6] | 41 | 0 | 9 |
| Minimax d2 | 100 | 56.0 [46.2, 65.3] | 5 | 7 | 32 |

This is the result to cite for 9x9 strength. With randomised openings the model does lose
some games to Greedy (9 of 100), unlike the 20-match in-training sample in Section 3.4.

### 3.6 Decision latency (Machine B)

> These measurements are from an earlier benchmark on Machine B. They were **not** re-run
> against the final 5M checkpoint, so they describe the hardware and agents, not the exact
> published `dqn_9x9/model.pt`.

Method:
- Batch size 1, 100 warm-up moves.
- `torch.cuda.synchronize()` before and after each `time.perf_counter()` call.
- Mean ± std over the series.

| Agent | Board | Moves | Mean (ms) | Median (ms) | p95 (ms) | Max (ms) |
|---|---|---|---:|---:|---:|---:|
| DQN (GPU) | 9x9 | 1,000 × 5 | 3.23 ± 0.22 | 2.92 | 5.25 | 8.58 |
| Greedy (CPU) | 9x9 | 1,000 × 5 | 40.21 ± 0.74 | 39.20 | 59.04 | 85.37 |
| Minimax d1 (CPU) | 9x9 | 200 × 3 | 43.65 ± 0.27 | 42.38 | 58.20 | 81.71 |
| Minimax d2 (CPU, 0.2 s cap) | 9x9 | 50 × 3 | 197.51 ± 0.06 | 200.80 | 202.03 | 203.03 |
| Exact solver (CPU) | 3x3 | 1,000 × 5 | 0.0022 ± 0.0002 | 0.0019 | 0.0029 | 0.2256 |

Minimax d2 hits its 0.2 s cap on almost every move, so its figure is a capped figure, not the
cost of a full depth-2 search. One recorded game (DQN vs Greedy, 9x9, seed 42) took 1.014 s
for 38 plies. The 9x9 board with M = 10 has no exact solve; `docs/exact_solver.md` lists it as
intractable.

## 4. Reproduction

```bash
# Machine A models (CPU). Trains every board in configs/training.yaml, resumable.
scripts/train_dqn_all.sh 3 4 5
# or one run, matching the recorded settings:
python -m scripts.train_dqn --board-size 5 --seed 42 --threads 4 --max-minutes 60 --resume --output-dir checkpoints/runs/5x5_s42

# 9x9 on a CUDA machine (template; install a CUDA build of torch first, e.g.
# pip install torch --index-url https://download.pytorch.org/whl/cu124)
python -m scripts.train_dqn --board-size 9 --seed 42 --steps 5000000 --eval-freq 100000 --resume --keep-resume --output-dir checkpoints/runs/9x9_s42

# Latency on your machine (add --device cuda on a GPU machine)
python scripts/benchmark_latency.py --model checkpoints/release/dqn_9x9 --out experiments/results/repro/latency_9x9.json

# Protocol evaluation of a release model (--out is a file name inside experiments/results/final_dqn/)
python scripts/eval_dqn_final.py --checkpoint checkpoints/release/dqn_9x9/model.pt --out repro/dqn_9x9_eval.json --skip-truth --exact-seeds 0 --distinct-openings 50

# Verification match
python run_match.py --p0 dqn:path=checkpoints/release/dqn_9x9/model.pt --p1 greedy --board-size 9 -K 3 -M 10 --seed 42
```

GPU training is not bit-for-bit deterministic, and multi-threaded CPU training may not be
either (the trainer seeds Python, NumPy and torch, but does not call
`torch.use_deterministic_algorithms`). A retrained model should reach similar evaluation
numbers, but it will not be byte-identical to the release files.
