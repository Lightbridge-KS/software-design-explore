---
title: "Extracting a Fixed Value into Configuration, in Layers"
---

The useful idea here is **binding time**: *who* decides a value, and *when*. Making a value configurable means pushing that decision outward and later, away from the developer at typing time and toward the caller, the deployer, or an operator while the system runs. Each layer adds flexibility, and each one has a cost.

```
 Binding time ───────────────────────────────────────────────▶ later, further out
 (who decides, and when?)

 L0  Magic literal     if p > 0.5             developer, while typing
 L1  Named constant    THRESHOLD = 0.5        developer, in one place
 L2  Parameter         f(p, threshold=0.5)    caller, per call
 L3  Config object     TriageConfig(...)      composition root, at wiring
 L4  External source   file / env / CLI       deployer, at startup
 L5  Dynamic config    remote / flags / DB    operator, while running

        ◀── simpler, easier to reason about     more flexible, more moving parts ──▶
```

I'll follow one value up the ladder.

---

## L0 → L1: Name it (Named Constant)

```python
# L0: a magic literal. What is 0.5? Why 0.5? Is it used elsewhere?
def triage(prob):
    return "urgent" if prob > 0.5 else "routine"

# L1: a named constant
URGENT_THRESHOLD = 0.5  # Tuned on validation set v3; see docs/thresholds.md

def triage(prob):
    return "urgent" if prob > URGENT_THRESHOLD else "routine"
```

Naming is the first act of abstraction. The value still lives in code, but it now has a meaning, a single source of truth, and a place to record *why* it is 0.5. For most values this layer is enough, so many refactorings should stop here.

---

## L2: Parameterize (Function Argument)

```python
def triage(prob, threshold=URGENT_THRESHOLD):
    return "urgent" if prob > threshold else "routine"
```

Now the **caller** decides. The biggest win is testability: a test can try `threshold=0.9` without monkey-patching a global. The default still points to the L1 constant, so there is still one source of truth.

The limit shows up when the threshold has to travel through five layers of function calls to reach `triage`. That is the signal to climb to L3.

---

## L3: Group and Inject (Config Object + Dependency Injection)

```python
from dataclasses import dataclass

@dataclass(frozen=True)  # immutable: config should not change underneath you
class TriageConfig:
    threshold: float = 0.5
    max_batch: int = 32

    def __post_init__(self):
        # Validate at the boundary: fail fast, at startup
        if not 0.0 <= self.threshold <= 1.0:
            raise ValueError(f"threshold must be in [0, 1], got {self.threshold}")

class Triager:
    def __init__(self, config: TriageConfig):
        self._cfg = config

    def triage(self, prob: float) -> str:
        return "urgent" if prob > self._cfg.threshold else "routine"
```

Related knobs become one **typed, validated, immutable** object, and that object is passed in through the constructor. The core logic knows *that* it has a threshold, but not *where it came from*. This layer creates the **seam** (in Michael Feathers' sense) that makes L4 and L5 easy to add later.

---

## L4: Externalize (File, Environment, CLI)

The value now leaves the codebase, so the **deployer** decides at startup. This is where "layers" takes a second meaning: several sources stacked by precedence.

```
  ┌──────────────────────────────┐  highest priority
  │ CLI flags   --threshold 0.6  │  one-off runs, experiments
  ├──────────────────────────────┤
  │ Env vars    APP_THRESHOLD    │  per-deployment, secrets
  ├──────────────────────────────┤
  │ Config file config.toml      │  shared, version-controlled
  ├──────────────────────────────┤
  │ Code defaults TriageConfig() │  always present, safe fallback
  └──────────────────────────────┘  lowest priority

  Each layer overrides only the keys it defines.
```

```python
import os, tomllib
from pathlib import Path

def load_config(path="config.toml", cli_overrides: dict | None = None) -> TriageConfig:
    values: dict = {}

    # 1. File
    if Path(path).exists():
        with open(path, "rb") as f:
            values.update(tomllib.load(f).get("triage", {}))

    # 2. Environment
    if "APP_THRESHOLD" in os.environ:
        values["threshold"] = float(os.environ["APP_THRESHOLD"])

    # 3. CLI (already parsed by argparse/typer)
    values.update({k: v for k, v in (cli_overrides or {}).items() if v is not None})

    # 4. Defaults + validation come from the dataclass itself
    return TriageConfig(**values)
```

The most important rule at this layer is to **read configuration only at the edge**:

```
 main.py (edge)                 typed + validated          pure core
 ┌─────────────────┐           ┌──────────────┐           ┌──────────────┐
 │ load_config()   │ ────────▶ │ TriageConfig │ ────────▶ │ Triager      │
 │ reads env, file,│           └──────────────┘           │ no os.environ│
 │ CLI             │                                      │ no file I/O  │
 └─────────────────┘                                      └──────────────┘
   composition root
```

You don't have to write the loader yourself. `pydantic-settings` does this stacking with type coercion. In .NET, `appsettings.json` plus `appsettings.{Environment}.json` plus env vars feeding into `IOptions<T>` is the same pattern. In Flutter, `--dart-define` covers build-time values. Secrets belong in env vars or a secret manager, never in a committed file.

---

## L5: Make It Dynamic (Runtime Configuration)

At this layer the value can change **while the program runs**, without a redeploy. Examples include Firebase Remote Config, feature-flag services, or a settings table in a database.

```python
from typing import Callable

class Triager:
    def __init__(self, threshold_provider: Callable[[], float]):
        self._threshold = threshold_provider  # a function, not a value

    def triage(self, prob: float) -> str:
        return "urgent" if prob > self._threshold() else "routine"
```

The core now depends on a *provider* rather than a value. This power comes with obligations:
- You need caching, so you don't fetch on every call.
- You need a fallback to the default when the remote source is down.
- You need an audit trail of who changed what, and when.
- The code must tolerate the value changing between two calls in the same request.

This layer is worth it for kill switches, gradual rollouts, and A/B tests. It is overkill almost everywhere else.

---

## Choosing the Right Layer

Ask who needs to change the value, and when they need to change it.

| Situation | Layer |
|---|---|
| Developer changes it rarely; a code review is appropriate | L1 |
| Tests or different callers need different values | L2 / L3 |
| It differs between dev, staging, and prod, or it's a secret | L4 |
| It must change without a redeploy (kill switch, rollout, A/B test) | L5 |

## The Philosophical Caveat

Every configurable knob is a **public contract** and a **multiplier on the state space**. Ten boolean flags make 1,024 possible systems, and you have tested perhaps three of them. Configuration is code that runs without tests, written by someone who may not have read the source.

So climb only as high as a real need demands. Because of L3, climbing later is cheap: once a typed config object exists, moving it to L4 or L5 changes only the edge, not the core.

The common anti-patterns are all failures of this discipline:
- `os.environ[...]` scattered deep in business logic
- One god-object `settings` passed everywhere
- Unvalidated string config that fails at 3 a.m. instead of at startup
- Knobs nobody has ever turned
