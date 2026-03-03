#!/usr/bin/env bash
#
# Generate .direnv/cursor-env.zsh for instant Cursor shell bootstrap.
# Lives in ~/.cursor/skills/direnv-shell-commands/ so any workspace can use it.
#
# Usage (run from the workspace root where .envrc lives):
#   ~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh            # full
#   ~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh --minimal  # PATH + .env only
#
# The generated file self-validates via mtime checks. If any input
# (.envrc, flake.lock, .env) is newer than the cache, sourcing it
# returns 1 and the bootstrap falls back to live direnv export.

set -euo pipefail

CACHE=".direnv/cursor-env.zsh"
MINIMAL=false
[[ "${1:-}" == "--minimal" ]] && MINIMAL=true

mkdir -p .direnv

raw=$(DIRENV_LOG_FORMAT= direnv export zsh 2>/dev/null)
if [[ -z "$raw" ]]; then
  echo "Error: direnv export produced no output." >&2
  echo "Make sure 'direnv allow' has been run and .envrc is valid." >&2
  exit 1
fi

{
  echo '# Auto-generated — regenerate with: ~/.cursor/skills/direnv-shell-commands/generate-cursor-env.sh'
  echo '# Freshness check: return 1 if any input is newer than this file'
  echo '_self="${BASH_SOURCE[0]:-${(%):-%x}}"'
  echo 'for _f in .envrc flake.lock .env; do'
  echo '  [[ -f "$_f" && "$_f" -nt "$_self" ]] && { unset _self _f; return 1; }'
  echo 'done'
  echo 'unset _self _f'
  echo ''

  if $MINIMAL; then
    env_keys=$(grep -E '^[A-Z_]+=' .env 2>/dev/null | cut -d= -f1 | paste -sd'|' - || true)
    keep="PATH|PNPM_HOME|PYTHONPATH|IN_NIX_SHELL|NODE_PATH|LC_ALL|LANG|PORT"
    keep="$keep|NIXPKGS_ALLOW_UNFREE|PYTHONDONTWRITEBYTECODE"
    keep="$keep|DIRENV_FILE|DIRENV_DIR|DIRENV_WATCHES"
    [[ -n "$env_keys" ]] && keep="$keep|$env_keys"
    echo "$raw" | sed 's/;export /\nexport /g' | grep -E "^export ($keep)="
  else
    echo "$raw" | sed 's/;export /\nexport /g'
  fi
} > "$CACHE"

chmod 600 "$CACHE"

lines=$(wc -l < "$CACHE" | tr -d ' ')
bytes=$(wc -c < "$CACHE" | tr -d ' ')
mode=$($MINIMAL && echo "minimal" || echo "full")
echo "Generated $CACHE ($lines lines, $bytes bytes, $mode)"
