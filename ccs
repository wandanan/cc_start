#!/usr/bin/env bash
# CC Start - Multi-model launcher for Claude Code (TypeScript)

# Resolve node from nvm if not already in PATH
if ! command -v node >/dev/null 2>&1; then
    for nvm_home in "$HOME" "/root"; do
        [ -s "$nvm_home/.nvm/nvm.sh" ] && \. "$nvm_home/.nvm/nvm.sh" 2>/dev/null
    done
fi
if ! command -v node >/dev/null 2>&1; then
    for nvm_home in "$HOME" "/root"; do
        NODE_BIN=$(find "$nvm_home/.nvm/versions/node" -name node -type f 2>/dev/null | head -1)
        [ -n "$NODE_BIN" ] && export PATH="$(dirname "$NODE_BIN"):$PATH" && break
    done
fi

# Find cli.js — try install-prefix-relative first, then XDG data home
script_dir="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
for candidate in \
    "${script_dir%/bin}/share/cc-start/dist/cli.js" \
    "$HOME/.local/share/cc-start/dist/cli.js" \
    "$script_dir/dist/cli.js"; do
    if [[ -f "$candidate" ]]; then
        exec node "$candidate" "$@"
    fi
done

echo "cc: cannot find cli.js — run install.sh again to repair." >&2
exit 1
