#!/bin/bash

# CC Start Installer (Mac/Linux)

set -e

NPM_REGISTRY="https://registry.npmmirror.com"

npm_direct() {
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY "$@"
}

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
    echo '  _____  _____         _____  _______   ___      _____  _______ '
    echo '  / ____|/ ____|       / ____||__   __| /   \    |  __ \|__   __|'
    echo ' | |    | |           | (___     | |   /  ^  \   | |__) |  | |   '
    echo ' | |    | |            \___ \    | |  /  /_\  \  |  _  /   | |   '
    echo ' | |____| |____        ____) |   | | /  _____  \ | | \ \   | |   '
    echo '  \_____|\_____|      |_____/    |_|/__/     \__\|_|  \_\  |_|   '
    echo '                                    |__|     |__|                '
    echo -e "${NC}"
    echo -e "${BOLD}  一条命令，终结 Claude Code 的上手门槛${NC}"
    echo -e "${DIM}  多模型，一个工具就够了${NC}"
    echo ""
}

# ── 步骤工具 ──────────────────────────────────────────────────
TOTAL_STEPS=8
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
FOUND_CLAUDE_PATH=""

if command -v claude >/dev/null 2>&1; then
    FOUND_CLAUDE_PATH=$(which claude 2>/dev/null || command -v claude)
    CLAUDE_VER=$(claude --version 2>/dev/null) || true
fi

# WSL: skip Windows binaries found via interop — they can't see Linux filesystem
if [[ -n "$FOUND_CLAUDE_PATH" ]] && [[ "$FOUND_CLAUDE_PATH" == /mnt/* ]]; then
    step_warn "检测到 Windows 版 Claude Code (${FOUND_CLAUDE_PATH})"
    step_info "WSL 中需安装原生 Linux 版本，跳过 Windows 版本"
    CLAUDE_OK=0
elif [[ -n "$CLAUDE_VER" ]]; then
    step_ok "Claude Code: ${CLAUDE_VER}"
    CLAUDE_OK=1
elif [[ -n "$FOUND_CLAUDE_PATH" ]]; then
    step_warn "Claude Code 已安装但二进制不可用"
else
    step_warn "Claude Code 未检测到"
fi

if [[ "$CLAUDE_OK" == "0" ]]; then
    npm_cmd="npm"
    npm_prefix=""
    npm_prefix=$(npm config get prefix 2>/dev/null)
    if [[ "$OSTYPE" == "linux-gnu"* ]] && [[ -n "$npm_prefix" ]] && [[ ! -w "$npm_prefix/lib/node_modules" ]]; then
        if sudo -n true 2>/dev/null; then
            npm_cmd="sudo npm"
        else
            step_fail "需要 root 权限，请手动执行: sudo npm install -g @anthropic-ai/claude-code"
            exit 1
        fi
    fi

    # Clean up stale npm temp directories from previous interrupted installs
    pkg_dir="$npm_prefix/lib/node_modules/@anthropic-ai"
    if [[ -d "$pkg_dir" ]]; then
        sudo_prefix=""
        [[ "$npm_cmd" == "sudo npm" ]] && sudo_prefix="sudo"
        $sudo_prefix rm -rf "$pkg_dir"/.claude-code-* 2>/dev/null || true
    fi

    step_info "安装 Claude Code (约 200MB，下载较慢请耐心等待)..."
    install_ok=0

    step_info "Using npm registry: $NPM_REGISTRY"
    if npm_direct $npm_cmd install -g --no-audit --no-fund @anthropic-ai/claude-code --registry="$NPM_REGISTRY"; then
        CLAUDE_VER=$(claude --version 2>/dev/null) || true
        step_ok "Claude Code 安装成功"
        install_ok=1
    else
        step_fail "安装失败，请手动执行: $npm_cmd install -g @anthropic-ai/claude-code"
    fi

    if [[ $install_ok -eq 0 ]]; then
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
    ln -sf "$INSTALL_DIR/cc" "$INSTALL_DIR/ccs"
    step_ok "cc  → ${INSTALL_DIR}/cc"
    step_ok "ccs → ${INSTALL_DIR}/ccs"
fi

# ═══════════════════════════════════════════════════════════════
# Step 4: 创建配置目录
# ═══════════════════════════════════════════════════════════════
step_begin "初始化配置目录" "为模型配置文件创建存储位置..."

# Install TypeScript CLI sidecar. Node is guaranteed by Step 1 above.
if [[ -f "$SCRIPT_DIR/package.json" ]]; then
    step_info "Building TypeScript CLI..."
    (
        cd "$SCRIPT_DIR"
        if [[ ! -x "node_modules/.bin/tsc" ]]; then
            step_info "Using npm registry: $NPM_REGISTRY"
            npm_direct npm install --registry="$NPM_REGISTRY"
        fi
        npm run build
    )

    APP_DIR="$HOME/.local/share/cc-start"
    rm -rf "$APP_DIR/dist"
    mkdir -p "$APP_DIR/dist"
    cp -R "$SCRIPT_DIR/dist/." "$APP_DIR/dist/"
    step_ok "TypeScript CLI installed"

    # Also deploy to prefix-relative share/ so system-wide installs self-locate
    # e.g. /usr/local/bin/cc → /usr/local/share/cc-start/dist/cli.js
    prefix_share="${INSTALL_DIR%/bin}/share/cc-start/dist"
    if [[ "$prefix_share" != "$APP_DIR/dist" ]]; then
        mkdir -p "$prefix_share" 2>/dev/null && cp -R "$SCRIPT_DIR/dist/." "$prefix_share/" 2>/dev/null || true
    fi
fi

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
# Step 6: 补齐 skipWebFetchPreflight 配置
# ═══════════════════════════════════════════════════════════════
step_begin "补齐 WebFetch 配置" "检查已有模型配置，自动添加 skipWebFetchPreflight..."

fixed_count=0
for json_file in "$HOME/.claude/models"/*.json; do
    [[ -f "$json_file" ]] || continue
    if grep -q '"skipWebFetchPreflight"' "$json_file" 2>/dev/null; then
        continue
    fi
    tmpfile="${json_file}.tmp"
    awk -v key="skipWebFetchPreflight" -v val="true" '
        { lines[NR] = $0 }
        END {
            prev_idx = 0
            for (j = NR - 1; j >= 1; j--) {
                if (lines[j] !~ /^[[:space:]]*$/) {
                    prev_idx = j
                    break
                }
            }
            for (i = 1; i <= NR; i++) {
                if (i == NR && lines[i] ~ /^[[:space:]]*}/) {
                    print "  \"" key "\": " val
                }
                if (i == prev_idx) {
                    if (lines[i] ~ /[,\{][[:space:]]*$/) {
                        print lines[i]
                    } else {
                        print lines[i] ","
                    }
                } else {
                    print lines[i]
                }
            }
        }
    ' "$json_file" > "$tmpfile" && mv "$tmpfile" "$json_file"
    step_ok "$(basename "$json_file")"
    fixed_count=$((fixed_count + 1))
done

if [[ $fixed_count -eq 0 ]]; then
    step_info "所有配置已包含 skipWebFetchPreflight"
fi

# ═══════════════════════════════════════════════════════════════
# Step 7: 配置 PATH
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
# Step 8: WSL 网络代理
# ═══════════════════════════════════════════════════════════════
step_begin "WSL 网络代理" "检测 WSL 环境，自动配置代理穿透..."

if [[ -f /proc/version ]] && grep -qi "microsoft\|wsl" /proc/version 2>/dev/null; then

    # Check if mirrored networking is already enabled
    win_user=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
    wslconfig_path="${win_user:+/mnt/c/Users/${win_user}/.wslconfig}"

    if [[ -n "$wslconfig_path" ]] && [[ -f "$wslconfig_path" ]] && grep -q "networkingMode.*mirrored" "$wslconfig_path" 2>/dev/null; then
        step_ok "WSL 镜像网络模式已启用，无需代理配置"
    else
        # Get Windows host IP from WSL resolver
        host_ip=$(cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print $2}' | head -1)
        if [[ -z "$host_ip" ]]; then
            host_ip=$(ip route show default 2>/dev/null | awk '{print $3}' | head -1)
            [[ -z "$host_ip" ]] && host_ip="172.26.0.1"
        fi

        # Try to detect proxy port from existing shell config
        proxy_port=""
        for rc in "$HOME/.bashrc" "$HOME/.profile" "$HOME/.zshrc"; do
            if [[ -f "$rc" ]]; then
                port=$(grep -oP '(localhost|127\.0\.0\.1):\K[0-9]+' "$rc" 2>/dev/null | head -1)
                if [[ -n "$port" ]]; then
                    proxy_port="$port"
                    break
                fi
            fi
        done

        # If no port found, check common proxy ports on host
        if [[ -z "$proxy_port" ]]; then
            for try_port in 7890 7891 10809 1080 8080 8888 9090; do
                if timeout 2 bash -c "echo >/dev/tcp/${host_ip}/${try_port}" 2>/dev/null; then
                    proxy_port="$try_port"
                    break
                fi
            done
        fi

        # Ask user as last resort
        if [[ -z "$proxy_port" ]]; then
            echo ""
            echo -e "  ${YLW}  未检测到宿主机代理端口${NC}"
            echo -e "  ${DIM}  常见: Clash=7890, V2Ray=10809, SSR=1080${NC}"
            echo ""
            read -p "  请输入代理端口 (回车跳过): " proxy_port
        fi

        if [[ -n "$proxy_port" ]]; then
            # Remove old localhost-based proxy config from shell rc
            for rc in "$HOME/.bashrc" "$HOME/.profile"; do
                if [[ -f "$rc" ]]; then
                    sed -i '/^[[:space:]]*export .*[Pp][Rr][Oo][Xx][Yy].*localhost/d' "$rc" 2>/dev/null || true
                    sed -i '/^[[:space:]]*export .*[Pp][Rr][Oo][Xx][Yy].*127\.0\.0\.1/d' "$rc" 2>/dev/null || true
                fi
            done

            # Write fresh proxy config
            proxy_file="$HOME/.wsl-proxy.sh"
            cat > "$proxy_file" << PROXYEOF
# WSL Proxy — auto-configured by CC Start ($(date '+%Y-%m-%d %H:%M'))
# Dynamically resolves host IP each time in case it changes
host_ip=\$(cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print \$2}' | head -1)
if [[ -n "\$host_ip" ]]; then
    export HTTP_PROXY="http://\${host_ip}:${proxy_port}"
    export HTTPS_PROXY="http://\${host_ip}:${proxy_port}"
    export http_proxy="http://\${host_ip}:${proxy_port}"
    export https_proxy="http://\${host_ip}:${proxy_port}"
    export NO_PROXY="localhost,127.0.0.1,::1"
    export no_proxy="localhost,127.0.0.1,::1"
fi
PROXYEOF

            # Source from shell rc
            SHELL_RC="$HOME/.bashrc"
            [[ "$(basename "$SHELL")" == "zsh" ]] && SHELL_RC="$HOME/.zshrc"

            if ! grep -q "wsl-proxy.sh" "$SHELL_RC" 2>/dev/null; then
                echo "" >> "$SHELL_RC"
                echo "# WSL proxy (CC Start)" >> "$SHELL_RC"
                echo "[ -f \"\$HOME/.wsl-proxy.sh\" ] && . \"\$HOME/.wsl-proxy.sh\"" >> "$SHELL_RC"
            fi

            # Apply immediately for this session
            source "$proxy_file" 2>/dev/null || true

            step_ok "代理已配置 → ${host_ip}:${proxy_port}"
            echo -e "  ${DIM}  配置写入 ~/.wsl-proxy.sh，重启 shell 自动生效${NC}"
        else
            step_info "已跳过代理配置"
            echo -e "  ${DIM}  如需手动配置: 编辑 ~/.wsl-proxy.sh 后 source 即可${NC}"
        fi

        # Also suggest mirrored networking mode
        echo ""
        echo -e "  ${YLW}💡 提示: 启用 WSL 镜像网络模式后可彻底告别代理配置${NC}"
        echo -e "  ${DIM}  在 Windows 上创建 %USERPROFILE%\\.wslconfig:${NC}"
        echo -e "  ${DIM}    [wsl2]${NC}"
        echo -e "  ${DIM}    networkingMode=mirrored${NC}"
        echo -e "  ${DIM}    dnsTunneling=true${NC}"
        echo -e "  ${DIM}  然后 wsl --shutdown 重启即可${NC}"
    fi
else
    step_info "非 WSL 环境，跳过"
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
