---
title: "Karpathy's Autoresearch — Lesson"
description: "Lesson Learned: Karpathy's Autoresearch — Generalizing the LLM-Trains-LLM Mechanism"
---

> *Study notes from exploring [karpathy/autoresearch](https://github.com/karpathy/autoresearch).
> The goal: extract the **general pattern** behind autonomous LLM-driven research
> and map it onto other problem domains (including radiology ML).*

---

## 1. TL;DR — The formula distilled

Karpathy's autoresearch is not really about "LLMs training LLMs." It is a more general recipe:

```
Autonomous optimization =
      (Frozen evaluator)
    + (Narrow mutation surface)
    + (Bounded trial cost)
    + (Reversible state via version control)
    + (Persistent log / memory)
    + (Autonomy directive — no human-in-the-loop)
```

The LLM is just the **search operator**. The cleverness is in the **environment**.
Strip out the "train a GPT" domain, and the same scaffold drives
prompt optimization, query tuning, medical model search, build-time reduction, etc.

---

## 2. How the Karpathy mechanism actually works

### 2.1 Three files, three roles

```
┌────────────────────┬────────────────────────────┬─────────────────────────┐
│ File               │ Mutable by                 │ Role in the loop        │
├────────────────────┼────────────────────────────┼─────────────────────────┤
│ prepare.py         │ Nobody (read-only)         │ Frozen evaluator        │
│ train.py           │ LLM agent                  │ Mutation surface        │
│ program.md         │ Human researcher           │ Agent policy / "org"    │
└────────────────────┴────────────────────────────┴─────────────────────────┘
```

- `prepare.py` encodes the **ground-truth fitness function** (`evaluate_bpb`) and
  runtime constants (seq len, time budget). The agent cannot modify it → it
  cannot game the metric.
- `train.py` is the agent's entire playground: architecture, optimizer,
  hyperparameters, training loop.
- `program.md` is where the **human** iterates — not on the model, but on
  *how the agent researches*. This is meta-programming: you're shaping the
  search policy, not the search target.

### 2.2 The experiment loop (from `program.md`)

```
LOOP FOREVER:
    1. Read git state (current branch/commit)
    2. Hack train.py with a new idea
    3. git commit
    4. uv run train.py > run.log 2>&1      ← 5-min wall clock
    5. grep "^val_bpb:" run.log             ← extract scalar fitness
    6. If crashed → tail run.log, maybe fix, else log "crash" and move on
    7. Record row in results.tsv
    8. If val_bpb improved → keep branch advanced
    9. Else → git reset back to last kept state
```

### 2.3 What each design choice buys you

| Choice | Why it matters |
|---|---|
| **Fixed 5-min time budget** | Experiments become apples-to-apples regardless of what the agent changes (depth, batch, architecture). Also caps blast radius per trial — ~12 trials/hour. |
| **Single writable file** | Shrinks the diff surface → reviewable, revertable, less room for the agent to wander off-task. |
| **Single scalar metric (`val_bpb`)** | No subjective judgment needed. Lower is better. Vocab-size-independent so architectural changes are fair. |
| **Git as state machine** | `commit` = accept mutation, `reset --hard` = reject. Version control *is* the evolutionary memory. No custom infra needed. |
| **`results.tsv` log (untracked)** | Long-horizon memory across iterations so the agent doesn't repeat dead ends. |
| **"NEVER STOP" directive** | Removes the default LLM behavior of checking in for permission. This is the single most important line in `program.md` for overnight autonomy. |
| **Simplicity criterion** | `program.md` explicitly rewards *deletions* that maintain performance. Prevents code bloat / complexity creep over 100+ iterations. |
| **Fast-fail (NaN or loss > 100)** | The script self-aborts on obviously broken runs — saves time budget for real ideas. |

---

## 3. The generalization

Any problem where you can answer all four of these questions can be driven by the same mechanism:

1. **Can you define a scalar fitness function that you trust?**
   (Lower-is-better or higher-is-better, unambiguous, reproducible.)
2. **Can you freeze the evaluator so the agent can't modify it?**
   (Read-only files, pinned dependencies, pinned data split.)
3. **Can you bound each trial in time/cost?**
   (Wall-clock budget, max tokens, max API calls, max compute $.)
4. **Can you cheaply rollback a failed trial?**
   (Git, DB snapshots, config diffs, container image tags.)

If yes → the Karpathy loop applies, with the LLM as the mutation operator.

### The abstract skeleton

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   ┌────────────┐      ┌─────────────┐       ┌─────────────────┐    │
│   │ Frozen     │      │ Mutation    │       │ Agent policy    │    │
│   │ evaluator  │◄─────│ surface     │◄──────│ (program.md-    │    │
│   │ (metric)   │      │ (the file   │       │  equivalent)    │    │
│   └─────┬──────┘      │ agent edits)│       └─────────────────┘    │
│         │             └──────┬──────┘                              │
│         │                    │                                     │
│         ▼                    ▼                                     │
│   ┌──────────────┐     ┌──────────────┐                            │
│   │ Scalar score │◄────│ Bounded trial│                            │
│   └──────┬───────┘     └──────────────┘                            │
│          │                                                         │
│          ▼                                                         │
│   Improve? ── yes ──► commit (advance)                             │
│          │                                                         │
│          └── no  ──► reset (discard)                               │
│                                                                    │
│    Log every trial → persistent memory across iterations           │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Use cases this pattern fits

### 4.1 Prompt & agent optimization (closest analogue)

- **Fitness:** task accuracy on a held-out eval set (BFCL-style, or a private rubric).
- **Frozen:** the eval harness + dataset.
- **Mutation surface:** a single `prompt.md` or `tools.json`.
- **Trial:** one evaluation sweep, capped at N examples or wall-clock.
- **Rollback:** git.
- **Relation to Karpathy's setup:** nearly identical — just swap `train.py` for `prompt.md`.

### 4.2 Medical / radiology ML model tuning *(directly relevant to your work)*

- **Fitness:** AUC / sensitivity at fixed specificity / Dice score on a frozen validation split of a de-identified in-house dataset.
- **Frozen:** the split, the pre-processing, the metric code — **critically important** for regulatory credibility.
- **Mutation surface:** a single `model.py` (architecture + augmentation + loss).
- **Trial:** one training run capped at, say, 15 min on the AI unit's GPU.
- **Rollback:** git.
- **Caveats unique to this domain:**
  - You must prevent *test-set leakage* — the agent must never see test labels. This maps directly onto `prepare.py` being read-only.
  - Clinical safety means some "wins" on val may still be rejected on clinical grounds — consider a human gate on `keep` decisions for anything that will touch production.
  - Log every experiment with commit + metric + model weights' hash for a defensible audit trail (QMS / IEC 62304 friendly).

### 4.3 Database query / index tuning

- **Fitness:** p95 query latency on a fixed workload.
- **Frozen:** the workload generator + schema.
- **Mutation surface:** an `indexes.sql` or `plan_hints.yml`.
- **Trial:** replay the workload for N seconds.

### 4.4 Frontend performance budget

- **Fitness:** Lighthouse score, or TTFB + bundle size as a weighted scalar.
- **Frozen:** the e2e test + measurement harness.
- **Mutation surface:** webpack/vite config + critical components.
- **Trial:** one build + benchmark.

### 4.5 CI / build-time reduction

- **Fitness:** wall-clock time for `make test` on a fixed revision.
- **Frozen:** the test suite and the revision under test.
- **Mutation surface:** build configs, cache hints, Dockerfile layers.
- **Trial:** one clean build.

### 4.6 Domain-specific prompt libraries for clinical documentation

- **Fitness:** structured-extraction F1 against a frozen gold set of radiology reports.
- **Frozen:** gold-annotated reports + scoring script.
- **Mutation surface:** a single prompt/template file.

---

## 5. When this pattern **does not** work

Worth being explicit — this is not a universal hammer:

- **No trustworthy scalar metric.** If the "improvement" requires human taste (UI aesthetics, prose quality in some dimensions), the loop will over-fit to whatever proxy you define. Example: auto-"improving" a piece of writing by a readability score usually produces worse writing.
- **Evaluator is slow or expensive.** If one trial costs \$50 or takes 4 hours, you cannot get the statistical density that makes evolutionary search work. Karpathy's 5-min budget is what makes 100 trials/night feasible.
- **State is not cheaply reversible.** Production DB migrations, sent emails, published artifacts — do not put these inside the loop.
- **Overfitting to validation.** With 100+ trials all optimizing the same eval split, you *will* overfit it. Keep a separate, agent-inaccessible test split and evaluate the final "kept" result on it manually.
- **Reward hacking.** The agent may find degenerate shortcuts (e.g., reducing vocab to shrink the metric's denominator). The `val_bpb` metric is specifically designed to be shortcut-resistant — note that vocab-size-independence was not an accident. Design your metric with the same suspicion.

---

## 6. Design lessons (what to learn from)

1. **Separate the frozen, the mutable, and the policy into three files.**
   This is the architectural insight. `prepare.py` / `train.py` / `program.md`
   is a template worth copying verbatim.

2. **Program the policy, not the solution.**
   The human's job is to improve `program.md` — the *research org's code*
   — not `train.py`. This is the meta-level where leverage lives.

3. **Scalar metric + wall-clock budget → throughput.**
   Aim for >10 trials/hour. Below that, the LLM's variance in idea quality
   dominates and you may as well write the code yourself.

4. **Git is the evolutionary state machine.**
   Don't build a custom experiment tracker. A branch + commits + `results.tsv`
   is enough. Complexity here is pure cost.

5. **"NEVER STOP" is a feature, not a personality trait.**
   Explicitly instruct the agent not to seek permission mid-loop. This is
   counter to default alignment behavior and must be stated.

6. **Log every trial, including the failures.**
   The `results.tsv` is how the agent avoids re-trying a known-dead idea at
   trial #73. Without the log, exploration regresses to the mean.

7. **Keep the simplicity criterion explicit.**
   Without it, 100 iterations of "tiny improvements at any cost" produces
   unreadable code. Karpathy's trick: reward deletions that preserve score.

---

## 7. A radiology-specific sketch (for later discussion)

If you wanted to build an "autoresearch for radiology model tuning" in your AI unit:

```
┌──────────────────────┬──────────────────────────────────────────────┐
│ prepare.py analogue  │ Loads de-identified dataset, computes        │
│ (frozen)             │ AUC/Sensitivity@Spec/DiceScore on a pinned   │
│                      │ val split. Read-only.                        │
├──────────────────────┼──────────────────────────────────────────────┤
│ train.py analogue    │ A single file containing model, augmentations,│
│ (agent-mutable)      │ optimizer, loss. ~500 lines, one GPU.        │
├──────────────────────┼──────────────────────────────────────────────┤
│ program.md analogue  │ Domain guardrails: "do not disable           │
│ (human-mutable)      │ augmentation of lesion masks", "keep spatial │
│                      │ resolution ≥ X", "flag any change that       │
│                      │ reduces sensitivity below baseline for       │
│                      │ clinical review before keep".                │
├──────────────────────┼──────────────────────────────────────────────┤
│ Trial budget         │ 10–20 min / run on local H100.               │
├──────────────────────┼──────────────────────────────────────────────┤
│ Keep/discard rule    │ Primary: AUC on val. Gate: sensitivity       │
│                      │ floor; human review for clinical-risk wins.  │
└──────────────────────┴──────────────────────────────────────────────┘
```

The open question is the **human gate** — medical AI is one of the domains where
*fully* autonomous keep/discard is probably inappropriate. A reasonable compromise:
autonomous *within* a sandbox of architecture/hyperparameter changes, **human-gated**
for anything that changes preprocessing, loss function, or data handling.

---

## 8. The mental model to remember

> **Karpathy didn't build an autonomous researcher. He built an environment in which
> autonomous research emerges from a standard LLM + git + a scalar metric.**

The LLM is the cheap part. The **environment design** is the expensive,
transferable insight — and it ports to almost any optimization-shaped problem
where you can name a number and freeze a rule.
