---
title: "Refactoring a Monolith into a Modular, Maintainable System"
---

> A reference on strategies for incrementally refactoring a large monolithic
> enterprise application toward clear module boundaries — without a big-bang rewrite.

---

## Core Reframe: Modularity Is About Coupling, Not Topology

A monolith is not bad *because* it's a single deployable. It becomes painful when
it has **tangled coupling** and **low cohesion** — when a change in billing forces
a recompile of imaging, and the "user" concept means five different things in five
places.

The real target is **clear module boundaries with explicit contracts**, not
"microservices." A well-built **modular monolith** is often the correct destination.
Even if you eventually split out services, you must earn modularity *inside* the
monolith first — you cannot extract a clean service from a tangled monolith, you'll
just get a **distributed tangle**, which is strictly worse.

```
   Low cohesion, high coupling          High cohesion, low coupling
   (the problem)                        (the goal)

   ┌───────────────────────┐           ┌────────┐  ┌────────┐  ┌────────┐
   │  ▒▒╲  ╱▒▒  ╲ ╱  ▒▒    │           │ Module │  │ Module │  │ Module │
   │  ▒▒╳▒▒▒▒╳▒▒▒╳▒▒▒▒     │           │   A    │──│   B    │  │   C    │
   │  ╱▒▒╲ ╱▒▒╲ ╱▒▒╲▒▒     │           └────────┘  └───┬────┘  └────────┘
   │ everything reaches    │              (talk only through
   │ into everything       │               explicit contracts)
   └───────────────────────┘
```

The whole game is moving from the left picture to the right — **incrementally**.
Rewrites of large systems famously fail because you lose the encoded edge-case
knowledge that the messy code actually represents.

---

## Step 0 — Build a Safety Net First

Legacy code's specification *is its current behavior*, bugs included. Before moving
anything:

- **Characterization tests** (a.k.a. approval / golden-master tests, per Michael
  Feathers): feed real inputs, capture current output, lock it in. These don't
  assert *correctness* — they assert *no behavioral change*, which is exactly what
  refactoring promises.
- **A real dependency map.** Don't trust the architecture diagram on the wiki — it's
  fiction. Generate the actual dependency graph and look for cycles, "god" modules,
  and surprising edges.

| Ecosystem | Dependency-mapping tools |
|-----------|--------------------------|
| JS / TS   | `dependency-cruiser`     |
| Python    | `import-linter`, `pydeps`|
| .NET      | NDepend, assembly analysis |
| JVM       | ArchUnit (also enforces) |

---

## Step 1 — Find the Right Boundaries (the Hardest Part)

Wrong boundaries are worse than none — they create chatty cross-module calls and
shared mutable state across a line that only *pretends* to be a wall. Two lenses:

**Domain-Driven Design — bounded contexts.** Cut along the business domain, not
technical layers. (Radiology example: *scheduling*, *image acquisition*,
*AI inference*, *reporting*, *billing*.) The tell is **language**: if "study" means
something subtly different to scheduling than to reporting, that's a context
boundary. Don't force one canonical model — let each context own its meaning.

**Conway's Law, used deliberately.** Boundaries that fight team boundaries erode.
If one team owns reporting end-to-end, that's evidence for a reporting module.
(See the dedicated Conway's Law note for the *Inverse Conway Maneuver*.)

---

## Step 2 — Choose What to Extract First (Prioritize by Pain × Change)

Don't start with the scariest or biggest piece. Use **code churn × complexity** from
git history — high-churn, high-complexity files are where you bleed time, so
refactoring them pays back fastest.

```
  high │  Refactor opportunistically │  REFACTOR FIRST
 churn │  (simple, but changes a lot)│  (complex AND changes
       │                             │   constantly — your bleed)
       ├─────────────────────────────┼──────────────────────────
  low  │  Leave alone                │  Refactor only when you
 churn │  (stable + simple)          │  must touch it (stable risk)
       └─────────────────────────────┴──────────────────────────
          low complexity                high complexity
```

Low-churn, high-complexity code is scary but *stable* — leave it until forced to
touch it.

---

## Step 3 — The Extraction Techniques

Roughly coarse → fine:

### Strangler Fig (Fowler)
Put a façade/routing layer in front of a capability. New, cleanly-built modules take
over slices of behavior one at a time; the old code keeps serving the rest. The
monolith shrinks as new modules grow — never down for a rewrite.

```
   BEFORE                 DURING (the strangle)              AFTER
 ┌──────────┐        ┌───────── Facade ──────────┐      ┌──────────┐
 │          │        │  routes each request to   │      │   New    │
 │ Monolith │   →    │  old or new based on slice│  →   │ Modules  │
 │ (all of  │        ├───────────┬───────────────┤      │ (all of  │
 │  it)     │        │ Monolith  │  New Module(s)│      │  it)     │
 │          │        │ (shrinks) │   (grow)      │      │          │
 └──────────┘        └───────────┴───────────────┘      └──────────┘
```

### Branch by Abstraction
Strangler works at the *edges*; this works *inside* the code. Introduce an
abstraction (interface/port) over the thing to replace, point all callers at it,
build the new implementation behind it, flip callers gradually, then delete the old.
Refactors a heavily-used internal component without a long-lived branch.

### Seams (Feathers)
A **seam** is a place you can change behavior *without editing in place* — typically
by injecting a dependency instead of `new`-ing it inside a method. Finding and
opening seams is how you get tangled code under test in the first place; it's the
enabler for everything above.

### Extract Module, in Stages
For a chosen capability:
1. Collect its code into one package/namespace.
2. Make all *inbound* access go through a small public API; mark everything else
   internal.
3. Invert *outbound* dependencies so the module depends on abstractions, not on the
   rest of the monolith.
4. Only then consider a physical split.

Language support matters: .NET `internal` + separate assemblies; Java modules /
package-private + ArchUnit; Python `import-linter` contracts.

### Anti-Corruption Layer (ACL)
When a clean new module must talk to the messy old model, put a translation layer
between them so legacy concepts don't leak in and re-pollute the new design. This is
what keeps the new code from slowly *becoming* the old code.

---

## Step 4 — Get the Dependency Direction Right

Modularity collapses the moment dependencies form cycles. The fix is the
**Dependency Inversion Principle** / hexagonal architecture (ports & adapters):
high-level policy doesn't depend on low-level detail — both depend on abstractions,
and dependencies point *inward* toward stable things.

```
  Tangled:   A ──► B ──► C ──► A        (cycle: changing any breaks all)

  Inverted:  A ──►┤Port├◄── B            B depends on A's interface,
                                          not A on B.  Dependencies point
             detail ──► abstraction       toward the stable abstraction.
```

---

## Step 5 — The Data Is Harder Than the Code

The deepest coupling in most enterprise monoliths is the **shared database** — every
module reaching into every table. Code boundaries are meaningless if all modules
still share mutable tables.

Sequence:
1. Give each module *logical* ownership of its tables (no cross-module writes; reads
   via API or a read model).
2. Enforce it (separate schemas, then separate connections).
3. Split the physical store only if you're truly going to services.

Expect this to take **longer than the code refactor**.

---

## Step 6 — Enforce Boundaries So They Don't Erode

Discipline alone never holds; architecture rots back to a ball of mud unless
boundaries are *executable rules* checked in CI. Write assertions like *"the
reporting module must not import billing internals"* and fail the build on violation.

| Ecosystem | Architecture-test tool |
|-----------|------------------------|
| JVM       | ArchUnit               |
| Python    | `import-linter`        |
| JS / TS   | `dependency-cruiser`   |
| .NET      | NetArchTest            |

**Make the rule a test.**

---

## Compact Roadmap

```
 0. Safety net      → characterization tests + real dependency map
 1. Boundaries      → DDD bounded contexts, aligned to teams
 2. Prioritize      → churn × complexity, attack the bleed first
 3. Extract         → Strangler at edges, Branch-by-Abstraction inside
 4. Invert deps     → ports & adapters, kill cycles
 5. Decouple data   → logical ownership before physical split
 6. Enforce         → architecture tests in CI, forever
```

---

## Common Traps

- **Treating it as a rewrite** instead of a continuous activity.
- **Chasing microservices** before achieving internal modular structure →
  distributed mud.
- **Drawing boundaries on technical layers** (`controllers/`, `services/`,
  `models/`) instead of domains.
- **Skipping the test net**, which turns every refactor into a gamble.

The pragmatic version of all this is the **Boy Scout Rule at scale**: you rarely get
a dedicated "refactoring quarter," so fold these moves into feature work — whenever
you touch a high-churn area, leave it a little more modular than you found it.

---

## Key References

- Martin Fowler — *Refactoring*; *StranglerFigApplication*, *BranchByAbstraction* (martinfowler.com)
- Michael Feathers — *Working Effectively with Legacy Code* (seams, characterization tests)
- Eric Evans — *Domain-Driven Design* (bounded contexts, anti-corruption layer)
- Robert C. Martin — *Clean Architecture* (Dependency Inversion, ports & adapters)
- Skelton & Pais — *Team Topologies* (Conway's Law, cognitive load)
