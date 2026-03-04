---
name: markdownlint-compliance
description: >-
  Write Markdown files that pass markdownlint with zero warnings.
  Use when creating or editing .md, .mdc, or .mdx files, writing
  documentation, updating README files, or creating Cursor rules
  and skills.
---

# Markdownlint Compliance

## Config Resolution

markdownlint checks for config in this order (first match wins):

1. `markdownlint.config` in VS Code / Cursor settings
2. `.markdownlint.jsonc` in the workspace root
3. `.markdownlint.json` in the workspace root
4. `.markdownlint.yaml` / `.markdownlint.yml` in the workspace root
5. Built-in defaults (all rules enabled)

Before writing markdown, check if a config exists:

```bash
ls .markdownlint* 2>/dev/null || echo "no config — using defaults"
```

If no config exists, all rules are enabled with their default
settings.

## Rules the AI Commonly Violates

These are the rules most frequently broken by AI-generated
markdown, ordered by frequency:

### MD031 — Blank lines around fenced code blocks

Fenced code blocks must have a blank line before the opening
fence and after the closing fence.

````markdown
<!-- ❌ BAD -->
Some text:
```bash
echo "hello"
```
More text.

<!-- ✅ GOOD -->
Some text:

```bash
echo "hello"
```

More text.
````

### MD032 — Blank lines around lists

Lists need a blank line before the first item and after the
last item.

````markdown
<!-- ❌ BAD -->
Some text:
- Item one
- Item two
More text.

<!-- ✅ GOOD -->
Some text:

- Item one
- Item two

More text.
````

### MD040 — Fenced code blocks should have a language specified

Every fenced code block needs a language identifier after the
opening triple backticks.

Common language tags: `bash`, `json`, `yaml`, `markdown`,
`typescript`, `python`, `tsx`, `css`, `html`, `sql`, `nix`,
`toml`, `diff`, `text`, `plaintext`.

Use `text` or `plaintext` if no language applies. Use `markdown`
for markdown examples.

### MD034 — No bare URLs

URLs in prose must be wrapped — either as links or angle
brackets.

````markdown
<!-- ❌ BAD -->
See https://example.com for details.

<!-- ✅ GOOD -->
See <https://example.com> for details.
See [the docs](https://example.com) for details.
````

### MD060 — Table column style

Table pipes must be consistently styled. Use the "compact"
style (single space padding):

````markdown
<!-- ✅ Compact style (consistent) -->
| Name | Value |
| ---- | ----- |
| foo  | bar   |
````

### MD001 — Heading levels increment by one

Don't skip heading levels (e.g., `##` followed by `####`).

````markdown
<!-- ❌ BAD -->
## Section
#### Subsection

<!-- ✅ GOOD -->
## Section
### Subsection
````

## Full Rule Quick Reference

<!-- markdownlint-disable MD013 -->

| Rule  | Name                         | Default        | Summary                         |
| ----- | ---------------------------- | -------------- | ------------------------------- |
| MD001 | heading-increment            | on             | Headings increment by one level |
| MD003 | heading-style                | atx            | Use `#` style headings          |
| MD004 | ul-style                     | consistent     | Consistent list marker          |
| MD005 | list-indent                  | on             | Consistent list indentation     |
| MD009 | no-trailing-spaces           | on             | No trailing whitespace          |
| MD010 | no-hard-tabs                 | on             | No hard tab characters          |
| MD012 | no-multiple-blanks           | on             | No consecutive blank lines      |
| MD013 | line-length                  | 80 (often off) | Line length limit               |
| MD018 | no-missing-space-atx         | on             | Space after `#` in headings     |
| MD019 | no-multiple-space-atx        | on             | No multiple spaces after `#`    |
| MD022 | blanks-around-headings       | on             | Blank lines around headings     |
| MD023 | heading-start-left           | on             | Headings at start of line       |
| MD024 | no-duplicate-heading         | on             | No duplicate heading text       |
| MD025 | single-title                 | on             | Only one `#` (H1) per document  |
| MD027 | no-multiple-space-blockquote | on             | No multiple spaces after `>`    |
| MD028 | no-blanks-blockquote         | on             | No blank lines in blockquotes   |
| MD029 | ol-prefix                    | one_or_ordered | Ordered list prefix style       |
| MD030 | list-marker-space            | on             | Spaces after list markers       |
| MD031 | blanks-around-fences         | on             | Blank lines around code blocks  |
| MD032 | blanks-around-lists          | on             | Blank lines around lists        |
| MD033 | no-inline-html               | off            | No inline HTML (often disabled) |
| MD034 | no-bare-urls                 | on             | No bare URLs                    |
| MD035 | hr-style                     | consistent     | Consistent horizontal rule      |
| MD036 | no-emphasis-as-heading       | on             | Don't use emphasis as headings  |
| MD037 | no-space-in-emphasis         | on             | No spaces in emphasis markers   |
| MD038 | no-space-in-code             | on             | No spaces inside code spans     |
| MD039 | no-space-in-links            | on             | No spaces inside link text      |
| MD040 | fenced-code-language         | on             | Code blocks need language tag   |
| MD041 | first-line-heading           | on             | First line should be a heading  |
| MD042 | no-empty-links               | on             | No empty link destinations      |
| MD045 | no-alt-text                  | on             | Images need alt text            |
| MD046 | code-block-style             | fenced         | Use fenced code blocks          |
| MD047 | single-trailing-newline      | on             | File ends with single newline   |
| MD048 | code-fence-style             | backtick       | Use backticks not tildes        |
| MD049 | emphasis-style               | asterisk       | Use `*` not `_` for emphasis    |
| MD050 | strong-style                 | asterisk       | Use `**` not `__` for strong    |

<!-- markdownlint-enable MD013 -->

## Auto-Fix with markdownlint-cli2

`markdownlint-cli2 --fix` automatically resolves most whitespace
and formatting violations. Always run it before attempting manual
fixes.

### Usage

```bash
# Single file
npx markdownlint-cli2 "path/to/file.md" --fix

# Directory (glob pattern)
npx markdownlint-cli2 "docs/**/*.md" --fix

# Multiple specific files
npx markdownlint-cli2 "README.md" ".cursor/rules/*.mdc" --fix

# Entire workspace (careful — respects .markdownlintignore)
npx markdownlint-cli2 "**/*.md" --fix
```

### What --fix Resolves Automatically

| Rule  | Description                            |
| ----- | -------------------------------------- |
| MD009 | Trailing spaces                        |
| MD010 | Hard tabs                              |
| MD012 | Multiple consecutive blank lines       |
| MD022 | Missing blank lines around headings    |
| MD023 | Heading not at start of line           |
| MD027 | Multiple spaces after blockquote       |
| MD030 | Spaces after list markers              |
| MD031 | Missing blank lines around code blocks |
| MD032 | Missing blank lines around lists       |
| MD047 | Missing single trailing newline        |

### What --fix Cannot Resolve (Manual Only)

| Rule  | Description            | How to Fix                          |
| ----- | ---------------------- | ----------------------------------- |
| MD013 | Line length            | Reflow text or disable rule         |
| MD034 | Bare URLs              | Wrap in `<url>` or `[text](url)`    |
| MD036 | Emphasis as heading    | Replace `**text**` with `### text`  |
| MD040 | Missing fence language | Add tag after opening triple fences |
| MD041 | No first-line heading  | Add `# Title` as the first line     |

### Recommended Workflow

```text
1. Run --fix             (~60% of issues resolved automatically)
2. Re-lint               (only manual-fix rules should remain)
3. Fix manually          (line length, bare URLs, language tags)
4. Run ReadLints         (should be clean)
```

### Example Session

```bash
# Step 1: Auto-fix
npx markdownlint-cli2 ".cursor/rules/*.mdc" --fix

# Step 2: See what's left
npx markdownlint-cli2 ".cursor/rules/*.mdc"
# Output: only MD013, MD040, MD036 remain

# Step 3: Fix those manually using StrReplace or editor
```

### Configuration for --fix

Create `.markdownlint-cli2.jsonc` in the workspace root to
customize:

```jsonc
{
  // Disable rules that don't apply to your project
  "config": {
    "MD013": false,
    "MD033": false
  },
  // Ignore certain paths
  "ignores": ["node_modules/**", "**/content/blog/**"]
}
```

## Workflow

1. **Before writing**: Check for workspace `.markdownlint*` config
2. **While writing**: Follow the rules above (blank lines around
   fences/lists, language tags, no bare URLs)
3. **After writing**: Run `npx markdownlint-cli2 "file.md" --fix`
4. **Verify**: Run `ReadLints` on the file for remaining violations
5. **Fix remaining**: Manually fix what `--fix` couldn't resolve
6. **Scope**: Only fix lints you introduced — don't fix pre-existing
   ones unless editing that section
