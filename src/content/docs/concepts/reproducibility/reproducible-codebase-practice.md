---
title: "Reproducible codebase practices"
---

The way I'd frame reproducibility is this: **every assumption your code makes about its surroundings should be written down, versioned, and checked by a machine.** "It works on my machine" happens when some dependency lives only in your head or on your laptop (a Python version you installed two years ago, an env var in your `.zshrc`, a system library Homebrew pulled in). Good practice means turning those hidden dependencies into explicit files in the repo.

## The layers of an environment

It helps to see the environment as nested layers. Each one can drift, and each has its own tool for pinning it down.

```
┌──────────────────────────────────────────────────────────┐
│  6. Verification     CI on clean machines, test matrix   │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 5. Data & randomness   seeds, data versions, hashes  │ │
│ │ ┌──────────────────────────────────────────────────┐ │ │
│ │ │ 4. Configuration   env vars, .env.example        │ │ │
│ │ │ ┌──────────────────────────────────────────────┐ │ │ │
│ │ │ │ 3. OS / system libs   Docker, devcontainer   │ │ │ │
│ │ │ │ ┌──────────────────────────────────────────┐ │ │ │ │
│ │ │ │ │ 2. Runtime + packages   version + lock   │ │ │ │ │
│ │ │ │ │ ┌──────────────────────────────────────┐ │ │ │ │ │
│ │ │ │ │ │ 1. Source code        Git            │ │ │ │ │ │
│ │ │ │ │ └──────────────────────────────────────┘ │ │ │ │ │
│ │ │ │ └──────────────────────────────────────────┘ │ │ │ │
│ │ │ └──────────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Most projects get layer 1 right and stop. The value comes from going outward.

## 1. Pin the runtime version

The language version itself is a dependency. Declare it in a file the tooling reads automatically, rather than in a README sentence. Python uses `.python-version` (read by uv/pyenv), Node uses `.nvmrc` or the `engines` field, .NET uses `global.json` to pin the SDK, Flutter uses FVM's `.fvmrc`, and R records its version inside `renv.lock`.

## 2. Separate the manifest from the lockfile

This is the most important single idea. You need two files with different jobs:

```
  MANIFEST (you write)            LOCKFILE (tool generates)
  "what I want"                   "what I actually got"
  ─────────────────               ─────────────────────────
  pandas >= 2.0          ──►      pandas == 2.2.3
                                  numpy  == 2.1.1   ◄── transitive deps too
                                  + hashes of each package
```

The manifest states intent and allows ranges. The lockfile records the exact resolved tree, including transitive dependencies you never named. **Commit the lockfile** for applications. Without it, two people running "install" a month apart get different code.

| Ecosystem | Manifest | Lockfile | Install exactly from lock |
|---|---|---|---|
| Python (uv) | `pyproject.toml` | `uv.lock` | `uv sync --locked` |
| R | `DESCRIPTION` (optional) | `renv.lock` | `renv::restore()` |
| Dart/Flutter | `pubspec.yaml` | `pubspec.lock` | `flutter pub get` |
| .NET | `.csproj` / `Directory.Packages.props` | `packages.lock.json` | `dotnet restore --locked-mode` |
| JavaScript | `package.json` | `package-lock.json` | `npm ci` |

Note the difference between `npm install` (may update the lock) and `npm ci` (fails if the lock and manifest disagree). CI should always use the strict variant.

Library packages are a nuance: for something others will import, you publish loose ranges in the manifest so you don't force your exact versions on downstream users. You still keep a lockfile for your own dev and CI.

## 3. Isolate from the system

Packages should never come from a global location. Use project-local environments (`.venv`, `renv/library`). When the dependency goes below the language, such as `libgdcm` for DICOM, CUDA, or a specific `glibc`, the language lockfile can't capture it, so you move up to a container.

A `Dockerfile` (or a `.devcontainer/` setup for VS Code) makes the OS layer explicit. Two practical rules: pin base images by version or digest (`python:3.12.7-slim`, not `python:latest`), and remember that your M3 Pro is `arm64` while most Linux servers and CI runners are `x86_64`. Some wheels and native libraries differ between architectures, so build multi-platform images (`docker buildx --platform linux/amd64,linux/arm64`) or at least test on the deployment architecture.

For the strongest guarantees there is Nix, which makes the whole system bit-for-bit reproducible, but it has a steep learning curve. Docker plus lockfiles covers most real projects.

## 4. Configuration comes from the environment, not the code

This is the classic Twelve-Factor App principle. Anything that differs between dev, staging and production (database URLs, API keys, PACS endpoints, feature flags) is read from environment variables. The code stays identical across environments; only the config changes.

```
            same code artifact
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
  .env (dev)   staging vars   prod secrets
```

Commit a `.env.example` listing every required variable with dummy values, and gitignore the real `.env`. Validate config at startup and fail loudly with a clear message if something is missing (pydantic-settings in Python does this nicely). A program that crashes on line 1 with "PACS_URL not set" is far kinder than one that fails mysteriously an hour into a run.

## 5. Control data and randomness

For data science and AI work, identical code and packages still aren't enough. You also need the same inputs and the same random draws. Set seeds explicitly for every RNG (Python's `random`, NumPy, PyTorch, R's `set.seed`), and know that GPU operations can be non-deterministic unless you enable deterministic modes, often at a speed cost. Version your datasets and model weights (DVC, or at minimum a manifest with SHA-256 hashes), and record which data version produced which model. In a regulated setting like a QMS, that lineage is also what an auditor will ask for.

## 6. One command, verified by a clean machine

Make the setup and common tasks executable rather than described. A `Makefile`, `justfile`, or `Taskfile.yml` with targets like `setup`, `test`, `lint`, `run` means a newcomer types `just setup` instead of following twelve README steps that have quietly gone stale.

Then let CI be the referee. A CI run starts from a blank machine every time, so it's the honest test of whether your declared environment is complete. If it passes locally but fails in CI, you've found an undeclared dependency, which is exactly the bug you wanted to surface. A test matrix across OSes or language versions extends this to "works on every environment we claim to support."

## The underlying philosophy

All six practices are really one idea applied repeatedly: **make the implicit explicit, and make the explicit executable.** A README that says "install Python 3.12" is explicit but not executable; `.python-version` is both. Each step you convert from prose to a file a tool enforces is one less way for environments to silently diverge.

A good self-test for any repo: could a new team member, on a fresh machine, go from `git clone` to passing tests with two or three commands and no messages to you? If not, whatever they would have to ask you about is the next thing to write down.