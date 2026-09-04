---
title: "The Mutability Ladder"
description: "How a shipped system changes, and who holds the pen — runtime config, declarative composition, hooks, plugins, in-process extensions — as pace layers, with the rule for choosing the lowest rung that fits."
---

> Prerequisites: [Microkernel / Plugin Architecture](/concepts/architecture/microkernel-plugin-architecture/) · [Anatomy of a Plugin Mechanism](/concepts/architecture/plugin-mechanism-anatomy/) · Sibling: [Self-Modifying Software](/concepts/architecture/self-modifying-software/)
> Date: 2026-09-04 · This chapter is the concept source for the `extensibility-architecture` skill in [agent-stuff](https://github.com/Lightbridge-KS/agent-stuff).

## The Core Idea

The two preceding chapters go deep on one mechanism: the plugin. This one steps back and asks the question that comes *before* "how should the plugin system work": **should there be a plugin system at all?**

Every shipped program draws a line through itself. On one side is the part that is fixed, compiled and owned by the vendor. On the other is everything a person may change while the software sits installed on their machine. That second side is not one thing. It is a ladder, and each rung answers the same three questions differently: *what* can change, *who* may change it, and *how much power* the change carries.

```
 FIXED ─────────────────────────────────────────────────────────────────────► OPEN

 0 compiled   1 runtime      2 declarative   3 hooks /     4 plugins            5 extensions      6 fork
   core         config         composition     scripting     (merged /            (in-process
                (values)       (data-as-        (code at      registered /         rewrite)
                               behavior)        named seams)  hosted)

 who:  vendor   operator       operator /      power user    third party          trusted operator  anyone
                               power user                                         or the AI agent
 power:  —      CHOOSE         COMPOSE         INJECT        ADD                  REWRITE           OWN
```

Read left to right, each rung is more powerful than the last and demands more trust in whoever climbs it. Read right to left, each rung is cheaper to offer than the last. Most architectural mistakes in this area are a rung mismatch: a plugin system built for a concern that was really a setting, or a settings file stretched until it becomes an untyped programming language.

## Pace Layers

The reason the ladder exists is a rate-of-change argument, and the clearest statement of it is not from software. Stewart Brand, writing about buildings, observed that a building is not one thing but several layers that change at different speeds: the site never changes, the structure lasts decades, the skin is replaced every twenty years, the services every ten, the space plan every few years, and the stuff inside moves daily. Healthy buildings let the fast layers slide over the slow ones without tearing them. Buildings that fuse the layers, a wall that carries both structure and wiring, become impossible to change.

Software has the same shearing layers, and the ladder is their ordering:

| Pace layer (Brand) | Software rung | Changes… | Owned by |
|---|---|---|---|
| Site | 0 · compiled core | per release | vendor |
| Structure | 4 · plugin *contract* | rarely, at great cost | vendor |
| Skin | 4 · plugins, 5 · extensions | per install | third parties, operators |
| Services | 3 · hooks | per project | power users |
| Space plan | 2 · declarative composition | per deployment | operators |
| Stuff | 1 · runtime config | daily | operators, users |

Two things fall out of the table. First, the *contract* of a plugin system belongs to a slow layer even though plugins themselves are fast, which is why the microkernel chapter warns that the contract is the real engineering work. Second, a concern placed on a faster rung than its true rate of change is not merely wasteful. It is a fused wall: the vendor now has to maintain a plugin API for something that would have been a value in a settings file.

## The Iron Man Mark 42

Brand explains why the rungs exist. For the plugin rung specifically, a more vivid picture helps.

In *Iron Man 3*, the Mark 42 armor does not arrive as a suit. It arrives as pieces, each flying in on its own and locking onto Tony Stark wherever he happens to be standing. The pilot does not change to receive them. The pieces know the mount points, the mount points are stable, and any piece that speaks the protocol can attach. A gauntlet built later still fits the same forearm.

That is the plugin rung in one image: **autonomous pieces attaching to a fixed pilot through stable mount points**. The mount points are the contract. The pilot is the core. The pieces are plugins, and the fact that they can arrive in any order, from anywhere, is the openness the rung buys.

The image also shows the rung's limits. A piece cannot rewire the pilot; it can only occupy a mount point that already exists. When Tony wants a fundamentally different capability, he does not build a new piece, he builds a new suit. That is rung 5, the in-process extension that rewrites the host, or rung 6, the fork.

## The Rungs

### Rung 1 · Runtime configuration: choose

Values the operator sets: a port number, a theme, a feature flag, a threshold. The core already contains every behavior; configuration picks among them. The engineering is small but easy to get wrong:

- **One schema, one validation point.** VS Code's settings are declared by the same JSON schema that powers editor completion. A setting the schema does not know is an error, not a silent no-op.
- **An explicit precedence chain.** Defaults, then a file, then environment, then command line, then per-workspace overrides. Write the chain down. Most "the config is being ignored" bugs are precedence bugs.
- **Hot reload or restart, decided per key.** VS Code reloads most settings live and names the ones that need a window reload. Slicer reads its module paths once at startup and requires a restart for everything, which is the honest answer for a merged architecture.

Rung 1 is where most concerns should live. If a concern can be expressed as choosing among behaviors the core already has, stop here.

### Rung 2 · Declarative composition: compose

Data that the core *interprets as behavior*: a pipeline described in YAML, a rule expression, a template, a layout file, a radiology hanging protocol. The operator is no longer choosing among behaviors but assembling them from a vocabulary the core owns.

Slicer's catalog has a small, telling example. A `dicom_support_rule` field holds an expression such as `Modality == 'SEG'`, evaluated by a rule engine over DICOM attributes to suggest which extension can open a dataset. Neither the data nor the extension knows about the other; a line of declarative data connects them. No plugin API was needed for a feature that reads like it needed one.

This rung is the most under-used alternative to a plugin system. Its ceiling is visible when you reach it: the moment you find yourself adding `if customer == X` branches inside the interpreter, the vocabulary has run out and a concern is trying to climb.

### Rung 3 · Hooks and scripting: inject

Named seams where user code runs: git hooks, Claude Code's hook configuration, Lua embedded in a game engine, a `before_save` callback. The host still owns control flow; the user injects behavior at points the host chose to expose.

The design work on this rung is the **event taxonomy by power**. The Self-Modifying Software chapter draws it from pi's hook system, and it generalizes to every hook mechanism:

| Class | Example | On handler crash |
|---|---|---|
| Observe | `turn_end`, `post-commit` | Isolated; fail open |
| Transform | rewrite input before the host sees it | Isolated |
| Chain | each handler patches a result | Isolated |
| Veto | block a tool call, reject a commit | **Not caught; fail closed** |
| Replace | swap the context the host would use | Isolated, over a copy |

The asymmetry in the last column is the single most important line in any hook dispatcher: a crashed permission gate must block, not pass. Observers may fail open; vetoes must fail closed.

### Rung 4 · Plugins: add

Packaged capability, arriving from outside, attaching through a contract. The [Anatomy of a Plugin Mechanism](/concepts/architecture/plugin-mechanism-anatomy/) chapter covers this rung in full: three archetypes on a coupling spectrum, and nine decisions every mechanism must make.

| Archetype | Coupling | Example | Buys | Costs |
|---|---|---|---|---|
| **Merged** | plugin becomes indistinguishable from core | 3D Slicer | unlimited power | no isolation, restart lifecycle, rebuild per host version |
| **Registered** | in-process, but core reads only a registry | OpenClaw, MONAI Deploy | one integration point, uniform policy | no process wall; tests hold the line |
| **Hosted** | separate process, async RPC only | VS Code | the host cannot be frozen; live install | no synchronous API, ever |

What the plugin rung cannot do is as important as what it can. A plugin occupies mount points the core exposed in advance. It adds; it does not rewrite.

### Rung 5 · In-process extensions: rewrite

A file that imports the whole host and may replace its built-ins: Emacs Lisp, Excel VBA, pi's extension directory. The extension does not attach to a mount point; it reaches into control flow and changes it. Replace a tool, swap the system prompt, intercept raw input, redraw the UI.

Trust on this rung is binary. There is no partial admission of code that imports your runtime, so every control is admission-shaped (who may put a file in this directory, who may trigger a reload) and none is containment-shaped. The [Self-Modifying Software](/concepts/architecture/self-modifying-software/) chapter is entirely about this rung and the loop that opens when the host contains an AI agent with file tools.

### Rung 6 · Fork: own

Source code, the escape hatch of last resort. Worth one line in any design: is this the *intended* answer for anything, or the sign that a lower rung is missing?

## Who Holds the Pen

The second axis of the ladder is the author, and it deserves its own pass because the cast has recently grown by one.

| Author | Natural rungs | Trust basis |
|---|---|---|
| Vendor | 0 | owns the code |
| Operator (deploys and runs it) | 1, 2 | owns the machine |
| Power user | 2, 3 | owns their own workspace |
| Third-party developer | 4 | signed, reviewed, or sandboxed |
| Trusted operator with source access | 5 | same as local code |
| **The AI agent inside the host** | 3, 4, 5 | whatever the seam admits |

The last row is new. An agent with ordinary file-editing tools can author at any rung whose artifact is a file: it can write a config entry, a YAML pipeline, a hook script, a plugin directory, an extension. If the host also reloads in-process, the agent can then *use* what it wrote in the same session. The extension seam, designed for human power users, quietly becomes a self-modification loop.

Design for that explicitly. Two questions per rung: *may the agent author here?* and *what guards activation?* Pi lets the agent write extensions freely but reserves reload for a user-level command. OpenClaw lets the agent create skills but keeps plugin installation owner-only and off by default. The pattern is an **asymmetric lock**: authoring is cheap, activation is a human act.

## The Rule: Lowest Sufficient Rung

Everything above compresses to one rule for design, and one finding for review.

> **Give each concern the least powerful rung that satisfies who changes it, how often, how much trust, and whether it must be hot.**

Each rung up costs a contract, versioning, documentation, and a trust decision. Each rung up buys openness. A concern placed too high pays those costs for nothing. A concern placed too low forces users to fork, or forces the vendor to keep adding branches to an interpreter that was never meant to be a language.

In practice the rule is applied through a **variability inventory**, a table drawn up before any mechanism is chosen:

| Concern | Who changes it | How often | Trust | Hot? | Rung |
|---|---|---|---|---|---|
| Listening port | operator | per deploy | high | no | 1 |
| Segmentation pipeline stages | operator | per site | high | no | 2 |
| Pre-commit checks | power user | per project | own machine | yes | 3 |
| New messaging platform | third party | rarely | low | no | 4 · registered |
| Block writes outside the repo | agent or operator | ad hoc | high | yes | 5 |

Only after the table exists does a plugin system earn the right to be designed. If no row lands on rung 4 or higher, there is no plugin system to design, and saying so is the most valuable output of the exercise.

## The Seam Test

Whatever rung a concern lands on, the seam has a falsifiable test, borrowed from the OpenClaw distilled proof of concept:

> Add a config entry, a hook, a plugin, or an extension **without editing the core**. If you must edit the core, the seam leaks. Fix the seam, not the symptom.

Run it in review as a question about the codebase. Require it in design as an acceptance criterion. A seam that passes the test is a rung; a seam that fails it is a wall with a hole in it.

## Choosing, in Order

The ladder is walked bottom-up, and each step constrains the next:

```
 variability inventory
        │
        ▼
 lowest sufficient rung per concern ──► no rung ≥ 4?  ──►  done: config + composition + hooks
        │
        ▼ (some concern needs plugins)
 who writes them, how trusted?  ──►  archetype: merged · registered · hosted
        │
        ▼
 the nine decisions (Anatomy chapter)
        │
        ▼
 may the agent author here?  ──►  asymmetric lock on activation
```

## Key Properties to Internalize

- **Extensibility is a ladder, not a switch.** Config, composition, hooks, plugins, extensions, fork: six rungs, each with its own author and its own power.
- **Rungs are pace layers.** Slow layers carry fast ones. A concern placed on the wrong rung is a fused wall.
- **Lowest sufficient rung.** The most valuable sentence a design review can contain is "you do not need a plugin system for this."
- **The variability inventory comes first.** No archetype is chosen before the table exists.
- **Vetoes fail closed, observers fail open.** The dispatcher's missing `try/except` is a feature.
- **The agent is now an author.** Ask, per rung, whether it may write there and what human act guards activation.
- **Test the seam.** Add without editing the core, or fix the seam.
