# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CC Start is a multi-model launcher for Claude Code. It lets users switch between LLM providers (Kimi, Qwen, GLM, MiniMax, DeepSeek, custom) per terminal window via `cc <model>`. The core is a single ~1250-line bash script that manages per-model config files and merges them with the user's global Claude Code settings at launch time.

## File roles

| File | Purpose |
|------|---------|
| `cc` / `ccs` | Identical copies of the main bash launcher (Linux/macOS entry point + the actual logic on Windows via Git Bash) |
| `cc.cmd` / `ccs.cmd` | Windows CMD wrappers — locate Git Bash, then invoke `cc`/`ccs` through it |
| `cc.ps1` / `ccs.ps1` | PowerShell wrappers — call `.cmd` files (for `pwsh` users) |
| `install.bat` | Windows installer — copies scripts to `%USERPROFILE%\.local\bin`, updates PATH, seeds model configs |
| `install.sh` | macOS/Linux installer — copies `cc` to `~/.local/bin`, symlinks `ccs`, seeds model configs |
| `init.ps1` | Session-only PowerShell init — registers `cc`/`ccs` as PowerShell functions without global install |

## Architecture

### How launch works (the critical path)

1. **Config scan**: On startup, the script scans `~/.claude/models/*.json` into associative arrays (`MODELS`, `MODEL_DESCS`).
2. **Command dispatch**: The `main()` function parses subcommands (`add`, `edit`, `remove`, `ls`, `sync`, `upgrade`, `reset`, `-h`) or treats the argument as a model name to launch.
3. **Settings merge** (`create_merged_settings`): The user's global `~/.claude/settings.json` (which holds MCPs, plugins, hooks — everything except the `env` block) is copied to a temp file, and the `env` block is replaced with the selected model's API credentials. This avoids model A's credentials leaking into model B's session.
4. **Environment export**: All known env vars (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, etc.) are read from the model config and exported into the shell.
5. **CLI invocation**: `claude --settings <tempfile>` (or with `--dangerously-skip-permissions`) is launched.

### Per-model config format (`~/.claude/models/<name>.json`)

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "...",
    "ANTHROPIC_BASE_URL": "https://api.example.com/anthropic",
    "ANTHROPIC_MODEL": "model-id",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "model-id",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "model-id",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "subagent-model-id",
    "CLAUDE_CODE_SUBAGENT_MODEL": "subagent-model-id"
  },
  "skipWebFetchPreflight": true
}
```

DeepSeek configs additionally include `CLAUDE_CODE_EFFORT_LEVEL` and `CLAUDE_CODE_AUTO_COMPACT_WINDOW`.

### DeepSeek special handling

DeepSeek API URLs (containing "deepseek") trigger automatic configuration:
- Model IDs get `[1m]` suffix appended for the 1M-token context window
- Default env fields (effort level=max, compact window=400000) are written
- Launches automatically include `--bare` to avoid DeepSeek's current Anthropic-compatible endpoint rejecting Claude Code system-role messages
- Auto-migration on every `scan_models()` call silently upgrades stale DeepSeek configs

### Platform compatibility

- The script requires **Bash 4.0+** (for associative arrays). macOS users must `brew install bash` since the system bash is 3.2.
- On Windows, the `.cmd` wrappers search for Git Bash at standard locations (`D:\IDE\Git`, `C:\Program Files\Git`). The bash script detects MSYS/Cygwin via `$OSTYPE`/`$MSYSTEM` and adjusts `claude` binary lookup accordingly.
- The interactive arrow-key selector has **two separate branches** for mintty (Git Bash) vs PowerShell/MSYS — the terminal control sequences are incompatible and cannot be unified.

### JSON manipulation

All JSON operations use `sed` and `awk` (no `jq` / Python dependency):
- `set_json_field`: Insert or replace a key-value in a JSON file
- `update_json_env`: Batch-replace the core 3 env fields
- `create_merged_settings`: awk-based `env` block replacement — the most complex JSON manipulation in the project
- `read_json_field`: Extract a single string value via sed

## Constraints

- **No jq dependency** — JSON handling must work with Git Bash's built-in `awk` (no gawk extensions).
- **No Python dependency** — all logic is pure bash.
- **`cc` and `ccs` must stay identical** — they're the same file deployed under two names (Linux avoids name collision with `/usr/bin/cc`).
- **`.gitignore` excludes all `.json` files** except `example-*.json` — model config templates must follow that naming pattern.
- **LF line endings are enforced** via `.gitattributes` for `*.sh`, `cc`, and `ccs`.
