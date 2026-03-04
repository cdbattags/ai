# ai

User-level AI agent configuration: [Cursor](https://cursor.com) rules and skills, [Claude Code](https://code.claude.com) config, [OpenCode](https://opencode.ai) config, and composable MCP server profiles. One repo, symlinked everywhere.

## Setup

Requires Node.js 22.6+ (native TypeScript execution).

```bash
git clone --recurse-submodules git@github.com:cdbattags/ai.git ~/ai
cd ~/ai && npm install

node link.ts              # build dist/ + install to ~/
node link.ts --dry-run    # preview without changes
```

## How it works

**`src/`** holds authored content (rules, skills, tool configs, MCP server definitions).

**`vendor/`** holds community repos as git submodules. Cherry-picks are declared in `vendor.json`.

**`dist/<name>/`** is the assembled per-tool tree, built by `link.ts`. Each user gets their own directory (default: `cdbattags`). It contains relative symlinks back to `src/` and `vendor/`; browsing `dist/cdbattags/` on GitHub shows the full resolved config. Forkers can build their own with `--name`.

**`link.ts`** has two phases:

1. **build**: Wipe `dist/<name>/`, recreate symlinks from `src/` + vendor cherry-picks, generate `mcp.json` from profile
2. **install**: Symlink `dist/<name>/` contents into `~/.cursor/`, `~/.claude/`, `~/.config/opencode/`

## Repository layout

```
src/
  rules/                        Cursor rules (.mdc)
  skills/                       Cross-tool skills (SKILL.md)
  cursor/commands/              Cursor-specific commands
  claude/                       Claude Code config (CLAUDE.md, settings, commands)
  opencode/                     OpenCode config (opencode.json)
  mcp/servers/                  Individual MCP server configs
  mcp/profiles/                 Named sets of servers

vendor/                         Git submodules (community rules/skills)
vendor.json                     Declares which vendor items to cherry-pick

dist/cdbattags/                 Built output (git-tracked symlinks per tool)
  cursor/                       -> ~/.cursor/
  claude/                       -> ~/.claude/
  opencode/                     -> ~/.config/opencode/

link.ts                         Build + install script
```

## Rules

| Rule | What it does |
|------|-------------|
| `direnv-shell-bootstrap` | Bootstrap Nix/direnv in non-interactive Cursor shells |
| `git-commit-confirmation` | Require explicit user approval before every commit |
| `gh-cli` | Use `gh` CLI instead of raw API calls for GitHub operations |
| `github-repo-triage` | Conventions for triaging issues/PRs, cherry-picks, releases |
| `documentation` | README placement and `docs/` folder structure |
| `markdownlint-compliance` | Keep markdown files lint-clean |
| `no-sleep-process-monitoring` | Use Shell tool waiting instead of `sleep`/polling |
| `install-latest-packages` | Always resolve real latest versions when adding dependencies |
| `deduplicate-rules` | Prevent overlap between user-level and project-level rules |
| `sandbox-domains` | Network allowlist for Cursor sandbox |
| `use-trash-not-rm` | Prefer recoverable `trash` over `rm` |

## Skills

| Skill | Source | What it does |
|-------|--------|-------------|
| `direnv-shell-commands` | own | Cached direnv/Nix environment for fast shell bootstrap |
| `find-3d-assets` | own | Find and integrate low-poly 3D models (GLB/GLTF) |
| `gh-cli` | own | GitHub CLI patterns for PRs, issues, releases, API calls |
| `github-repo-triage` | own | Full triage, cherry-pick, release, and publishing workflow |
| `markdownlint-compliance` | own | Auto-fix and manual-fix guidance for markdownlint |
| `process-monitoring` | own | Wait for processes without `sleep` or polling loops |
| `submodule-worktree` | own | Manage git worktrees across repos and submodules |
| `karpathy-guidelines` | vendor | Behavioral guardrails: think first, simplicity, surgical changes |
| `logging-best-practices` | vendor | Structured logging and wide events (Stripe canonical log lines) |
| `test-driven-development` | vendor | Red-green-refactor TDD with rationalization rebuttals |

## MCP profiles

Compose per-workspace MCP configs from individual server definitions.

```bash
node link.ts build --mcp web        # build with 'web' profile
node link.ts build --mcp backend    # build with 'backend' profile
```

| Profile | Servers |
|---------|---------|
| `base` | context7, memory, sequential-thinking, fetch |
| `web` | base + playwright |
| `backend` | base + docker, sentry |
| `full` | all servers |

Available servers: `context7`, `docker`, `fetch`, `github`, `memory`, `playwright`, `sequential-thinking`, `sentry`

## Vendor submodules

Community rules and skills pulled in as git submodules under `vendor/`. Cherry-picks are declared in `vendor.json`.

| Vendor | Repo | Cherry-picked |
|--------|------|---------------|
| hutchic | [hutchic/.cursor](https://github.com/hutchic/.cursor) | karpathy-guidelines, logging-best-practices, test-driven-development |
| aussiegingersnap | [cursor-skills](https://github.com/aussiegingersnap/cursor-skills) | (available; none selected yet) |

To cherry-pick a new vendor skill, add it to `vendor.json` and rebuild:

```bash
# Edit vendor.json, then:
node link.ts build
```

## link.ts

```
Usage: node link.ts [command] [options]

Commands:
  build               Build dist/<name>/ from src/ + vendor
  install [tool...]   Symlink dist/<name>/ into ~/ (cursor, claude, opencode, or all)
  (no command)        Build + install all

Options:
  --name NAME         Output directory under dist/ (default: cdbattags)
  --mcp PROFILE       MCP profile to use (default: base)
  --dry-run           Show what would happen without doing it
  --clean             Remove installed symlinks from ~/
  -h, --help          Show this help
```

Forkers can build their own dist (gitignored) without touching the tracked one:

```bash
node link.ts build --name myname
node link.ts install --name myname
```

## License

[MIT](LICENSE)
