#!/usr/bin/env bash
set -euo pipefail

# Auto-detect workspace root from wherever the script is invoked
WORKSPACE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo -e "\033[0;31mError:\033[0m Not inside a git repository"
    exit 1
}
WORKTREES_DIR="$WORKSPACE_ROOT/worktrees"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
    echo -e "${BOLD}Usage:${NC} worktree.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  add <target> <branch> [--new] [--base <ref>]"
    echo "                                       Create a worktree (--new creates branch, --base sets starting point)"
    echo "  remove <target> <branch>             Remove a worktree"
    echo "  list [target]                        List worktrees for one or all targets"
    echo "  status                               Overview of all targets and worktrees"
    echo "  path <target> <branch>               Print the worktree path (for scripting)"
    echo ""
    echo "Targets:"
    echo "  _root                                The top-level repository itself"
    list_submodules | sed 's/^/  /'
    exit 1
}

sanitize_branch() {
    echo "${1//\//-}"
}

worktree_path() {
    local target="$1"
    local branch="$2"
    echo "$WORKTREES_DIR/${target}/$(sanitize_branch "$branch")"
}

# Parse .gitmodules and return "basename path" pairs
list_submodules() {
    local gitmodules="$WORKSPACE_ROOT/.gitmodules"
    if [ ! -f "$gitmodules" ]; then
        return
    fi
    git config -f "$gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null | while read -r _ sub_path; do
        echo "$(basename "$sub_path")"
    done
}

# Resolve a target name to its absolute git directory path
resolve_target() {
    local target="$1"

    if [ "$target" = "_root" ]; then
        echo "$WORKSPACE_ROOT"
        return
    fi

    local gitmodules="$WORKSPACE_ROOT/.gitmodules"
    if [ ! -f "$gitmodules" ]; then
        echo -e "${RED}Error:${NC} No .gitmodules found at workspace root" >&2
        exit 1
    fi

    local match=""
    while read -r _ sub_path; do
        if [ "$(basename "$sub_path")" = "$target" ]; then
            match="$WORKSPACE_ROOT/$sub_path"
            break
        fi
    done < <(git config -f "$gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null)

    if [ -z "$match" ]; then
        echo -e "${RED}Error:${NC} Target '$target' not found" >&2
        echo "Available targets:" >&2
        echo "  _root" >&2
        list_submodules | sed 's/^/  /' >&2
        exit 1
    fi

    if [ ! -d "$match" ]; then
        echo -e "${RED}Error:${NC} Submodule path '$match' does not exist. Run: git submodule update --init" >&2
        exit 1
    fi

    echo "$match"
}

cmd_add() {
    local target="${1:-}"
    local branch="${2:-}"
    local create_new=false
    local base_ref=""

    [ -z "$target" ] || [ -z "$branch" ] && { echo -e "${RED}Error:${NC} Usage: worktree.sh add <target> <branch> [--new] [--base <ref>]"; exit 1; }

    shift 2
    while [ $# -gt 0 ]; do
        case "$1" in
            --new)  create_new=true ;;
            --base) base_ref="${2:-}"; [ -z "$base_ref" ] && { echo -e "${RED}Error:${NC} --base requires a branch/ref argument"; exit 1; }; shift ;;
            *)      echo -e "${RED}Error:${NC} Unknown flag '$1'"; exit 1 ;;
        esac
        shift
    done

    local target_path
    target_path="$(resolve_target "$target")"

    local wt_path
    wt_path="$(worktree_path "$target" "$branch")"

    if [ -d "$wt_path" ]; then
        echo -e "${YELLOW}Worktree already exists:${NC} $wt_path"
        exit 0
    fi

    mkdir -p "$WORKTREES_DIR"

    cd "$target_path"

    if [ -n "$base_ref" ]; then
        git fetch origin "$base_ref" 2>/dev/null || true
        local resolved_base
        resolved_base=$(git rev-parse --verify "$base_ref" 2>/dev/null || \
                        git rev-parse --verify "origin/$base_ref" 2>/dev/null || \
                        { echo -e "${RED}Error:${NC} Cannot resolve base ref '$base_ref'"; exit 1; })
        git worktree add "$wt_path" -b "$branch" "$resolved_base"
    elif [ "$create_new" = true ]; then
        git worktree add "$wt_path" -b "$branch"
    else
        git worktree add "$wt_path" "$branch" 2>/dev/null || \
            git worktree add "$wt_path" "origin/$branch" -b "$branch" 2>/dev/null || \
            git worktree add "$wt_path" -b "$branch"
    fi

    echo -e "${GREEN}Created worktree:${NC}"
    echo -e "  Target: ${CYAN}$target${NC}"
    echo -e "  Branch: ${CYAN}$branch${NC}"
    [ -n "$base_ref" ] && echo -e "  Based on: ${CYAN}$base_ref${NC}"
    echo -e "  Path:   ${CYAN}$wt_path${NC}"
}

cmd_remove() {
    local target="${1:-}"
    local branch="${2:-}"

    [ -z "$target" ] || [ -z "$branch" ] && { echo -e "${RED}Error:${NC} Usage: worktree.sh remove <target> <branch>"; exit 1; }

    local target_path
    target_path="$(resolve_target "$target")"

    local wt_path
    wt_path="$(worktree_path "$target" "$branch")"

    if [ ! -d "$wt_path" ]; then
        echo -e "${RED}Error:${NC} No worktree at $wt_path"
        exit 1
    fi

    cd "$target_path"
    git worktree remove "$wt_path"

    echo -e "${GREEN}Removed worktree:${NC} $target @ $branch"
}

cmd_list() {
    local target="${1:-}"

    if [ -n "$target" ]; then
        local target_path
        target_path="$(resolve_target "$target")"
        echo -e "${BOLD}$target${NC}"
        cd "$target_path" && git worktree list
    else
        # List _root
        local root_count
        root_count=$(cd "$WORKSPACE_ROOT" && git worktree list | wc -l | tr -d ' ')
        if [ "$root_count" -gt 1 ]; then
            echo -e "${BOLD}_root${NC} (${CYAN}$root_count${NC} worktrees)"
            cd "$WORKSPACE_ROOT" && git worktree list | sed 's/^/  /'
            echo ""
        fi

        # List submodules
        while read -r _ sub_path; do
            local full_path="$WORKSPACE_ROOT/$sub_path"
            [ -d "$full_path" ] || continue
            local name
            name="$(basename "$sub_path")"
            local count
            count=$(cd "$full_path" && git worktree list | wc -l | tr -d ' ')
            if [ "$count" -gt 1 ]; then
                echo -e "${BOLD}$name${NC} (${CYAN}$count${NC} worktrees)"
                cd "$full_path" && git worktree list | sed 's/^/  /'
                echo ""
            fi
        done < <(git config -f "$WORKSPACE_ROOT/.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null)

        if [ ! -d "$WORKTREES_DIR" ] || [ -z "$(ls -A "$WORKTREES_DIR" 2>/dev/null)" ]; then
            echo -e "${YELLOW}No active worktrees.${NC} Use 'worktree.sh add <target> <branch>' to create one."
        fi
    fi
}

cmd_status() {
    echo -e "${BOLD}Worktree Status${NC} ($WORKSPACE_ROOT)"
    echo ""
    printf "  ${BOLD}%-30s %-40s %s${NC}\n" "TARGET" "BRANCH" "WORKTREES"
    echo "  $(printf '%.0s-' {1..85})"

    # Top-level repo
    local root_branch
    root_branch=$(cd "$WORKSPACE_ROOT" && git branch --show-current 2>/dev/null || echo "(detached)")
    local root_wt_count
    root_wt_count=$(cd "$WORKSPACE_ROOT" && git worktree list | wc -l | tr -d ' ')
    local root_extra=$(( root_wt_count - 1 ))
    local root_display="$root_extra"
    if [ "$root_extra" -gt 0 ]; then
        root_display="${GREEN}${root_extra}${NC}"
    fi
    printf "  %-30s %-40s %b\n" "_root" "$root_branch" "$root_display"

    # Submodules
    if [ -f "$WORKSPACE_ROOT/.gitmodules" ]; then
        while read -r _ sub_path; do
            local full_path="$WORKSPACE_ROOT/$sub_path"
            [ -d "$full_path" ] || continue
            local name
            name="$(basename "$sub_path")"
            local branch
            branch=$(cd "$full_path" && git branch --show-current 2>/dev/null || echo "(detached)")
            local wt_count
            wt_count=$(cd "$full_path" && git worktree list | wc -l | tr -d ' ')
            local extra=$(( wt_count - 1 ))
            local wt_display="$extra"
            if [ "$extra" -gt 0 ]; then
                wt_display="${GREEN}${extra}${NC}"
            fi
            printf "  %-30s %-40s %b\n" "$name" "$branch" "$wt_display"
        done < <(git config -f "$WORKSPACE_ROOT/.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null)
    fi

    if [ -d "$WORKTREES_DIR" ] && [ -n "$(ls -A "$WORKTREES_DIR" 2>/dev/null)" ]; then
        echo ""
        echo -e "${BOLD}Active Worktrees${NC}"
        echo ""
        for target_dir in "$WORKTREES_DIR"/*/; do
            [ -d "$target_dir" ] || continue
            local target_name
            target_name="$(basename "$target_dir")"
            for wt in "$target_dir"/*/; do
                [ -d "$wt" ] || continue
                local wt_name
                wt_name="$(basename "$wt")"
                local wt_branch
                wt_branch=$(cd "$wt" && git branch --show-current 2>/dev/null || echo "(detached)")
                echo -e "  ${CYAN}${target_name}/${wt_name}${NC} → $wt_branch"
            done
        done
    fi
}

cmd_path() {
    local target="${1:-}"
    local branch="${2:-}"

    [ -z "$target" ] || [ -z "$branch" ] && { echo -e "${RED}Error:${NC} Usage: worktree.sh path <target> <branch>"; exit 1; }

    worktree_path "$target" "$branch"
}

case "${1:-}" in
    add)    shift; cmd_add "$@" ;;
    remove) shift; cmd_remove "$@" ;;
    list)   shift; cmd_list "$@" ;;
    status) shift; cmd_status "$@" ;;
    path)   shift; cmd_path "$@" ;;
    *)      usage ;;
esac
