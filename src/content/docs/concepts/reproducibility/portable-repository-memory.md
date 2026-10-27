---
title: "Portable repository memory"
---

*A principle for portable repository memory, for humans and AI agents.*

| | |
|---|---|
| **Version** | 1.0 (2026-10-27) |
| **Applies to** | `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `docs/`, `README.md`, and any committed file an agent writes as "memory" |
| **Builds on** | Reproducibility (*make the implicit explicit, make the explicit executable*) and configuration binding time (L0–L5) |

---

## 1. The Principle

> **Committed memory may contain only facts that are true for every reader of every clone, at any time.**
>
> Anything that depends on *who*, *where*, or *when* is referred to by **name** and given its value **at the edge**, or it is not written down permanently at all.

---

## 2. Why: Memory Is Configuration for Minds

Files such as `AGENTS.md` and `CLAUDE.md` are loaded into every future agent session and read by every collaborator who clones the repository. They behave like configuration, except that the program reading them is a mind rather than an interpreter.

Configuration is already code that runs without tests. Repository memory is the extreme case: a prompt that runs on every clone, on every machine, indefinitely, and nobody tests it. It therefore deserves the same discipline as configuration: named values, a clear boundary between core and edge, and validation.

---

## 3. Diagnosis: Memory Leaks Indexicals

Agents write memory from inside a context saturated with their own situation: `pwd` output, absolute paths in every tool call, the test that is failing right now, the person in the conversation. They record what is true *here, now, for me*, and they have no model of the future reader.

In philosophy of language, words such as *I*, *here*, and *now* are **indexicals** (the classic account is David Kaplan's *Demonstratives*). Their meaning is fixed by the context in which they are said. Many bad memory entries are indexicals in disguise:

| Written in memory | What it actually means |
|---|---|
| `/Users/kittipos/Data/dicom` | "the data folder **here**, on my machine" |
| "tests are currently failing" | "…**now**" |
| "my setup uses Homebrew Python" | "…for **me**" |

Indexicals work in conversation because writer and reader share the context. Committed text travels to other contexts, and the original context does not come with it:

```
  CONTEXT OF WRITING                       CONTEXTS OF READING
  ──────────────────                       ────────────────────────────────────
  who:   KS, in a Claude Code session ──►  teammate · Codex · CI bot · KS in a year
  where: /Users/kittipos/Code/ramaai  ──►  /home/runner/work/… · C:\Users\… · container
  when:  mid-migration                ──►  any time after the next commit
```

---

## 4. The Bridge: Binding Time

Making a value configurable means asking *who decides it, and when*. The configuration ladder runs from L0 (a literal typed inline) through L1 (a named constant), L2 (a function parameter), L3 (a typed, validated config object injected at the composition root), L4 (an external source such as a file, environment variable, or CLI flag, read at startup), to L5 (dynamic configuration changed while running).

Repository memory has the same structure:

```
  CODE CONFIGURATION                        REPOSITORY MEMORY
  ────────────────────────────────          ─────────────────────────────────────
  L0 magic literal   0.5                ≈   "/Users/kittipos/Data/dicom"
  L1 named constant  URGENT_THRESHOLD   ≈   named concept  RAMAAI_DICOM_DIR
  L3 typed config (the contract)        ≈   .env.example  (which names exist)
  L4 .env / env vars at the edge        ≈   .env + personal/local memory files
  pure core: no os.environ inside       ≈   committed AGENTS.md: no machine facts
  validate at startup, fail fast        ≈   lint memory in pre-commit / CI
```

The committed document plays the role of the pure core. It knows **that** a DICOM directory exists and what it is called, but never **where** it is on anyone's disk.

---

## 5. Every Fact Has a Scope; Store It at Its Scope

Almost every sentence worth remembering belongs to one of a few scopes. Only the top row belongs in committed memory; everything below it is bound at the edge.

| Scope | Example | Home |
|---|---|---|
| **Repository** | "Run `just test` before committing." | `AGENTS.md`, `CLAUDE.md`, `docs/` (committed) |
| **Organization** | "QMS procedures use `QP-RAMAAI-NN` DocIDs." | Shared skill or org-level policy |
| **Person** | "KS prefers ASCII diagrams." | User-level memory in the home directory |
| **Machine** | "My DICOM directory is `/Users/kittipos/…`." | `.env` or local memory (gitignored) |
| **Session** | "Migrating the loader, step 3 of 5." | Issue, PR, or gitignored scratch file |
| **Secret** | API keys, PACS credentials | Secret manager; never in prose |

How agent tools map onto these scopes:

| Scope | Claude Code | Codex | Tool-independent |
|---|---|---|---|
| Repository | `CLAUDE.md`, `.claude/rules/*.md` | `AGENTS.md` | `README.md`, `docs/` |
| Person | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | Dotfiles |
| Machine | `CLAUDE.local.md` (gitignored), or an import of a personal file from the home directory; auto memory under `~/.claude/projects/` | — | `.env` (gitignored) |
| Session | — | — | Issue, PR, gitignored `scratch/` |

Tool-specific locations change between versions, so verify against current documentation (for Claude Code: <https://code.claude.com/docs/en/memory>). Note that Claude Code's auto memory is machine-local by design: the toolmakers already apply this principle, because what an agent notes mid-session is usually machine or session truth.

---

## 6. The Four Rewrites: Removing Indexicals

When a note fails the "every reader" test, it almost always fails on one of four axes. Each axis has a standard rewrite.

```
  AXIS    SMELLS LIKE                               REWRITE AS
  ─────   ───────────────────────────────────────   ─────────────────────────────────
  WHERE   /Users/kittipos/…, ~/Desktop, 10.x.x.x,   repo-relative path  (src/io/)
          localhost:8042                            or a named variable (PACS_URL)
  WHO     "I", "my setup", personal emails          a role ("the maintainer"), CODEOWNERS
  WHEN    "currently", "recently", "the new API"    a version, date, or commit SHA,
                                                    or delete it: git log records history
  STATE   "tests failing", "step 3 done ✅"          an issue or PR, or a gitignored scratch file
```

**WHERE.** The repository root is the only "here" that every reader shares, so paths inside the repo are written relative to it. Locations outside the repo are referred to by the name of a variable declared in `.env.example`; the value lives in each person's gitignored `.env`.

**WHO.** Replace people with roles. "Ask the maintainer" survives staff changes; "ask me" does not. Ownership that matters belongs in `CODEOWNERS`, where tools can enforce it.

**WHEN.** "The new API" stays true for a few weeks. Either anchor the claim ("since v0.4.0 the loader returns `Study` objects") or drop it. Git records time far better than prose does.

**STATE.** Progress, current bugs, and half-finished migrations are session facts. They belong in the issue tracker or a PR description, where they have an owner and a natural end.

---

## 7. Two Supporting Rules

**Point, don't copy.** Any value duplicated in prose is a second source of truth that will eventually disagree with the first. Write "Python version: see `.python-version`" rather than "Python 3.12". Write "threshold: see `TriageConfig`" rather than "threshold is 0.5".

**Make it executable.** Prose that describes a command goes stale silently; a task-runner target fails loudly. Write "`just test` runs the suite" rather than a shell recipe with paths and flags. If a fact can become a script, a test, or a config file, it should not stay as prose.

---

## 8. Worked Example

**Before** (what an agent typically writes):

```markdown
## Notes
- Project is at /Users/kittipos/Code/ramaai-triage
- DICOM samples in /Users/kittipos/Data/ramaai/dicom_samples
- Run tests: cd /Users/kittipos/Code/ramaai-triage && .venv/bin/python -m pytest -x
- Recently migrated to uv; test_loader.py currently failing
- PACS dev server at http://10.x.x.x:8042
```

**After** (committed):

```markdown
## Environment
- Python and dependencies are pinned in `.python-version` and `uv.lock`. Set up with `just setup`.
- External data: `RAMAAI_DICOM_DIR`. PACS endpoint: `PACS_URL`.
  Both are declared in `.env.example`; real values go in your gitignored `.env`.

## Commands
- `just test` runs the test suite (flags live in the `justfile`).
```

**Where the leftovers went:**

| Original note | Scope | New home |
|---|---|---|
| "Project is at …" | None | Deleted; the repo root is already "here" |
| DICOM sample path | Machine | `RAMAAI_DICOM_DIR` in `.env` |
| Shell recipe for tests | Repository | `test` target in the `justfile` |
| "Recently migrated to uv" | Time | Deleted; the commit history records it |
| "`test_loader.py` failing" | Session | GitHub issue |
| PACS IP address | Machine | `PACS_URL` in `.env` |

---

## 9. Enforcement: Validate at the Boundary

Configuration is validated at startup; memory can be validated at commit time. The script below catches the most common and most harmful leak (absolute home paths and private IP addresses) and turns it into a failed check instead of a review comment. It cannot catch "currently" or "I"; those still need human judgment.

**`scripts/check-memory.sh`**

```bash
#!/usr/bin/env bash
# scripts/check-memory.sh: "Write for the Clone" lint.
# Fails if committed, agent-facing docs contain machine-local facts.
set -uo pipefail

# What a machine-local fact looks like (extend as needed).
PATTERN='/Users/[^/[:space:]]+/|/home/[^/[:space:]]+/|[A-Za-z]:\\Users\\|10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+'

# Where committed memory lives.
INCLUDE=('*AGENTS.md' '*CLAUDE.md' '.claude/rules/*.md' 'docs/*.md')

# Files allowed to show bad examples on purpose (such as this principle doc).
EXCLUDE=(':(exclude)docs/principles/write-for-the-clone.md')

if git grep --cached -nE "$PATTERN" -- "${INCLUDE[@]}" "${EXCLUDE[@]}"; then
  echo "✗ Machine-local facts found in committed memory." >&2
  echo "  Use repo-relative paths or a variable named in .env.example." >&2
  exit 1
fi
echo "✓ Repository memory is portable."
```

The script checks the staged index (`--cached`), so it tests exactly what is about to be committed. In git pathspecs, `*` also matches `/`, so `*AGENTS.md` covers nested `AGENTS.md` files and `docs/*.md` covers subfolders of `docs/`. This document contains deliberate bad examples, so it is listed in `EXCLUDE`; adjust that path to wherever you keep it.

**Pre-commit hook** (`.pre-commit-config.yaml`):

```yaml
repos:
  - repo: local
    hooks:
      - id: check-memory
        name: Repository memory is portable
        entry: scripts/check-memory.sh
        language: script
        pass_filenames: false
```

**CI** (GitHub Actions step):

```yaml
- uses: actions/checkout@v4
- name: Check repository memory
  run: bash scripts/check-memory.sh
```

---

## 10. Teach the Agent the Rule

Put the principle into the memory itself, so every agent session starts knowing it. This section does for memory what `.env.example` does for configuration: it declares the contract, and each agent fills in values at the right scope.

Paste into `AGENTS.md` or `CLAUDE.md`:

```markdown
## Memory hygiene (for agents editing this file or docs/)
This file is committed and read by every collaborator and agent, on any machine.
- Write only facts that are true for anyone who clones this repo.
- Paths: repo-relative only. External locations: use the env var named in `.env.example`.
- No usernames, hostnames, IPs, or personal preferences; those go in local or user memory.
- No progress logs or "currently…" notes; use an issue, a PR, or a gitignored scratch file.
- Point to a command or file rather than describing or copying it.
```

---

## 11. Security Note for Clinical Repositories

In a hospital setting, a leaked path is a disclosure as well as a portability problem. Paths can expose usernames, internal hostnames, the hospital network's IP ranges, and directory structure. DICOM folders are often named by HN or accession number, so an agent that notes "sample case at …/HN1234567/…" has written a patient identifier into git history.

Deleting the line in a later commit does not remove it from history. If an identifier or secret is committed, treat it as an incident: rewrite history (for example with `git filter-repo`), rotate any exposed credentials, and record the event according to the QMS. For regulated projects, treat the memory lint in Section 9 as a security control, not only a style rule.

---

## 12. Review Checklist

Use this when reviewing any change to committed memory.

| Question | If the answer is "no" |
|---|---|
| Would this sentence be true on a teammate's machine with a different OS and username? | Replace absolute paths with repo-relative paths or named variables. |
| Would it be true inside a CI container? | Same as above; check for host-specific tools and locations. |
| Will it still be true in a year? | Anchor it to a version, date, or commit, or delete it. |
| Is it free of personal names, hostnames, and IP addresses? | Use a role, `CODEOWNERS`, or an environment variable. |
| Is it a durable fact rather than progress or current state? | Move it to an issue, a PR, or a gitignored scratch file. |
| Does it point to the source of truth instead of copying a value? | Link to the file that defines the value. |
| Could it be a command instead of prose? | Add a task-runner target and point to it. |
| Is it free of patient identifiers and secrets? | Remove it, and follow the incident steps in Section 11 if already committed. |

---

## 13. Summary

Left alone, an agent keeps a **lab notebook**: what I did, where, and when. A repository needs a **textbook**: what is true here, and why. Git is already an excellent lab notebook (log, pull requests, issues), so committed memory can afford to be purely the textbook.

Bind memory the way you bind configuration:

```
  universal facts    ──►  bound at commit time    AGENTS.md, CLAUDE.md, docs/
  machine & person   ──►  bound at the edge       .env, local and user memory
  session state      ──►  never stored durably    issues, PRs, scratch files
```
