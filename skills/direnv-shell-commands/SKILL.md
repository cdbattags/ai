---
name: direnv-shell-commands
description: Ensures all shell commands run inside the project's Nix flake environment via direnv. Use when running any shell command in a workspace that has a .envrc and flake.nix, especially for pnpm, node, surreal, pulumi, or any tool provided by the flake.
---

# Running Shell Commands with direnv + Nix Flake

This project uses `direnv` + `flake.nix` for a reproducible dev environment.
The Nix daemon is sourced in `~/.zshenv` so `nix` and `direnv` are always on
PATH — even in non-interactive shells like Cursor's Shell tool.

## Bootstrap Pattern (cascading, fastest first)

Cursor's Shell tool runs non-interactive zsh. The `direnv hook zsh` from
`.zshrc` does NOT fire, so load the environment explicitly:

```bash
[[ -n "$IN_NIX_SHELL" ]] || { source .direnv/cursor-env.zsh 2>/dev/null || eval "$(DIRENV_LOG_FORMAT= direnv export zsh)"; }
```

This cascade tries three paths in order:

1. **Already loaded** (`$IN_NIX_SHELL` set from a previous call) — skip (~0ms)
2. **Cached env file** (`.direnv/cursor-env.zsh` exists and fresh) — source
   (~0ms)
3. **Live direnv export** (cache missing or stale) — full evaluation (~1-4s)

Run from the **workspace root** (where `.envrc` lives). The Shell tool is
stateful — subsequent calls in the same session inherit the environment.

### First command in a session (bootstrap + run)

```bash
[[ -n "$IN_NIX_SHELL" ]] || { source .direnv/cursor-env.zsh 2>/dev/null || eval "$(DIRENV_LOG_FORMAT= direnv export zsh)"; } && pnpm dev
```

With `working_directory` set to the workspace root.

### Subsequent commands (environment persists)

```bash
cd modules/web-app && pnpm db:seed
```

## Quick Reference

| Pattern | Command |
|---|---|
| Bootstrap + run | `[[ -n "$IN_NIX_SHELL" ]] \|\| { source .direnv/cursor-env.zsh 2>/dev/null \|\| eval "$(DIRENV_LOG_FORMAT= direnv export zsh)"; } && <your command>` |
| Generate cache (full) | `~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh` |
| Generate cache (minimal) | `~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh --minimal` |
| Force live export | `eval "$(DIRENV_LOG_FORMAT= direnv export zsh)"` |

## Three Bootstrap Tiers

### Tier 1: nix-direnv (global, already active)

nix-direnv is installed to `~/.nix-profile` and sourced in
`~/.config/direnv/direnvrc`. It overrides direnv's built-in `use flake`
with a faster implementation that:

- Caches `nix print-dev-env` output more efficiently
- Creates GC roots (prevents `nix-collect-garbage` from deleting dev deps)
- Only re-evaluates when `flake.lock` content actually changes

No project-level changes needed — the `.envrc` stays as-is.

### Tier 2: Cached env file (per-project, instant)

The generate script lives in this skill folder and works for any workspace:

```bash
~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh
```

Run it from the workspace root (where `.envrc` lives). It generates
`.direnv/cursor-env.zsh` by running `direnv export zsh` once, splitting
the output into one-export-per-line. The file self-validates via mtime
checks — if any input (`.envrc`, `flake.lock`, `.env`) is newer than the
cache, sourcing it returns 1 and the bootstrap falls back to live
`direnv export`.

- `.direnv/` should be gitignored (standard for Nix + direnv projects)
- `chmod 600` because the file contains `.env` secrets
- Regenerate after changing `.env`, `flake.nix`, `flake.lock`, or `.envrc`
- Projects with a Makefile may add a convenience target (see script header)

### Tier 3: Minimal export (optional flag)

Pass `--minimal` to the generate script for a smaller cache (~1KB vs ~6KB)
that keeps only PATH, `.env` vars, and essentials — stripping ~60 Nix build
internals (`NIX_CFLAGS_COMPILE`, `NIX_LDFLAGS`, `buildPhase`, etc.) that
Cursor never needs:

```bash
~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh --minimal
```

## Sandbox vs Permissions

Cursor's Shell tool runs commands in a sandbox by default. The sandbox allows
filesystem reads everywhere and writes to the workspace. Whether `direnv export`
works in the sandbox depends on the direnv cache state:

| Cache state | Sandbox? | Time | Notes |
|---|---|---|---|
| Cached env file (`.direnv/cursor-env.zsh`) | Yes | ~0ms | Just sourcing a file |
| Warm diff cache | Yes | ~0.5s | All file reads, no Nix daemon needed |
| Cold diff cache, warm Nix profile (`.direnv/` exists) | Yes | ~1-4s | Re-evaluates .envrc but reads cached Nix env from store |
| Cold Nix profile (after `flake.nix` change) | **No** — use `required_permissions: ["all"]` | 10-60s | Needs Nix daemon socket + possible network for downloads |

**Rule of thumb**: Normal development uses the sandbox. After changing
`flake.nix` or `flake.lock`, use `required_permissions: ["all"]` for the first
bootstrap call so the Nix daemon can rebuild the profile.

### What invalidates the diff cache?

- Editing `.envrc`, `.env`, `flake.lock`
- Any file that direnv watches (shown in `$DIRENV_WATCHES`)
- First shell call in a new Cursor session (no prior state)

### What invalidates the Nix profile cache?

- Editing `flake.nix` or `flake.lock` (new inputs/packages)
- Running `nix flake update`

## Error Recovery

If the bootstrap fails (stderr shows an error, or commands like `pnpm` are
still not found after eval):

1. **Check direnv allow**: `direnv allow` may need to be run in the user's
   terminal after `.envrc` changes.
2. **Retry with permissions**: Re-run the same command with
   `required_permissions: ["all"]` to bypass sandbox restrictions.
3. **Check direnv status**: `direnv status` shows whether the environment is
   loaded and what file it's watching.
4. **Regenerate cache**: Run `~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh`
   if the cached env file is stale and the self-check isn't catching it.
5. **Nix daemon**: If Nix errors appear, the daemon may not be running —
   `nix doctor` can diagnose.

## Command Categories

**Needs direnv bootstrap** (uses Nix-provided tools or `.env` vars):

- `pnpm`, `node`, `npx`, `tsx`, `bun`
- `python`, `uv`, `pip`
- `pulumi`, `surreal`
- `make` (GNU make from Nix, not macOS make)
- `oxipng`, `jpegoptim`, `cwebp`, `svgo`, `ffmpeg`
- Any command that reads `VITE_*`, `SPOTIFY_*`, `DATABASE_URL`, etc.

**Does NOT need direnv bootstrap**:

- `git`, `gh` (system-installed)
- `ls`, `head`, `wc`, `echo`
- File reads, glob, grep (Cursor tools, not shell)
- `lsof`, `kill`, `ps` (system utilities)

## How It Works

1. `~/.zshenv` sources the Nix daemon profile — adds `nix` and `direnv` to
   PATH for all shells (including non-interactive).
2. `~/.zshrc` has `eval "$(direnv hook zsh)"` — auto-loads `.envrc` on `cd` in
   interactive shells only.
3. Cursor Shell is non-interactive, so the hook doesn't fire — use the
   cascading bootstrap pattern above.
4. The `.envrc` runs `use flake` (Nix packages via nix-direnv) + `dotenv`
   (.env vars).
5. The `flake.nix` shellHook is guarded with `DIRENV_IN_ENVRC` — the banner
   and version commands only run in interactive `nix develop`, not during
   `direnv export`.

## Important

Always run the bootstrap from the workspace root where `.envrc` and
`flake.nix` live. Set `working_directory` to the workspace root, then `cd` to
subdirectories after.
