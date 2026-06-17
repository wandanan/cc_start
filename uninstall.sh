#!/bin/bash
# CC Start Uninstaller (Mac/Linux)

set -e

RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

echo ""
echo -e "${BOLD}CC Start 卸载程序${NC}"
echo ""

# ── portable sed -i (macOS BSD sed requires backup extension) ──
sed_i() {
    if [[ "$(uname -s)" == "Darwin" ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# ── 查找安装目录 ──────────────────────────────────────────────
FOUND_DIRS=()
for d in "$HOME/.local/bin" "/usr/local/bin"; do
    if [[ -f "$d/cc" ]]; then
        FOUND_DIRS+=("$d")
    fi
done

if [[ ${#FOUND_DIRS[@]} -eq 0 ]]; then
    echo -e "${YLW}未找到 CC Start 安装${NC}"
    exit 0
fi

if [[ ${#FOUND_DIRS[@]} -gt 1 ]]; then
    echo -e "检测到多处安装:"
    for i in "${!FOUND_DIRS[@]}"; do
        echo -e "  ${BOLD}[$((i+1))]${NC} ${FOUND_DIRS[$i]}"
    done
    read -p "选择要卸载的目录 (1-${#FOUND_DIRS[@]}, 或 'all' 全部卸载): " choice
    if [[ "$choice" == "all" ]]; then
        TARGETS=("${FOUND_DIRS[@]}")
    else
        TARGETS=("${FOUND_DIRS[$((choice-1))]}")
    fi
else
    TARGETS=("${FOUND_DIRS[0]}")
fi

echo ""

# ── 确认 ──────────────────────────────────────────────────────
echo -e "${RED}${BOLD}即将卸载以下内容:${NC}"
echo ""

for d in "${TARGETS[@]}"; do
    echo -e "  ${BOLD}脚本:${NC} $d/cc, $d/ccs"
done
echo -e "  ${BOLD}运行时:${NC} ~/.local/share/cc-start/"
for d in "${TARGETS[@]}"; do
    prefix_share="${d%/bin}/share/cc-start"
    if [[ -d "$prefix_share" ]] && [[ "$prefix_share" != "$HOME/.local/share/cc-start" ]]; then
        echo -e "  ${BOLD}运行时:${NC} $prefix_share/"
    fi
done
echo -e "  ${BOLD}配置:${NC} ~/.claude/models/ (需确认)"
echo ""

read -p "确认卸载? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "已取消"
    exit 0
fi

echo ""

# ── 1. 移除脚本 ───────────────────────────────────────────────
for d in "${TARGETS[@]}"; do
    echo -e "${DIM}移除脚本: $d${NC}"
    rm -f "$d/cc" "$d/ccs"
    if [[ -L "$d/ccs" ]]; then
        rm -f "$d/ccs"
    fi
done

# ── 2. 移除运行时文件 ─────────────────────────────────────────
echo -e "${DIM}移除运行时文件...${NC}"
rm -rf "$HOME/.local/share/cc-start"

for d in "${TARGETS[@]}"; do
    prefix_share="${d%/bin}/share/cc-start"
    if [[ -d "$prefix_share" ]] && [[ "$prefix_share" != "$HOME/.local/share/cc-start" ]]; then
        rm -rf "$prefix_share"
    fi
done

# ── 3. 清理临时设置文件 ───────────────────────────────────────
rm -f /tmp/cc-settings-*.json "$HOME/.local/share/cc-start/tmp/cc-settings-*.json" 2>/dev/null || true

# ── 4. 询问是否移除模型配置 ────────────────────────────────────
echo ""
echo -e "${YLW}是否同时移除模型配置文件?${NC}"
echo -e "${DIM}这包括 ~/.claude/models/ 下的所有 API Key 配置${NC}"
read -p "移除模型配置? (y/N): " remove_configs

if [[ "$remove_configs" == "y" || "$remove_configs" == "Y" ]]; then
    rm -rf "$HOME/.claude/models"
    echo -e "  ${GRN}✓${NC} 模型配置已移除"
else
    echo -e "  ${DIM}→${NC} 模型配置已保留: ~/.claude/models/"
fi

# ── 5. 清理 shell 配置中的 PATH 条目 ───────────────────────────
for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [[ -f "$rc" ]]; then
        for d in "${TARGETS[@]}"; do
            # Remove exact export PATH=$d:... lines
            sed_i "\|export PATH=\"$d:\$PATH\"|d" "$rc" 2>/dev/null || true
            sed_i "\|export PATH=$d:\$PATH|d" "$rc" 2>/dev/null || true
            sed_i "\|export PATH=\"$d:\\\$PATH\"|d" "$rc" 2>/dev/null || true
        done
        # Remove the CC Start comment lines (both old and new formats)
        sed_i '/^# CC Start/d' "$rc" 2>/dev/null || true
        sed_i '/^# WSL proxy (CC Start)$/d' "$rc" 2>/dev/null || true
        sed_i '/^export PATH=.*\/\.local\/bin:\$PATH/d' "$rc" 2>/dev/null || true
    fi
done

# ── 6. 清理 WSL 代理配置 ───────────────────────────────────────
if [[ -f "$HOME/.wsl-proxy.sh" ]]; then
    read -p "移除 WSL 代理配置文件 ~/.wsl-proxy.sh? (y/N): " remove_proxy
    if [[ "$remove_proxy" == "y" || "$remove_proxy" == "Y" ]]; then
        rm -f "$HOME/.wsl-proxy.sh"
        # Also remove sourcing line from shell rc
        for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
            if [[ -f "$rc" ]]; then
                sed_i '\|\. "$HOME/.wsl-proxy.sh"|d' "$rc" 2>/dev/null || true
                sed_i '\|\. "\$HOME/.wsl-proxy.sh"|d' "$rc" 2>/dev/null || true
            fi
        done
        echo -e "  ${GRN}✓${NC} WSL 代理配置已移除"
    fi
fi

# ── 完成 ──────────────────────────────────────────────────────
echo ""
echo -e "${GRN}${BOLD}  ✓ 卸载完成${NC}"
echo ""
echo -e "${DIM}  如需重新安装: ./install.sh${NC}"
echo ""
