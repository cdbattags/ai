---
name: submodule-worktree
description: Manage git worktrees for top-level repos and submodules in any workspace. Use when the user wants to work on multiple branches in parallel, create a worktree, check out a feature branch alongside main, fork a dependency as a submodule, or manage worktrees across submodules.
---

# Submodule & Repo Worktree Management

Worktrees let you check out multiple branches simultaneously — each worktree is a separate directory backed by the same `.git` store. This skill handles worktrees for both the **top-level repo** and any **submodules** within it.

## Layout

```
workspace/
├── worktrees/                         # All worktrees (gitignored)
│   ├── _root/                         # Top-level repo worktrees
│   │   └── feature-something/         # branch: feature/something
│   ├── my-submodule/                  # Submodule worktrees (by basename)
│   │   └── feature-branch/            # branch: feature/branch
│   └── another-submodule/
│       └── fix-bug/
```

## Script

All operations use the portable script shipped with this skill:

```bash
WORKTREE_SH="$HOME/.cursor/skills/submodule-worktree/scripts/worktree.sh"
```

Run it from anywhere inside the workspace.

### First-time setup

The script auto-detects the git root and submodules. You only need to ensure:

1. `worktrees/` is in the workspace `.gitignore`
2. Submodules are initialized (`git submodule update --init`)

```bash
echo 'worktrees/' >> .gitignore
git submodule update --init --recursive
```

### Create a worktree

```bash
# Top-level repo worktree
$WORKTREE_SH add _root feature/my-branch

# Submodule worktree (use submodule basename, not full path)
$WORKTREE_SH add mdxjs-rs feature/vite-plugin

# Explicitly create a new branch
$WORKTREE_SH add mdxjs-rs feature/new-thing --new

# Base a new branch off a specific ref
$WORKTREE_SH add mdxjs-rs feature/speed-up --base main

# Combine flags
$WORKTREE_SH add mdxjs-rs hotfix/urgent --new --base v2.1.0
```

### List active worktrees

```bash
# All targets with worktrees
$WORKTREE_SH list

# Specific target
$WORKTREE_SH list mdxjs-rs
$WORKTREE_SH list _root
```

### Remove a worktree

```bash
$WORKTREE_SH remove mdxjs-rs feature/vite-plugin
$WORKTREE_SH remove _root feature/my-branch
```

### Status overview

```bash
$WORKTREE_SH status
```

### Get worktree path (for scripting)

```bash
$WORKTREE_SH path mdxjs-rs feature/vite-plugin
# Output: /Users/.../workspace/worktrees/mdxjs-rs/feature-vite-plugin
```

## Conventions

- `_root` is a reserved name that targets the top-level repo itself
- Submodules are referenced by **basename** (e.g., `mdxjs-rs` not `modules/mdxjs-rs`)
- Branch directory naming: slashes replaced by dashes (`feature/foo` -> `feature-foo`)
- `worktrees/` must be gitignored at the workspace root
- Original checkouts (main repo and submodules) stay undisturbed

## When to use

- User wants to start a feature branch without disrupting current work
- User wants to work on multiple tasks across submodules in parallel
- User references a branch they want checked out alongside the current one
- Before starting a migration or large refactor (keeps main clean)
- User wants to fork a dependency and develop it as a submodule
- User wants to base work off a specific branch or tag

## Agent workflow

1. Ensure `worktrees/` is in `.gitignore` (add if missing)
2. Run `$WORKTREE_SH status` to see current state
3. Run `$WORKTREE_SH add <target> <branch> [--base <ref>]` to create
4. Work in the worktree path (returned by `path` command)
5. When done, `$WORKTREE_SH remove <target> <branch>`

### Fork-as-submodule workflow

When the user wants to fork an upstream package and develop it locally:

1. Fork the repo on GitHub (e.g., `gh repo fork wooorm/mdxjs-rs --clone=false`)
2. Add the fork as a submodule:
   ```bash
   git submodule add git@github.com:<user>/<repo>.git modules/<repo>
   git submodule update --init modules/<repo>
   ```
3. Add upstream remote inside the submodule:
   ```bash
   cd modules/<repo>
   git remote add upstream https://github.com/<upstream-owner>/<repo>.git
   git fetch upstream
   ```
4. Create worktrees for feature branches:
   ```bash
   $WORKTREE_SH add <repo> feature/my-changes --new --base main
   ```
5. Work in the worktree, push to origin (fork), open PRs against upstream
