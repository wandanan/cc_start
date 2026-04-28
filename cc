#!/usr/bin/env bash

# Claude Code 多模型启动器
# 用法: ccs [命令] 或直接输入 ccs 进行交互选择

set -e

# 检测调用命令名（cc 或 ccs）
CMD_NAME=$(basename "$0")
[[ "$CMD_NAME" == "cc" ]] || CMD_NAME="ccs"

# 检测用户主目录（Windows 下 Git Bash 的 $HOME 可能是错的，优先用环境变量）
if [[ -n "$USERPROFILE" ]]; then
    HOME_DIR="$(cygpath "$USERPROFILE" 2>/dev/null || echo "$HOME")"
else
    HOME_DIR="$HOME"
fi

CONFIG_DIR="$HOME_DIR/.claude/models"
USER_SETTINGS="$HOME_DIR/.claude/settings.json"

# 查找 Claude Code 可执行文件（Windows 下是 claude.exe）
find_claude_bin() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
        if which claude.exe &>/dev/null; then
            which claude.exe
        elif which claude &>/dev/null; then
            which claude
        elif command -v npx &>/dev/null; then
            echo "npx @anthropic-ai/claude-code"
        else
            echo "$HOME_DIR/.local/bin/claude.exe"
        fi
    else
        which claude 2>/dev/null || echo "$HOME_DIR/.local/bin/claude"
    fi
}

CLAUDE_BIN="$(find_claude_bin)"

# 颜色定义
CYA='\033[0;36m'
BLUE='\033[0;34m'; BLU="$BLUE"
GREEN='\033[0;32m'; GRN="$GREEN"
YELLOW='\033[1;33m'; YLW="$YELLOW"
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# 品牌 Banner
show_banner() {
    echo -e "${CYA}"
    echo '   ┌──────────────────────────┐'
    echo '   │  .d8888b.   .d8888b.     │'
    echo '   │ d88P  Y88b d88P  Y88b    │'
    echo '   │ 888    888 Y88b.         │'
    echo '   │ 888    888  "Y888b.      │'
    echo '   │ 888    888     "Y88b.    │'
    echo '   │ 888    888       "888    │'
    echo '   │ Y88b  d88P Y88b  d88P    │'
    echo '   │  "Y8888P"   "Y8888P"     │'
    echo '   │          START            │'
    echo '   └──────────────────────────┘'
    echo -e "${NC}"
    echo -e "${BOLD}  多模型，一个工具就够了${NC}"
    echo ""
}

# ─── 工具函数 ────────────────────────────────────────────────

# 更新 JSON 配置文件中的 API 字段（awk 处理插入，比 sed 更健壮）
update_json_env() {
    local json_file="$1"
    local model_name="$2"
    local api_key="$3"
    local base_url="$4"
    local tmpfile="${json_file}.tmp"

    # 先尝试替换已存在的字段
    sed -i         -e "s#\"ANTHROPIC_AUTH_TOKEN\": \"[^\"]*\"#\"ANTHROPIC_AUTH_TOKEN\": \"${api_key}\"#g"         -e "s#\"ANTHROPIC_BASE_URL\": \"[^\"]*\"#\"ANTHROPIC_BASE_URL\": \"${base_url}\"#g"         -e "s#\"ANTHROPIC_MODEL\": \"[^\"]*\"#\"ANTHROPIC_MODEL\": \"${model_name}\"#g"         "$json_file" 2>/dev/null || true

    # 对于不存在的字段，在最后一个 } 前插入（使用 awk，Git Bash 自带）
    for pair in "ANTHROPIC_AUTH_TOKEN:${api_key}" "ANTHROPIC_BASE_URL:${base_url}" "ANTHROPIC_MODEL:${model_name}"; do
        local key="${pair%%:*}"
        local val="${pair#*:}"
        if ! grep -q "\"$key\":" "$json_file" 2>/dev/null; then
            awk -v k="$key" -v v="$val" '''
                { lines[NR] = $0 }
                END {
                    for (i = 1; i <= NR; i++) {
                        if (i == NR && lines[i] ~ /^[[:space:]]*}/) {
                            print "  \"" k "\": \"" v "\","
                        }
                        print lines[i]
                    }
                }
            ''' "$json_file" > "$tmpfile" && mv "$tmpfile" "$json_file"
        fi
    done

    if ! grep -q "\"ANTHROPIC_AUTH_TOKEN\":" "$json_file" 2>/dev/null; then
        echo -e "${RED}⚠️  更新配置文件失败: $json_file${NC}"
        return 1
    fi
}

# 从 JSON 文件读取指定字段的值（使用 sed，不依赖 Python）
read_json_field() {
    local json_file="$1"
    local field="$2"
    sed -n "s/.*\"$field\": \"\\([^\"]*\\)\".*/\\1/p" "$json_file" 2>/dev/null | head -1
}

# 全局关联数组（需要 bash 4.0+，macOS 用户请通过 homebrew 安装：brew install bash）
declare -A MODELS
declare -A MODEL_DESCS

# 自动扫描模型配置文件
scan_models() {
    local config_dir="$1"

    for json_file in "$config_dir"/*.json; do
        [[ -f "$json_file" ]] || continue
        local name=$(basename "$json_file" .json)
        MODELS["$name"]="$name"
        local model_id=$(sed -n 's/.*"ANTHROPIC_MODEL": "\([^"]*\)".*/\1/p' "$json_file" 2>/dev/null | head -1)
        MODEL_DESCS["$name"]="${model_id:-$name}"
    done
}

# 交互式选择一个模型（返回名称到 $SELECTED_MODEL）
select_model() {
    local prompt="${1:-请选择模型}"
    SELECTED_MODEL=""

    if [[ ${#MODELS[@]} -eq 0 ]]; then
        echo -e "${YELLOW}⚠  没有已配置的模型，请先使用 ${CMD_NAME} add 添加${NC}"
        return 1
    fi

    local i=1
    local keys=()
    for key in "${!MODELS[@]}"; do
        keys+=("$key")
        printf "  ${GREEN}%d)${NC}  %-14s %s\n" "$i" "$key" "${MODEL_DESCS[$key]}"
        ((i++))
    done
    echo -e "  ${YELLOW}q)${NC}  取消"
    echo ""

    read -e -p "  ${prompt} (编号/名称): " choice
    if [[ -z "$choice" ]]; then
        echo -e "${RED}  无效选择${NC}"
        return 1
    fi
    if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
        return 1
    fi

    if [[ "$choice" =~ ^[0-9]+$ ]]; then
        if [[ "$choice" -ge 1 && "$choice" -le "${#keys[@]}" ]]; then
            SELECTED_MODEL="${keys[$((choice-1))]}"
            return 0
        fi
    elif [[ -n "${MODELS[$choice]}" ]]; then
        SELECTED_MODEL="$choice"
        return 0
    fi

    echo -e "${RED}  无效选择${NC}"
    return 1
}

# ─── 核心功能 ────────────────────────────────────────────────

# 显示菜单（启动用）
show_menu() {
    show_banner
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     请选择模型                    ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""

    local i=1
    local sorted_keys=()

    while IFS= read -r line; do
        sorted_keys+=("$line")
    done < <(for k in "${!MODELS[@]}"; do echo "$k"; done | sort)

    for key in "${sorted_keys[@]}"; do
        printf "  ${GREEN}%d)${NC}  %-14s %s\n" "$i" "$key" "${MODEL_DESCS[$key]}"
        eval "MODEL_$i=$key"
        ((i++))
    done

    echo ""
    echo -e "  ${YELLOW}q)${NC}  退出"
    echo -e "  ${YELLOW}a)${NC}  添加新模型"
    echo -e "  ${YELLOW}h)${NC}  查看帮助"
    echo ""
}

# 列出所有模型
list_models() {
    if [[ ${#MODELS[@]} -eq 0 ]]; then
        echo -e "${YELLOW}⚠  没有已配置的模型，使用 ${CMD_NAME} add 添加${NC}"
        return 0
    fi

    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     已配置的模型                  ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    printf "  ${BOLD}%-16s %s${NC}\n" "命令名称" "模型 ID"
    printf "  ${DIM}%-16s %s${NC}\n" "────────────────" "────────────────────"
    for key in "${!MODELS[@]}"; do
        printf "  ${GREEN}%-16s${NC} %s\n" "$key" "${MODEL_DESCS[$key]}"
    done
    echo ""
}

# 添加新模型
add_model() {
    while true; do
        echo ""
        echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
        echo -e "${BLU}║     添加新模型                    ║${NC}"
        echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
        echo ""
        echo -e "  ${DIM}三步完成配置，之后用 ${CMD_NAME} <名称> 直接启动${NC}"
        echo ""
        echo -e "  ${BOLD}第 1 步 / 4${NC}  ${DIM}─  设置启动命令名称${NC}"

        read -e -p "    启动命令名称 (如 kimi): " alias
        if [[ -z "$alias" ]]; then
            echo -e "  ${RED}✗ 名称不能为空${NC}"
            continue
        fi

        # 检查是否已存在
        if [[ -f "$CONFIG_DIR/${alias}.json" ]]; then
            echo -e "  ${YELLOW}⚠  模型 '${alias}' 已存在${NC}"
            read -e -p "    是否覆盖? (y/N): " confirm
            [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
        fi

        echo ""
        echo -e "  ${BOLD}第 2 步 / 4${NC}  ${DIM}─  设置模型 ID${NC}"

        read -e -p "    模型 ID (如 kimi-k2.5): " name
        [[ -z "$name" ]] && name="$alias"

        echo ""
        echo -e "  ${BOLD}第 3 步 / 4${NC}  ${DIM}─  设置 API Key${NC}"

        read -e -p "    API Key: " api_key
        if [[ -z "$api_key" ]]; then
            echo -e "  ${RED}✗ API Key 不能为空${NC}"
            continue
        fi

        echo ""
        echo -e "  ${BOLD}第 4 步 / 4${NC}  ${DIM}─  设置 API 地址${NC}"

        read -e -p "    Base URL (如 https://api.kimi.com/coding/): " base_url
        if [[ -z "$base_url" ]]; then
            echo -e "  ${RED}✗ Base URL 不能为空${NC}"
            continue
        fi

        # 确认
        echo ""
        echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
        echo -e "${BLU}║     确认配置                      ║${NC}"
        echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
        echo ""
        echo -e "  命令名称:  ${GREEN}${CMD_NAME} ${alias}${NC}"
        echo -e "  模型 ID:   ${name}"
        echo -e "  API Key:   ${api_key:0:8}${DIM}...${NC}${api_key: -4}"
        echo -e "  Base URL:  ${base_url}"
        echo ""
        read -e -p "  确认保存? (Y/n/r 重填): " action
        if [[ "$action" == "r" || "$action" == "R" ]]; then
            echo -e "${YELLOW}  重新填写...${NC}"
            continue
        elif [[ "$action" == "n" || "$action" == "N" ]]; then
            echo "  已取消"
            return 1
        fi

        # 创建配置文件
        if [[ -f "$USER_SETTINGS" ]]; then
            cp "$USER_SETTINGS" "$CONFIG_DIR/${alias}.json"
            update_json_env "$CONFIG_DIR/${alias}.json" "$name" "$api_key" "$base_url"
        else
            cat > "$CONFIG_DIR/${alias}.json" << EOF
{
  "ANTHROPIC_AUTH_TOKEN": "$api_key",
  "ANTHROPIC_BASE_URL": "$base_url",
  "ANTHROPIC_MODEL": "$name"
}
EOF
        fi

        echo ""
        echo -e "  ${GREEN}✓ 模型 '${name}' 添加成功!${NC}"
        echo -e "  ${DIM}配置文件:${NC} ~/.claude/models/${alias}.json"
        echo ""
        echo -e "  ${BOLD}使用方法:${NC}"
        echo -e "    ${GRN}${CMD_NAME} ${alias}${NC}        # 直接启动"
        echo -e "    ${GRN}${CMD_NAME}${NC}               # 从菜单选择"
        return 0
    done
}

# 编辑已有模型
edit_model() {
    local model="$1"

    if [[ -z "$model" ]]; then
        echo ""
        echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
        echo -e "${BLU}║     编辑模型配置                  ║${NC}"
        echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
        echo ""
        if ! select_model "选择要编辑的模型"; then
            return 1
        fi
        model="$SELECTED_MODEL"
    fi

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo -e "${RED}✗ 模型 '$model' 不存在${NC}"
        return 1
    fi

    local cur_name=$(read_json_field "$model_config" "ANTHROPIC_MODEL")
    local cur_key=$(read_json_field "$model_config" "ANTHROPIC_AUTH_TOKEN")
    local cur_url=$(read_json_field "$model_config" "ANTHROPIC_BASE_URL")

    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     编辑模型: ${model}$(printf '%*s' $((24 - ${#model})) '')║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${DIM}直接回车保留当前值${NC}"
    echo ""

    read -e -p "  模型 ID [${cur_name}]: " name
    [[ -z "$name" ]] && name="$cur_name"

    read -e -p "  API Key [${cur_key:0:8}...${cur_key: -4}]: " api_key
    [[ -z "$api_key" ]] && api_key="$cur_key"

    read -e -p "  Base URL [${cur_url}]: " base_url
    [[ -z "$base_url" ]] && base_url="$cur_url"

    echo ""
    echo -e "  ${BOLD}确认修改:${NC}"
    echo -e "    模型 ID:   ${name}"
    echo -e "    API Key:   ${api_key:0:8}${DIM}...${NC}${api_key: -4}"
    echo -e "    Base URL:  ${base_url}"
    echo ""
    read -e -p "  确认保存? (Y/n): " confirm
    if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
        echo "  已取消"
        return 1
    fi

    update_json_env "$model_config" "$name" "$api_key" "$base_url"
    MODEL_DESCS["$model"]="$name"

    echo ""
    echo -e "  ${GREEN}✓ 模型 '${model}' 已更新${NC}"
}

# 删除指定模型
remove_model() {
    local model="$1"

    if [[ -z "$model" ]]; then
        echo ""
        echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
        echo -e "${BLU}║     删除模型配置                  ║${NC}"
        echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
        echo ""
        if ! select_model "选择要删除的模型"; then
            return 1
        fi
        model="$SELECTED_MODEL"
    fi

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo -e "${RED}✗ 模型 '$model' 不存在${NC}"
        return 1
    fi

    echo ""
    echo -e "  ${BOLD}确认删除:${NC}"
    echo -e "    命令名称:  ${RED}${model}${NC}"
    echo -e "    模型 ID:   ${MODEL_DESCS[$model]}"
    echo -e "    配置文件:  ${DIM}${model_config}${NC}"
    echo ""
    echo -ne "  ${RED}确定删除? (y/N):${NC} "
    read -e confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "  已取消"
        return 1
    fi

    rm "$model_config"
    unset "MODELS[$model]"
    unset "MODEL_DESCS[$model]"
    echo ""
    echo -e "  ${GREEN}✓ 模型 '${model}' 已删除${NC}"
}

# 同步模型配置
sync_model() {
    local model="$1"

    if [[ ! -f "$USER_SETTINGS" ]]; then
        echo -e "${RED}✗ 未找到当前配置文件: ${USER_SETTINGS}${NC}"
        echo "  请先启动一次 Claude Code 生成配置文件"
        return 1
    fi

    if [[ -z "$model" ]]; then
        echo ""
        echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
        echo -e "${BLU}║     同步模型配置                  ║${NC}"
        echo -e "${BLU}║     MCP / 插件 → 指定模型         ║${NC}"
        echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
        echo ""
        if ! select_model "选择要同步的模型"; then
            return 1
        fi
        model="$SELECTED_MODEL"
    fi

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo -e "${RED}✗ 模型 '$model' 不存在${NC}"
        return 1
    fi

    local cur_name=$(read_json_field "$model_config" "ANTHROPIC_MODEL")
    local cur_key=$(read_json_field "$model_config" "ANTHROPIC_AUTH_TOKEN")
    local cur_url=$(read_json_field "$model_config" "ANTHROPIC_BASE_URL")

    cp "$USER_SETTINGS" "$model_config"
    update_json_env "$model_config" "$cur_name" "$cur_key" "$cur_url"

    echo ""
    echo -e "  ${GREEN}✓ 模型 '${model}' 已同步${NC}"
    echo -e "  ${DIM}MCP / 插件配置已更新，API 信息已保留${NC}"
    echo -e "  ${DIM}${cur_name} @ ${cur_url}${NC}"
}

# 重置所有配置
reset_models() {
    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     重置所有模型配置              ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${RED}警告: 此操作将删除所有模型配置文件${NC}"
    echo -e "  ${DIM}配置目录: ${CONFIG_DIR}${NC}"
    echo ""

    read -e -p "  确认重置? 输入 yes 继续: " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "  已取消"
        return 1
    fi

    local count=0
    count=$(find "$CONFIG_DIR" -maxdepth 1 -name "*.json" -type f -print 2>/dev/null | wc -l)
    if [[ $count -gt 0 ]]; then
        find "$CONFIG_DIR" -maxdepth 1 -name "*.json" -type f -exec rm {} \; 2>/dev/null
    fi

    echo ""
    echo -e "  ${GREEN}✓ 已删除 ${count} 个配置文件${NC}"
    echo ""
    echo -e "  ${DIM}使用 ${CMD_NAME} add 重新添加模型${NC}"
}

# 启动 Claude
launch_claude() {
    local model="$1"
    shift

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  配置文件不存在: $model_config${NC}"
        exit 1
    fi

    # 交互式选择启动模式（上下箭头）
    local options=("1. 普通启动" "2. dangerously-skip-permissions 启动")
    local count=${#options[@]}
    local selected=0
    local key key2 key3
    local i

    echo ""
    printf "\033[34m请选择启动模式 (↑↓选择, 回车确认):\033[0m\n"
    printf '\033[?25l'  # 隐藏光标

    # 两端环境互不兼容，必须分支处理（诊断结论）：
    # - PowerShell (MSYS bash): stdin 可读 + \033[s/u 光标保存恢复
    # - mintty (Git Bash):      stdin 异常需 /dev/tty + \033[nA 光标上移
    if [[ "$TERM_PROGRAM" == "mintty" ]]; then
        # ── mintty 分支 ──
        exec 3</dev/tty
        while true; do
            for i in "${!options[@]}"; do
                if [[ $i -eq $selected ]]; then
                    printf "  \033[32m▶ ${options[$i]}\033[0m\033[K\n"
                else
                    printf "    ${options[$i]}\033[K\n"
                fi
            done

            IFS= read -rsn1 key <&3 || true
            if [[ "$key" == $'\x1b' ]]; then
                IFS= read -rsn1 -t 0.1 key2 <&3 || true
                IFS= read -rsn1 -t 0.1 key3 <&3 || true
                case "$key2$key3" in
                    '[A') selected=$(( (selected - 1 + count) % count )) ;;
                    '[B') selected=$(( (selected + 1) % count )) ;;
                esac
                printf "\033[${count}A"
            elif [[ "$key" == "" ]]; then
                break
            fi
        done
        exec 3>&-
    else
        # ── PowerShell / 其他分支 ──
        printf '\033[s'  # 保存光标位置
        while true; do
            printf '\033[u'  # 恢复到保存的光标位置
            for i in "${!options[@]}"; do
                if [[ $i -eq $selected ]]; then
                    printf "  \033[32m▶ ${options[$i]}\033[0m\033[K\n"
                else
                    printf "    ${options[$i]}\033[K\n"
                fi
            done

            IFS= read -rsn1 key
            if [[ "$key" == $'\x1b' ]]; then
                IFS= read -rsn1 -t 0.1 key2
                IFS= read -rsn1 -t 0.1 key3
                case "$key2$key3" in
                    '[A') selected=$(( (selected - 1 + count) % count )) ;;
                    '[B') selected=$(( (selected + 1) % count )) ;;
                esac
            elif [[ "$key" == "" ]]; then
                break
            fi
        done
    fi

    printf '\033[?25h'  # 恢复光标

    # 从配置文件中读取 API 信息（支持 env 对象或顶层字段）
    local api_key base_url model_id
    api_key=$(sed -n 's/.*"ANTHROPIC_AUTH_TOKEN": "\([^"]*\)".*/\1/p' "$model_config" 2>/dev/null | head -1)
    base_url=$(sed -n 's/.*"ANTHROPIC_BASE_URL": "\([^"]*\)".*/\1/p' "$model_config" 2>/dev/null | head -1)
    model_id=$(sed -n 's/.*"ANTHROPIC_MODEL": "\([^"]*\)".*/\1/p' "$model_config" 2>/dev/null | head -1)

    # 如果没找到 ANTHROPIC_MODEL，尝试顶层 model 字段
    if [[ -z "$model_id" ]]; then
        model_id=$(sed -n 's/.*"model": "\([^"]*\)".*/\1/p' "$model_config" 2>/dev/null | head -1)
    fi

    # 导出环境变量（这才是 Claude Code 真正读取第三方 API 的方式）
    if [[ -n "$api_key" ]]; then
        export ANTHROPIC_AUTH_TOKEN="$api_key"
    fi
    if [[ -n "$base_url" ]]; then
        export ANTHROPIC_BASE_URL="$base_url"
    fi
    if [[ -n "$model_id" ]]; then
        export ANTHROPIC_MODEL="$model_id"
    fi

    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     启动 Claude Code              ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}▶${NC} 模型: ${BOLD}${MODEL_DESCS[$model]}${NC}"
    if [[ -n "$model_id" ]]; then
        echo -e "  ${DIM}  ID: ${model_id}${NC}"
    fi
    if [[ -n "$base_url" ]]; then
        echo -e "  ${DIM}  URL: ${base_url}${NC}"
    fi
    if [[ $selected -eq 1 ]]; then
        echo -e "  ${DIM}  模式: dangerously-skip-permissions${NC}"
    fi
    echo ""

    # 使用 --settings 参数直接指定配置文件，避免多窗口冲突
    # 将 CLAUDE_BIN 拆分为数组，支持 npx 等多词命令
    read -ra CLAUDE_CMD <<< "$CLAUDE_BIN"
    if [[ $selected -eq 1 ]]; then
        "${CLAUDE_CMD[@]}" --dangerously-skip-permissions --settings "$model_config" "$@"
    else
        "${CLAUDE_CMD[@]}" --settings "$model_config" "$@"
    fi
}

# ─── 帮助 ────────────────────────────────────────────────────

show_help() {
    show_banner
    echo -e "  ${BOLD}用法:${NC}"
    echo ""
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME}" "交互式选择模型启动"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} <模型名>" "直接启动指定模型"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} ls" "列出所有已配置模型"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} add" "添加新模型配置"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} edit [模型名]" "编辑已有模型配置"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} remove [模型名]" "删除模型配置"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} sync [模型名]" "同步 MCP/插件到指定模型"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} reset" "重置所有配置"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} -h" "显示此帮助"
    echo ""
    if [[ ${#MODELS[@]} -gt 0 ]]; then
        echo -e "  ${BOLD}已配置的模型:${NC}"
        echo ""
        for key in "${!MODELS[@]}"; do
            printf "  ${GREEN}·${NC} %-16s %s\n" "$key" "${MODEL_DESCS[$key]}"
        done
    else
        echo -e "  ${YELLOW}暂无已配置的模型，使用 ${CMD_NAME} add 添加${NC}"
    fi
    echo ""
}

# ─── 主逻辑 ──────────────────────────────────────────────────

main() {
    # 确保配置目录存在
    mkdir -p "$CONFIG_DIR" 2>/dev/null || true

    # 扫描模型配置
    scan_models "$CONFIG_DIR"

    # 无参数：显示帮助 + 进入交互菜单
    if [[ -z "$1" ]]; then
        # 进入交互选择
        while true; do
            show_menu
            read -e -p "  请输入编号或名称 (q=退出 a=添加 h=帮助): " choice

            if [[ -z "$choice" ]]; then
                echo -e "${RED}  请输入选项${NC}"
                echo ""
                read -p "  按回车继续..."
                continue
            fi

            case "$choice" in
                q|Q)
                    echo -e "  ${DIM}再见!${NC}"
                    exit 0
                    ;;
                a|A)
                    add_model
                    scan_models "$CONFIG_DIR"
                    echo ""
                    read -p "  按回车继续..."
                    continue
                    ;;
                h|H)
                    show_help
                    echo ""
                    read -p "  按回车继续..."
                    continue
                    ;;
            esac

            if [[ "$choice" =~ ^[0-9]+$ ]]; then
                eval "selected=\$MODEL_$choice"
                if [[ -n "$selected" && -n "${MODELS[$selected]}" ]]; then
                    launch_claude "$selected"
                    exit $?
                else
                    echo -e "${RED}  无效选择${NC}"
                fi
            elif [[ -n "${MODELS[$choice]}" ]]; then
                launch_claude "$choice"
                exit $?
            else
                echo -e "${RED}  未知选项: $choice${NC}"
            fi

            echo ""
            read -p "  按回车继续..."
        done
    fi

    # 命令分发
    case "$1" in
        add)
            add_model
            exit $?
            ;;
        edit)
            edit_model "$2"
            exit $?
            ;;
        remove|rm)
            remove_model "$2"
            exit $?
            ;;
        list|ls)
            list_models
            exit 0
            ;;
        sync)
            sync_model "$2"
            exit $?
            ;;
        reset)
            reset_models
            exit $?
            ;;
        -h|--help|help)
            show_help
            exit 0
            ;;
        *)
            # 尝试作为模型名启动
            local model="$1"
            shift
            if [[ -n "${MODELS[$model]}" ]]; then
                launch_claude "$model" "$@"
                exit $?
            else
                echo ""
                echo -e "  ${RED}✗ 未知命令或模型: ${BOLD}${model}${NC}"
                echo ""
                echo -e "  ${DIM}使用 ${CMD_NAME} -h 查看帮助${NC}"
                exit 1
            fi
            ;;
    esac
}

main "$@"
