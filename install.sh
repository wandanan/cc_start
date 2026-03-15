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
    # Create ccs alias to avoid conflict with system cc (C compiler)
    ln -sf "$INSTALL_DIR/cc" "$INSTALL_DIR/ccs"
    echo -e "${GREEN}[OK] Scripts installed${NC}"
    echo -e "${GREEN}[OK] Created alias 'ccs' to avoid conflict with C compiler${NC}"
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
echo "  ccs              - Interactive model selection"
echo "  ccs <model>      - Start specified model"
echo "  ccs add          - Add new model config"
echo "  ccs remove <model> - Remove model config"
echo "  ccs reset        - Reset all configs"
echo ""
echo "Note: Use 'ccs' instead of 'cc' to avoid conflict with C compiler"
echo ""
echo "Config location:"
echo "  ~/.claude/models/"
echo ""
echo "[IMPORTANT] Run 'ccs add' to add model configuration"
