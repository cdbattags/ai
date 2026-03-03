---
name: github-repo-triage
description: Triage and maintain GitHub repositories — assess open issues/PRs, cherry-pick contributions, manage releases, and publish packages. Use when the user wants to catch up on a repo, review open issues, merge community PRs, cut a release, or publish to package registries.
---

# GitHub Repo Triage

## Phase 1: Reconnaissance

Gather full state before proposing anything.

```bash
# Open issues and PRs
gh issue list --state open --limit 50
gh pr list --state open --limit 50

# Forks (spot community work not submitted as PRs)
gh api repos/{owner}/{repo}/forks --jq '.[].full_name' --paginate

# Recent releases
gh release list --limit 5

# Branches
git branch -a
```

Present findings as a **ranked table** with tiers:

| Tier | Criteria |
|------|----------|
| 1 - Critical | Security issues, data loss, broken CI |
| 2 - High | Bugs affecting users, ready-to-merge PRs |
| 3 - Medium | Feature PRs needing rework, enhancements |
| 4 - Low | Nice-to-have, docs, cosmetic |
| 5 - Close | Won't-fix, stale, already resolved |

## Phase 2: PR Assessment

For each open PR, evaluate before touching code:

1. **Read the diff**: `gh pr diff <N>`
2. **Check quality**: syntax errors, missing error handling, debug logging, unrelated changes mixed in
3. **Check base**: is it against current HEAD or a stale branch?
4. **Check tests**: does it include tests? Do they follow existing patterns?
5. **Check author info**: `gh api repos/{owner}/{repo}/pulls/<N>/commits --jq '.[].commit.author'`

### Decision Matrix

| Quality | Tests | Action |
|---------|-------|--------|
| Good, clean | Yes | Cherry-pick as-is with attribution |
| Good logic, minor issues | Yes/No | Cherry-pick, fix issues, add tests |
| Good idea, bad implementation | No | Rewrite from scratch, credit author |
| Broken or wrong approach | N/A | Close with explanation |

## Phase 3: Cherry-Pick Workflow

When manually integrating a PR (not using GitHub merge):

```bash
# 1. Make the code changes (edit files directly, don't git cherry-pick)
# 2. Add tests if missing
# 3. Run the test suite
# 4. Stage only the relevant files
git add <files>

# 5. Commit with attribution and auto-close
git commit -m "$(cat <<'EOF'
feat: description of what was added

Longer explanation if needed.

Co-authored-by: Full Name <real@email.com>
Closes #N
EOF
)"
```

**Critical**: Get the real author email from the PR commits, not the GitHub noreply address:

```bash
gh api repos/{owner}/{repo}/pulls/<N>/commits \
  --jq '.[].commit.author | "\(.name) <\(.email)>"'
```

If the name is an internal ID (e.g., `xlw116`), use the GitHub display name:

```bash
gh api users/<login> --jq '.name'
```

### After Pushing

The `Closes #N` keyword auto-closes the issue/PR. But since it wasn't merged through GitHub, add a comment:

```bash
gh pr comment <N> --body "Merged in <sha> — thank you @<author> for the <feature>! Applied with <brief note on adjustments>."
```

## Phase 4: Issue Housekeeping

Close issues with helpful context:

| Scenario | Comment Pattern |
|----------|----------------|
| Fixed by commit | "Fixed in `<sha>` — <brief explanation>" |
| Won't fix | Explain why, suggest workaround if possible |
| Duplicate | Link to the original issue |
| Already resolved | "Resolved by <PR/commit> in v<version>" |
| Feature shipped | Link the release |

```bash
gh issue close <N> --comment "Fixed in <sha>. <explanation>"
```

## Phase 5: Release

### Pre-Release Checklist

1. All target commits pushed and CI green
2. Version bumped in source files (if applicable)
3. `dist.ini`, rockspec, `package.json` etc. updated

### Tag and Release

```bash
# Tag
git tag v<version>
git push origin v<version>

# Craft release with notes
gh release create v<version> --title "v<version>" --notes "$(cat <<'EOF'
## What's New

### Features
- **ECDH-ES key agreement for JWE** (#66)
  - Ephemeral key generation and Concat KDF per RFC 7518
  - Supports P-256 and P-521 curves
- **A128GCM content encryption** (#65)

### Bug Fixes
- **Fix nil payload crash** during claim validation (#36)

### Maintenance
- Simplified CI script, deduplicated test workflow

**Full Changelog**: https://github.com/<owner>/<repo>/compare/v<prev>...v<version>
EOF
)"
```

Style: nested bullets under each feature, link issue numbers, include RFC references where relevant.

### Release Gating

If the repo has CI, ensure tests pass before releasing. Add a workflow requirement:

```yaml
on:
  release:
    types: [created]
jobs:
  publish:
    needs: [test]  # gate on test job
```

## Phase 6: Package Publishing

### General Pattern

Most ecosystems follow: tag → release → CI publishes.

```yaml
# .github/workflows/publish.yml
on:
  release:
    types: [created]
```

### LuaRocks

```bash
# Secrets needed: LUAROCKS_API_KEY
# The workflow should:
luarocks new_version <rockspec> --tag v<version>
luarocks upload <rockspec> --api-key $LUAROCKS_API_KEY
```

Keep the dev rockspec (`*-dev-0.rockspec`) in the repo. Don't commit versioned rockspecs — let `luarocks new_version` generate them in CI.

### OPM (OpenResty Package Manager)

```bash
# Secrets needed: OPM_GITHUB_ACCOUNT, OPM_GITHUB_TOKEN
# Requires dist.ini in repo root
opm upload
```

OPM reads `dist.ini` for metadata. Ensure `version` matches the tag (without `v` prefix, append `-0` for OPM convention).

### npm / Other Registries

Same pattern: CI job triggered by release, uses stored secrets, publishes the tagged version.

### Verifying Publication

After release, confirm packages are live:

```bash
# LuaRocks
luarocks search <package-name>

# npm
npm view <package-name> version

# OPM
opm get <account>/<package-name>
```

## Quick Reference: Git Close Keywords

All of these close the referenced issue when the commit reaches the default branch:

```text
Closes #N    Fixes #N    Resolves #N
Close #N     Fix #N      Resolve #N
Closed #N    Fixed #N    Resolved #N
```

- Case-insensitive
- Work in commit messages, PR descriptions, and PR comments (on merge)
- Multiple per commit: `Closes #36 Closes #40`
- Cross-repo: `Closes owner/repo#N`
