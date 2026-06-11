#!/usr/bin/env bash
# CC Start - Multi-model launcher for Claude Code (TypeScript)

# Resolve node from nvm if not already in PATH
if ! command -v node >/dev/null 2>&1; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
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
