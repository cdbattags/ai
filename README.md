# ai

User-level [Cursor](https://cursor.com) rules and skills for consistent AI agent behavior across projects.

## What's in here

- **`rules/`** — Always-applied `.mdc` rules that shape how the AI agent works (git workflows, shell conventions, documentation standards)
- **`skills/`** — On-demand `SKILL.md` files (with supporting scripts) that the agent reads when a relevant task comes up

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

| Skill | What it does |
|-------|-------------|
| `direnv-shell-commands` | Cached direnv/Nix environment for fast shell bootstrap |
| `find-3d-assets` | Find and integrate low-poly 3D models (GLB/GLTF) |
| `gh-cli` | GitHub CLI patterns for PRs, issues, releases, API calls |
| `github-repo-triage` | Full triage, cherry-pick, release, and publishing workflow |
| `markdownlint-compliance` | Auto-fix and manual-fix guidance for markdownlint |
| `process-monitoring` | Wait for processes without `sleep` or polling loops |
| `submodule-worktree` | Manage git worktrees across repos and submodules |

## Usage

These files are designed to live at `~/.cursor/rules/` and `~/.cursor/skills/`. Clone and symlink, or copy directly:

```bash
git clone git@github.com:cdbattags/ai.git ~/.cursor/ai

# Symlink rules and skills into place
ln -sf ~/.cursor/ai/rules ~/.cursor/rules
ln -sf ~/.cursor/ai/skills ~/.cursor/skills
```

## License

[MIT](LICENSE)
