#!/bin/bash

# CC Start Installer (Mac/Linux)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "==================================="
echo "   CC Start Installer"
echo "==================================="
echo ""

# Check dependencies
echo ""
echo "Checking dependencies..."

# Check Node.js version (need >= 18)
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//;s/\..*//')
fi

needs_install=0
if [[ -z "$NODE_MAJOR" ]] || [[ "$NODE_MAJOR" == "0" ]]; then
    echo "[WARN] Node.js not found"
    needs_install=1
elif [[ "$NODE_MAJOR" -lt 18 ]]; then
    echo "[WARN] Node.js v${NODE_MAJOR} is too old, Claude Code requires >= 18"
    needs_install=1
fi

if [[ "$needs_install" == "1" ]]; then
    echo "Attempting to install Node.js 20 via nvm..."

    # Install nvm if not present
    if ! command -v nvm >/dev/null 2>&1 && [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi

    # Source nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    if ! nvm install 20 >/dev/null 2>&1; then
        echo "[ERROR] Failed to install Node.js automatically"
        echo "Please install manually: https://nodejs.org/"
        exit 1
    fi
    nvm use 20 >/dev/null 2>&1
    nvm alias default 20 >/dev/null 2>&1

    # Force nvm node to front of PATH for this session
    if [[ -d "$NVM_DIR/versions/node" ]]; then
        NODE20_BIN=$(find "$NVM_DIR/versions/node" -maxdepth 1 -name "v20*" -type d | head -1)
        if [[ -n "$NODE20_BIN" ]] && [[ -d "$NODE20_BIN/bin" ]]; then
            export PATH="$NODE20_BIN/bin:$PATH"
        fi
    fi

    # Verify
    NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//;s/\..*//')
    if [[ -z "$NODE_MAJOR" ]] || [[ "$NODE_MAJOR" -lt 18 ]]; then
        echo "[ERROR] Node.js installed but version still too old or not in PATH"
        echo "Please restart your terminal and run this installer again"
        exit 1
    fi
    echo "[OK] Node.js installed: $(node -v)"
else
    echo "[OK] Node.js: $(node -v)"
fi

# Check Claude Code (must have working binary, not just shell stub)
CLAUDE_OK=0
if command -v claude >/dev/null 2>&1; then
    CLAUDE_VER=$(claude --version 2>/dev/null) || true
    if [[ -n "$CLAUDE_VER" ]]; then
        echo "[OK] Claude Code: $CLAUDE_VER"
        CLAUDE_OK=1
    fi
fi

if [[ "$CLAUDE_OK" == "0" ]]; then
    echo ""
    echo "[WARN] Claude Code not found or native binary missing, attempting to install via npm..."
    if ! npm install -g @anthropic-ai/claude-code; then
        echo "[ERROR] Failed to install Claude Code"
        echo "Please run manually: npm install -g @anthropic-ai/claude-code"
        exit 1
    fi
    # Verify again after install
    CLAUDE_VER=$(claude --version 2>/dev/null) || true
    if [[ -n "$CLAUDE_VER" ]]; then
        echo "[OK] Claude Code installed: $CLAUDE_VER"
    else
        echo "[WARN] Claude Code installed but native binary may still be missing"
        echo "  Try running: node node_modules/@anthropic-ai/claude-code/install.cjs"
    fi
fi

# Detect install directory
INSTALL_DIR=""

if [[ -d "$HOME/.local/bin" ]]; then
    INSTALL_DIR="$HOME/.local/bin"
elif [[ -d "/usr/local/bin" ]]; then
    INSTALL_DIR="/usr/local/bin"
else
    echo "Standard install directory not found"
    read -p "Enter install directory (default ~/.local/bin): " custom_dir
    INSTALL_DIR="${custom_dir:-$HOME/.local/bin}"
    mkdir -p "$INSTALL_DIR"
fi

echo "Install directory: $INSTALL_DIR"

# Check if already installed
SKIP_SCRIPTS=0
if [[ -f "$INSTALL_DIR/cc" ]]; then
    echo ""
    echo -e "${YELLOW}[INFO] CC Start is already installed${NC}"
    read -p "Overwrite scripts? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "[INFO] Keeping existing scripts"
        SKIP_SCRIPTS=1
    fi
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy main script
if [[ "$SKIP_SCRIPTS" == "1" ]]; then
    echo ""
    echo "[SKIP] Script copy skipped"
else
    cp "$SCRIPT_DIR/cc" "$INSTALL_DIR/cc"
    chmod +x "$INSTALL_DIR/cc"
    # Fix potential CRLF line endings when installing from Windows filesystem
    sed -i 's/\r$//' "$INSTALL_DIR/cc"
    # Create ccs alias - both cc and ccs are supported
    ln -sf "$INSTALL_DIR/cc" "$INSTALL_DIR/ccs"
    echo -e "${GREEN}[OK] Scripts installed${NC}"
    echo -e "${GREEN}[OK] Commands available: 'cc' and 'ccs'${NC}"
fi

# Create config directory
mkdir -p "$HOME/.claude/models"
echo "[OK] Config directory created"

# Copy model configs
echo ""
echo "Copying model configs..."
if [[ -d "$SCRIPT_DIR/models" ]]; then
    for json_file in "$SCRIPT_DIR/models"/*.json; do
        [[ -f "$json_file" ]] || continue
        filename=$(basename "$json_file")
        if [[ -f "$HOME/.claude/models/$filename" ]]; then
            echo ""
            echo "[INFO] Config file exists: $filename"
            read -p "Overwrite? (y/N): " overwrite
            if [[ "$overwrite" == "y" || "$overwrite" == "Y" ]]; then
                cp "$json_file" "$HOME/.claude/models/"
                echo "[OK] Overwritten: $filename"
            else
                echo "[SKIP] Kept original: $filename"
            fi
        else
            cp "$json_file" "$HOME/.claude/models/"
            echo "[OK] Copied: $filename"
        fi
    done
fi

# Check PATH
echo ""
echo "Checking PATH..."
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${YELLOW}[WARN] $INSTALL_DIR is not in PATH${NC}"
    echo ""
    echo "Please add the following line to your shell config:"
    echo ""

    SHELL_NAME=$(basename "$SHELL")
    if [[ "$SHELL_NAME" == "zsh" ]]; then
        echo "echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
        echo "source ~/.zshrc"
    else
        echo "echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
        echo "source ~/.bashrc"
    fi
    echo ""
else
    echo -e "${GREEN}[OK] PATH check passed${NC}"
fi

echo ""
echo "==================================="
echo "   Installation Complete!"
echo "==================================="
echo ""
echo "Usage:"
echo "  cc/ccs              - Interactive model selection"
echo "  cc/ccs <model>      - Start specified model"
echo "  cc/ccs add          - Add new model config"
echo "  cc/ccs remove <model> - Remove model config"
echo "  cc/ccs reset        - Reset all configs"
echo ""
echo "Note: Both 'cc' and 'ccs' commands are supported"
echo ""
echo "Config location:"
echo "  ~/.claude/models/"
echo ""
echo "[IMPORTANT] Run 'cc add' or 'ccs add' to add model configuration"
