#!/bin/bash

# CC Start Installer (Mac/Linux)

set -e

# ── 颜色 ──────────────────────────────────────────────────────
CYA='\033[0;36m'
BLU='\033[0;34m'
GRN='\033[0;32m'
YLW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── 品牌 Banner ──────────────────────────────────────────────
show_banner() {
    echo -e "${CYA}"
    echo '   ┌─────────────────────────────────────┐'
    echo '   │                                     │'
    echo '   │     .d8888b.   .d8888b.              │'
    echo '   │    d88P  Y88b d88P  Y88b             │'
    echo '   │    888    888 888    888             │'
    echo '   │    888        888                    │'
    echo '   │    888        888                    │'
    echo '   │    888    888 888    888             │'
    echo '   │    Y88b  d88P Y88b  d88P             │'
    echo '   │     "Y8888P"   "Y8888P"              │'
    echo '   │                                     │'
    echo '   │        S T A R T                    │'
    echo '   └─────────────────────────────────────┘'
    echo -e "${NC}"
    echo -e "${BOLD}  一条命令，终结 Claude Code 的上手门槛${NC}"
    echo -e "${DIM}  多模型，一个工具就够了${NC}"
    echo ""
}

# ── 步骤工具 ──────────────────────────────────────────────────
TOTAL_STEPS=6
step=0

step_begin() {
    step=$((step + 1))
    echo ""
    echo -ne "${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BOLD}[${step}/${TOTAL_STEPS}] $1${NC}"
    echo -e "${DIM}$2${NC}"
}

step_ok() {
    echo -e "  ${GRN}✓${NC} $1"
}

step_fail() {
    echo -e "  ${RED}✗${NC} $1"
}

step_warn() {
    echo -e "  ${YLW}⚠${NC} $1"
}

step_info() {
    echo -e "  ${BLU}→${NC} $1"
}

# ── 起始 ──────────────────────────────────────────────────────

clear 2>/dev/null || true
show_banner

echo -e "${BOLD}CC Start 安装程序${NC}"
echo -e "${DIM}系统: $(uname -s) | Shell: ${SHELL##*/} | $(date '+%Y-%m-%d %H:%M')${NC}"

# ═══════════════════════════════════════════════════════════════
# Step 1: 检测依赖
# ═══════════════════════════════════════════════════════════════
step_begin "环境检测" "检查 Node.js & Claude Code 运行环境..."

# Check Node.js
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//;s/\..*//')
fi

needs_install=0
if [[ -z "$NODE_MAJOR" ]] || [[ "$NODE_MAJOR" == "0" ]]; then
    step_warn "Node.js 未检测到"
    needs_install=1
elif [[ "$NODE_MAJOR" -lt 18 ]]; then
    step_warn "Node.js v${NODE_MAJOR} 版本过低（需要 ≥ 18）"
    needs_install=1
else
    step_ok "Node.js $(node -v)"
fi

if [[ "$needs_install" == "1" ]]; then
    step_info "尝试通过 nvm 安装 Node.js 20..."

    # Install nvm if not present
    if ! command -v nvm >/dev/null 2>&1 && [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi

    # Source nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    if nvm install 20 >/dev/null 2>&1; then
        nvm use 20 >/dev/null 2>&1
        nvm alias default 20 >/dev/null 2>&1
        step_ok "Node.js $(node -v) 安装成功"
    else
        step_fail "自动安装失败，请手动安装: https://nodejs.org/"
        exit 1
    fi

    # Force nvm node to front of PATH
    if [[ -d "$NVM_DIR/versions/node" ]]; then
        NODE20_BIN=$(find "$NVM_DIR/versions/node" -maxdepth 1 -name "v20*" -type d | head -1)
        if [[ -n "$NODE20_BIN" ]] && [[ -d "$NODE20_BIN/bin" ]]; then
            export PATH="$NODE20_BIN/bin:$PATH"
        fi
    fi
fi

# Check Claude Code
CLAUDE_OK=0
if command -v claude >/dev/null 2>&1; then
    CLAUDE_VER=$(claude --version 2>/dev/null) || true
    if [[ -n "$CLAUDE_VER" ]]; then
        step_ok "Claude Code: ${CLAUDE_VER}"
        CLAUDE_OK=1
    else
        step_warn "Claude Code 已安装但二进制不可用"
    fi
else
    step_warn "Claude Code 未检测到"
fi

if [[ "$CLAUDE_OK" == "0" ]]; then
    step_info "通过 npm 安装 Claude Code..."
    if npm install -g @anthropic-ai/claude-code; then
        CLAUDE_VER=$(claude --version 2>/dev/null) || true
        step_ok "Claude Code 安装成功"
    else
        step_fail "安装失败，请手动执行: npm install -g @anthropic-ai/claude-code"
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════
# Step 2: 选择安装目录
# ═══════════════════════════════════════════════════════════════
step_begin "选择安装目录" "确定脚本安装位置..."

INSTALL_DIR=""

if [[ -d "$HOME/.local/bin" ]]; then
    INSTALL_DIR="$HOME/.local/bin"
elif [[ -d "/usr/local/bin" ]]; then
    INSTALL_DIR="/usr/local/bin"
else
    read -p "  输入安装目录 (默认 ~/.local/bin): " custom_dir
    INSTALL_DIR="${custom_dir:-$HOME/.local/bin}"
    mkdir -p "$INSTALL_DIR"
fi

step_ok "安装目录: ${INSTALL_DIR}"

# ═══════════════════════════════════════════════════════════════
# Step 3: 安装脚本
# ═══════════════════════════════════════════════════════════════
step_begin "安装启动脚本" "复制 cc / ccs 到目标目录..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKIP_SCRIPTS=0

if [[ -f "$INSTALL_DIR/cc" ]]; then
    step_warn "检测到已有安装"
    read -p "  覆盖现有脚本? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        step_info "保留现有脚本，跳过安装"
        SKIP_SCRIPTS=1
    fi
fi

if [[ "$SKIP_SCRIPTS" == "0" ]]; then
    cp "$SCRIPT_DIR/cc" "$INSTALL_DIR/cc"
    chmod +x "$INSTALL_DIR/cc"
    sed -i 's/\r$//' "$INSTALL_DIR/cc"
    ln -sf "$INSTALL_DIR/cc" "$INSTALL_DIR/ccs"
    step_ok "cc  → ${INSTALL_DIR}/cc"
    step_ok "ccs → ${INSTALL_DIR}/ccs"
fi

# ═══════════════════════════════════════════════════════════════
# Step 4: 创建配置目录
# ═══════════════════════════════════════════════════════════════
step_begin "初始化配置目录" "为模型配置文件创建存储位置..."

mkdir -p "$HOME/.claude/models"
step_ok "~/.claude/models/"

# ═══════════════════════════════════════════════════════════════
# Step 5: 复制模型配置模板
# ═══════════════════════════════════════════════════════════════
step_begin "部署模型配置模板" "提供 4 个国产大模型配置，填入 API Key 即可使用..."

model_count=0
if [[ -d "$SCRIPT_DIR/models" ]]; then
    for json_file in "$SCRIPT_DIR/models"/*.json; do
        [[ -f "$json_file" ]] || continue
        filename=$(basename "$json_file")
        if [[ -f "$HOME/.claude/models/$filename" ]]; then
            step_warn "${filename} 已存在，已跳过"
        else
            cp "$json_file" "$HOME/.claude/models/"
            step_ok "${filename}"
            model_count=$((model_count + 1))
        fi
    done
fi

if [[ $model_count -eq 0 ]]; then
    step_info "无新增配置模板"
fi

# ═══════════════════════════════════════════════════════════════
# Step 6: 配置 PATH
# ═══════════════════════════════════════════════════════════════
step_begin "检查 PATH 配置" "确保安装目录在系统 PATH 中..."

if [[ ":$PATH:" == *":$INSTALL_DIR:"* ]]; then
    step_ok "PATH 已包含 ${INSTALL_DIR}"
else
    step_warn "${INSTALL_DIR} 不在 PATH 中"
    echo ""

    SHELL_NAME=$(basename "$SHELL")
    if [[ "$SHELL_NAME" == "zsh" ]]; then
        echo -e "  ${BLU}→${NC} 请将以下内容添加到 ~/.zshrc:"
        echo ""
        echo -e "    ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        echo ""
        echo -e "  ${BLU}→${NC} 然后执行: ${BOLD}source ~/.zshrc${NC}"
    else
        echo -e "  ${BLU}→${NC} 请将以下内容添加到 ~/.bashrc:"
        echo ""
        echo -e "    ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        echo ""
        echo -e "  ${BLU}→${NC} 然后执行: ${BOLD}source ~/.bashrc${NC}"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# 安装完成
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GRN}${BOLD}  ✓  安装完成！${NC}"
echo ""

# 汇总
echo -e "  ${BOLD}安装汇总${NC}"
echo -e "  ${DIM}────────────────────────────${NC}"
echo -e "  ${BLU}▶${NC} 命令:     ${GRN}cc${NC} / ${GRN}ccs${NC}"
echo -e "  ${BLU}▶${NC} 安装目录: ${INSTALL_DIR}"
echo -e "  ${BLU}▶${NC} 配置目录: ~/.claude/models/"
echo ""

echo -e "  ${BOLD}快速开始${NC}"
echo -e "  ${DIM}────────────────────────────${NC}"
echo -e "  ${BLU}1${NC}  添加模型:  ${BOLD}cc add${NC}"
echo -e "  ${BLU}2${NC}  启动菜单:  ${BOLD}cc${NC}"
echo -e "  ${BLU}3${NC}  直接启动:  ${BOLD}cc kimi${NC}"
echo ""

echo -e "  ${BOLD}常用命令${NC}"
echo -e "  ${DIM}────────────────────────────${NC}"
echo -e "  ${BOLD}cc${NC} / ${BOLD}ccs${NC}        交互选择模型"
echo -e "  ${BOLD}cc${NC} <模型>        直接启动"
echo -e "  ${BOLD}cc${NC} add           添加新模型"
echo -e "  ${BOLD}cc${NC} ls            列出所有模型"
echo -e "  ${BOLD}cc${NC} -h           查看帮助"
echo ""

echo -e "  ${YLW}⚠ 重要：使用前请先运行 ${BOLD}cc add${NC} ${YLW}配置 API Key${NC}"
echo ""
