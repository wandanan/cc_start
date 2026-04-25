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
CLAUDE_BIN="$(which claude 2>/dev/null || echo "$HOME_DIR/.local/bin/claude")"
USER_SETTINGS="$HOME_DIR/.claude/settings.json"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ─── 工具函数 ────────────────────────────────────────────────

# 使用 sed 更新 JSON 配置中的 env 字段（不依赖 Python，无需路径转换）
update_json_env() {
    local json_file="$1"
    local model_name="$2"
    local api_key="$3"
    local base_url="$4"

    # sed 原生支持 Git Bash Unix 路径，用 # 做分隔符避免 URL 中 / 冲突
    if ! sed -i \
        -e "s#\"ANTHROPIC_AUTH_TOKEN\": \"[^\"]*\"#\"ANTHROPIC_AUTH_TOKEN\": \"${api_key}\"#g" \
        -e "s#\"ANTHROPIC_BASE_URL\": \"[^\"]*\"#\"ANTHROPIC_BASE_URL\": \"${base_url}\"#g" \
        -e "s#\"ANTHROPIC_MODEL\": \"[^\"]*\"#\"ANTHROPIC_MODEL\": \"${model_name}\"#g" \
        -e "s#\"ANTHROPIC_DEFAULT_HAIKU_MODEL\": \"[^\"]*\"#\"ANTHROPIC_DEFAULT_HAIKU_MODEL\": \"${model_name}\"#g" \
        -e "s#\"ANTHROPIC_DEFAULT_OPUS_MODEL\": \"[^\"]*\"#\"ANTHROPIC_DEFAULT_OPUS_MODEL\": \"${model_name}\"#g" \
        -e "s#\"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"[^\"]*\"#\"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"${model_name}\"#g" \
        -e 's#"includeCoAuthoredBy": [a-z]*#"includeCoAuthoredBy": false#g' \
        "$json_file"; then
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
        echo -e "${YELLOW}⚠️  没有已配置的模型，请先使用 ${CMD_NAME} add 添加${NC}"
        return 1
    fi

    local i=1
    local keys=()
    for key in "${!MODELS[@]}"; do
        keys+=("$key")
        printf "  ${GREEN}%d)${NC} %-12s - %s\n" "$i" "$key" "${MODEL_DESCS[$key]}"
        ((i++))
    done
    echo -e "  ${YELLOW}q)${NC} 取消"
    echo ""

    read -e -p "$prompt (编号/名称): " choice
    if [[ -z "$choice" ]]; then
        echo -e "${RED}无效选择${NC}"
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

    echo -e "${RED}无效选择${NC}"
    return 1
}

# ─── 核心功能 ────────────────────────────────────────────────

# 显示菜单（启动用）
show_menu() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     Claude Code 模型选择器         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
    echo ""
    local i=1
    for key in "${!MODELS[@]}"; do
        printf "  ${GREEN}%d)${NC} %-12s - %s\n" "$i" "$key" "${MODEL_DESCS[$key]}"
        eval "MODEL_$i=$key"
        ((i++))
    done
    echo ""
    echo -e "  ${YELLOW}q)${NC} 退出"
    echo ""
}

# 列出所有模型
list_models() {
    if [[ ${#MODELS[@]} -eq 0 ]]; then
        echo -e "${YELLOW}没有已配置的模型${NC}"
        return 0
    fi

    echo ""
    echo -e "${BLUE}已配置的模型:${NC}"
    echo ""
    printf "  ${GREEN}%-15s${NC} %s\n" "名称" "模型 ID"
    printf "  %s %s\n" "---------------" "--------------------"
    for key in "${!MODELS[@]}"; do
        printf "  %-15s %s\n" "$key" "${MODEL_DESCS[$key]}"
    done
    echo ""
}

# 添加新模型
add_model() {
    while true; do
        echo ""
        echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║     添加新模型配置                 ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
        echo ""
        echo "说明:"
        echo "  • 启动命令名称: 用于输入 ${CMD_NAME} <名称> 启动模型"
        echo "  • Claude Code 界面显示使用的模型名: 如 kimi-k2.5"
        echo ""

        read -e -p "启动命令名称 (如 kimi，则使用 ${CMD_NAME} kimi 启动): " alias
        if [[ -z "$alias" ]]; then
            echo -e "${RED}别名不能为空${NC}"
            continue
        fi

        # 检查是否已存在
        if [[ -f "$CONFIG_DIR/${alias}.json" ]]; then
            echo -e "${YELLOW}⚠️  模型 '$alias' 已存在${NC}"
            read -e -p "是否覆盖? (y/N): " confirm
            [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
        fi

        read -e -p "Claude Code 使用的模型名ID (如 kimi-k2.5): " name
        [[ -z "$name" ]] && name="$alias"

        read -e -p "API Key: " api_key
        if [[ -z "$api_key" ]]; then
            echo -e "${RED}API Key 不能为空${NC}"
            continue
        fi

        read -e -p "Base URL (如 https://api.kimi.com/coding/): " base_url
        if [[ -z "$base_url" ]]; then
            echo -e "${RED}Base URL 不能为空${NC}"
            continue
        fi

        # 确认信息
        echo ""
        echo -e "${BLUE}── 配置确认 ──────────────────────${NC}"
        echo "  命令名称:  ${CMD_NAME} $alias"
        echo "  模型 ID:   $name"
        echo "  API Key:   ${api_key:0:8}...${api_key: -4}"
        echo "  Base URL:  $base_url"
        echo ""
        read -e -p "确认保存? (Y/n/r 重填): " action
        if [[ "$action" == "r" || "$action" == "R" ]]; then
            echo -e "${YELLOW}重新填写...${NC}"
            continue
        elif [[ "$action" == "n" || "$action" == "N" ]]; then
            echo "取消添加"
            return 1
        fi

        # 创建配置文件 - 基于现有 settings.json（保留 MCP、插件等配置）
        if [[ -f "$USER_SETTINGS" ]]; then
            cp "$USER_SETTINGS" "$CONFIG_DIR/${alias}.json"
            echo -e "${GREEN}📋 已基于当前配置文件创建副本，保留 MCP、插件等设置${NC}"
            update_json_env "$CONFIG_DIR/${alias}.json" "$name" "$api_key" "$base_url"
        else
            echo -e "${YELLOW}⚠️  未找到现有配置文件，将创建最小配置${NC}"
            cat > "$CONFIG_DIR/${alias}.json" << EOF
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "$api_key",
    "ANTHROPIC_BASE_URL": "$base_url",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$name",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "$name",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "$name",
    "ANTHROPIC_MODEL": "$name"
  },
  "includeCoAuthoredBy": false
}
EOF
        fi

        echo ""
        echo -e "${GREEN}✅ 模型 '$name' 添加成功!${NC}"
        echo "配置文件: $CONFIG_DIR/${alias}.json"
        echo ""
        echo "使用方法:"
        echo "  ${CMD_NAME} $alias        # 直接启动"
        echo "  ${CMD_NAME}               # 从菜单选择"
        return 0
    done
}

# 编辑已有模型
edit_model() {
    local model="$1"

    # 如果没指定模型，交互选择
    if [[ -z "$model" ]]; then
        echo ""
        echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║     编辑模型配置                   ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
        echo ""
        if ! select_model "选择要编辑的模型"; then
            return 1
        fi
        model="$SELECTED_MODEL"
    fi

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo -e "${RED}⚠️  模型 '$model' 不存在${NC}"
        return 1
    fi

    # 读取当前值
    local cur_name=$(read_json_field "$model_config" "ANTHROPIC_MODEL")
    local cur_key=$(read_json_field "$model_config" "ANTHROPIC_AUTH_TOKEN")
    local cur_url=$(read_json_field "$model_config" "ANTHROPIC_BASE_URL")

    echo ""
    echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     编辑模型: $model"
    echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}提示: 直接回车保留当前值${NC}"
    echo ""

    read -e -p "模型 ID [$cur_name]: " name
    [[ -z "$name" ]] && name="$cur_name"

    read -e -p "API Key [${cur_key:0:8}...${cur_key: -4}]: " api_key
    [[ -z "$api_key" ]] && api_key="$cur_key"

    read -e -p "Base URL [$cur_url]: " base_url
    [[ -z "$base_url" ]] && base_url="$cur_url"

    # 确认
    echo ""
    echo -e "${BLUE}── 修改确认 ──────────────────────${NC}"
    echo "  模型 ID:   $name"
    echo "  API Key:   ${api_key:0:8}...${api_key: -4}"
    echo "  Base URL:  $base_url"
    echo ""
    read -e -p "确认保存? (Y/n): " confirm
    if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
        echo "取消修改"
        return 1
    fi

    update_json_env "$model_config" "$name" "$api_key" "$base_url"
    # 更新描述
    MODEL_DESCS["$model"]="$name"

    echo ""
    echo -e "${GREEN}✅ 模型 '$model' 已更新${NC}"
}

# 删除指定模型
remove_model() {
    local model="$1"

    # 没指定模型，交互选择
    if [[ -z "$model" ]]; then
        echo ""
        echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║     删除模型配置                   ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
        echo ""
        if ! select_model "选择要删除的模型"; then
            return 1
        fi
        model="$SELECTED_MODEL"
    fi

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo -e "${RED}⚠️  模型 '$model' 不存在${NC}"
        return 1
    fi

    echo ""
    echo -e "${BLUE}── 删除确认 ──────────────────────${NC}"
    echo "  模型: $model"
    echo "  描述: ${MODEL_DESCS[$model]}"
    echo "  文件: $model_config"
    echo ""
    read -e -p "确定要删除吗? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "取消删除"
        return 1
    fi

    rm "$model_config"
    unset "MODELS[$model]"
    unset "MODEL_DESCS[$model]"
    echo ""
    echo -e "${GREEN}✅ 模型 '$model' 已删除${NC}"
}

# 同步模型配置（用当前 settings.json 更新 MCP/插件等，保留模型的 env）
sync_model() {
    local model="$1"

    if [[ ! -f "$USER_SETTINGS" ]]; then
        echo -e "${RED}⚠️  未找到当前配置文件: $USER_SETTINGS${NC}"
        echo "请先启动一次 Claude Code 生成配置文件"
        return 1
    fi

    # 没指定模型，交互选择
    if [[ -z "$model" ]]; then
        echo ""
        echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║     同步模型配置                   ║${NC}"
        echo -e "${BLUE}║     从当前 settings.json 同步      ║${NC}"
        echo -e "${BLUE}║     MCP/插件等到指定模型            ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
        echo ""
        if ! select_model "选择要同步的模型"; then
            return 1
        fi
        model="$SELECTED_MODEL"
    fi

    local model_config="$CONFIG_DIR/${model}.json"
    if [[ ! -f "$model_config" ]]; then
        echo -e "${RED}⚠️  模型 '$model' 不存在${NC}"
        return 1
    fi

    # 读取模型当前的 env 配置
    local cur_name=$(read_json_field "$model_config" "ANTHROPIC_MODEL")
    local cur_key=$(read_json_field "$model_config" "ANTHROPIC_AUTH_TOKEN")
    local cur_url=$(read_json_field "$model_config" "ANTHROPIC_BASE_URL")

    # 用当前 settings.json 覆盖，然后注入回模型的 env
    cp "$USER_SETTINGS" "$model_config"
    update_json_env "$model_config" "$cur_name" "$cur_key" "$cur_url"

    echo ""
    echo -e "${GREEN}✅ 模型 '$model' 已同步${NC}"
    echo "  MCP 服务器、插件等配置已从当前 settings.json 更新"
    echo "  模型的 API 信息已保留: $cur_name @ $cur_url"
}

# 重置所有配置
reset_models() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     重置所有模型配置               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
    echo ""
    echo "配置目录: $CONFIG_DIR"
    echo "即将删除: $CONFIG_DIR/*.json"
    echo ""
    read -e -p "确定要重置吗? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "取消重置"
        return 1
    fi

    local count=0
    count=$(find "$CONFIG_DIR" -maxdepth 1 -name "*.json" -type f -print 2>/dev/null | wc -l)
    if [[ $count -gt 0 ]]; then
        find "$CONFIG_DIR" -maxdepth 1 -name "*.json" -type f -exec rm {} \; 2>/dev/null
        echo "已删除 $count 个配置文件"
    else
        echo "没有需要删除的配置文件"
    fi

    echo ""
    echo -e "${GREEN}✅ 已删除 $count 个模型配置文件${NC}"
    echo ""
    echo "请使用 ${CMD_NAME} add 重新添加模型配置"
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

    echo ""
    echo -e "${GREEN}🚀 启动 Claude Code [${MODEL_DESCS[$model]}]...${NC}"
    echo ""

    # 使用 --settings 参数直接指定配置文件，避免多窗口冲突
    if [[ $selected -eq 1 ]]; then
        "$CLAUDE_BIN" --dangerously-skip-permissions --settings "$model_config" "$@"
    else
        "$CLAUDE_BIN" --settings "$model_config" "$@"
    fi
}

# ─── 帮助 ────────────────────────────────────────────────────

show_help() {
    echo "Claude Code 多模型启动器"
    echo ""
    echo "用法:"
    echo "  ${CMD_NAME}                    - 交互式选择模型启动"
    echo "  ${CMD_NAME} <模型名>           - 直接启动指定模型"
    echo "  ${CMD_NAME} ls, list           - 列出所有已配置模型"
    echo "  ${CMD_NAME} add                - 添加新模型配置"
    echo "  ${CMD_NAME} edit [模型名]      - 编辑模型配置（不传参交互选择）"
    echo "  ${CMD_NAME} remove [模型名]    - 删除模型配置（不传参交互选择）"
    echo "  ${CMD_NAME} sync [模型名]      - 同步当前 MCP/插件配置到模型"
    echo "  ${CMD_NAME} reset              - 重置所有配置"
    echo "  ${CMD_NAME} -h, --help         - 显示帮助"
    echo ""
    if [[ ${#MODELS[@]} -gt 0 ]]; then
        echo "已配置的模型:"
        for key in "${!MODELS[@]}"; do
            echo "  $key - ${MODEL_DESCS[$key]}"
        done
    else
        echo "${YELLOW}暂无已配置的模型，使用 ${CMD_NAME} add 添加${NC}"
    fi
}

# ─── 主逻辑 ──────────────────────────────────────────────────

main() {
    # 扫描模型配置
    scan_models "$CONFIG_DIR"

    # 无参数：显示帮助 + 进入交互菜单
    if [[ -z "$1" ]]; then
        show_help
        echo ""
        # 进入交互选择
        while true; do
            show_menu
            read -e -p "请选择模型 (输入编号或名称): " choice

            # 空输入直接跳过，避免 MODELS: bad array subscript
            if [[ -z "$choice" ]]; then
                echo -e "${RED}请输入选项${NC}"
                echo ""
                continue
            fi

            if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
                echo "再见!"
                exit 0
            fi

            if [[ "$choice" =~ ^[0-9]+$ ]]; then
                eval "selected=\$MODEL_$choice"
                if [[ -n "$selected" && -n "${MODELS[$selected]}" ]]; then
                    launch_claude "$selected"
                    exit $?
                else
                    echo -e "${RED}无效选择${NC}"
                fi
            elif [[ -n "${MODELS[$choice]}" ]]; then
                launch_claude "$choice"
                exit $?
            else
                echo -e "${RED}未知选项: $choice${NC}"
            fi

            echo ""
            read -p "按回车继续..."
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
                echo -e "${RED}未知命令或模型: $model${NC}"
                echo ""
                show_help
                exit 1
            fi
            ;;
    esac
}

main "$@"
