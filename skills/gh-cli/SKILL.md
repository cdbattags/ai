---
name: gh-cli
description: Interact with GitHub via the gh CLI for PRs, issues, releases, Actions, and API calls. Use when performing any GitHub operation such as creating PRs, viewing issues, checking CI status, making API requests, or managing releases.
---

# GitHub CLI (`gh`)

## Prerequisites

- User is already authenticated (`gh auth login` completed)
- All `gh` commands require `required_permissions: ["full_network"]` in the Shell tool

## Pull Requests

```bash
# Create PR with HEREDOC body
gh pr create --title "feat: add caching layer" --body "$(cat <<'EOF'
## Summary
- Added Redis caching for API responses
- Cache TTL configurable via env var

## Test plan
- [ ] Unit tests pass
- [ ] Manual smoke test
EOF
)"

# List open PRs
gh pr list

# View PR details (accepts number, URL, or branch name)
gh pr view 42

# View in browser
gh pr view 42 --web

# Check CI status
gh pr checks 42

# View PR diff
gh pr diff 42

# Merge (auto-selects merge method)
gh pr merge 42

# Squash merge with auto-delete branch
gh pr merge 42 --squash --delete-branch

# Add review
gh pr review 42 --approve
gh pr review 42 --request-changes --body "Needs error handling"

# Checkout a PR locally
gh pr checkout 42
```

## Issues

```bash
# Create issue
gh issue create --title "Bug: login fails on Safari" --body "Steps to reproduce..."

# Create with labels and assignee
gh issue create --title "..." --label bug --label urgent --assignee @me

# List issues (default: open)
gh issue list
gh issue list --label bug --state closed

# View issue
gh issue view 99

# Comment on issue
gh issue comment 99 --body "Fixed in PR #42"

# Close issue
gh issue close 99

# Create a branch linked to an issue
gh issue develop 99 --checkout
```

## GitHub Actions

```bash
# List recent workflow runs
gh run list

# List runs for a specific workflow
gh run list --workflow ci.yml

# View a run's details and jobs
gh run view <run-id>

# Watch a run in real time (non-interactive: use --exit-status)
gh run watch <run-id> --exit-status

# Download artifacts
gh run download <run-id>

# Re-run failed jobs
gh run rerun <run-id> --failed
```

## Releases

```bash
# Create release from tag
gh release create v1.2.0 --title "v1.2.0" --notes "Release notes here"

# Create release with auto-generated notes
gh release create v1.2.0 --generate-notes

# Upload assets to existing release
gh release upload v1.2.0 ./dist/*.tar.gz

# List releases
gh release list

# View a release
gh release view v1.2.0
```

## API (REST and GraphQL)

Use `gh api` for anything not covered by top-level commands. Placeholders `{owner}`, `{repo}`, `{branch}` auto-resolve from the current repo.

```bash
# GET request (default)
gh api repos/{owner}/{repo}

# Filter response with jq
gh api repos/{owner}/{repo}/issues --jq '.[].title'

# POST with fields
gh api repos/{owner}/{repo}/issues/123/comments -f body='Automated comment'

# PATCH
gh api -X PATCH repos/{owner}/{repo}/issues/123 -f state=closed

# Paginate all results
gh api repos/{owner}/{repo}/commits --paginate --jq '.[].sha'

# GraphQL query
gh api graphql -f query='
  query {
    repository(owner: "{owner}", name: "{repo}") {
      issues(first: 5, states: OPEN) {
        nodes { title number }
      }
    }
  }
'

# Read request body from file
gh api repos/{owner}/{repo}/dispatches --input payload.json
```

## Search

```bash
# Search issues across GitHub
gh search issues "memory leak" --repo cli/cli

# Search PRs
gh search prs "auth" --state open --repo myorg/myrepo

# Search code
gh search code "TODO" --repo {owner}/{repo}

# Search repos
gh search repos "language:lua stars:>100"
```

## Cross-Repository Operations

Add `-R OWNER/REPO` to target a different repository:

```bash
gh pr list -R cli/cli
gh issue view 500 -R vercel/next.js
gh api repos/vercel/next.js/releases --jq '.[0].tag_name'
```

## Output Formatting

```bash
# JSON output with jq filtering
gh pr list --json number,title,author --jq '.[] | "\(.number) \(.title) by \(.author.login)"'

# Go template formatting
gh pr list --json number,title --template '{{range .}}#{{.number}} {{.title}}{{"\n"}}{{end}}'

# Web view (opens browser)
gh pr view 42 --web
gh repo view --web
```

## Tips

- Prefer `--json` + `--jq` to extract structured data programmatically
- Use `gh api` with `--paginate --slurp` for collecting all pages into one array
- `gh pr create --fill` auto-fills title/body from commits (useful for single-commit PRs)
- `gh run watch --exit-status` exits with non-zero if the run fails (useful for scripting)
