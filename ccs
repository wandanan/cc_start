#!/bin/bash

# Claude Code 多模型启动器
# 用法: cc/ccs [模型名] 或直接输入 cc/ccs 进行交互选择

set -e

# 检测调用命令名（cc 或 ccs）
CMD_NAME=$(basename "$0")
[[ "$CMD_NAME" == "cc" ]] || CMD_NAME="ccs"

# 检测用户主目录（Windows 下 Git Bash 的 $HOME 可能是错的，优先用环境变量）
if [[ -n "$USERPROFILE" ]]; then
    # Windows: 转换 Windows 路径为 Unix 路径
    HOME_DIR="$(cygpath "$USERPROFILE" 2>/dev/null || echo "$HOME")"
else
    HOME_DIR="$HOME"
fi

CONFIG_DIR="$HOME_DIR/.claude/models"
CLAUDE_BIN="$(which claude 2>/dev/null || echo "$HOME_DIR/.local/bin/claude")"
USER_SETTINGS="$HOME_DIR/.claude/settings.json"
TEMP_SETTINGS="$HOME_DIR/.claude/.cc-temp-settings.json"

# 自动扫描模型配置文件
scan_models() {
    local config_dir="$1"
    declare -gA MODELS
    declare -gA MODEL_DESCS

    for json_file in "$config_dir"/*.json; do
        [[ -f "$json_file" ]] || continue
        local name=$(basename "$json_file" .json)
        MODELS["$name"]="$name"
        # 从配置文件读取模型ID作为描述
        local model_id=$(sed -n 's/.*"ANTHROPIC_MODEL": "\([^"]*\)".*/\1/p' "$json_file" 2>/dev/null | head -1)
        MODEL_DESCS["$name"]="${model_id:-$name}"
    done
}

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 显示菜单
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

# 准备配置文件
prepare_config() {
    local model="$1"
    local model_config="$CONFIG_DIR/${model}.json"

    if [[ ! -f "$model_config" ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  配置文件不存在: $model_config${NC}"
        return 1
    fi

    # 备份原始配置（如果不存在备份）
    if [[ -f "$USER_SETTINGS" && ! -f "$USER_SETTINGS.backup" ]]; then
        cp "$USER_SETTINGS" "$USER_SETTINGS.backup"
    fi

    # 使用临时文件，避免多窗口冲突
    cp "$model_config" "$USER_SETTINGS"

    return 0
}

# 添加新模型
add_model() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     添加新模型配置                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
    echo ""
    echo "说明:"
    echo "  • 启动命令名称: 用于输入 ${CMD_NAME} <名称> 启动模型"
    echo "  • Claude Code 界面显示使用的模型名: 如 kimi-k2.5"
    echo ""

    read -p "启动命令名称 (如 kimi，则使用 ${CMD_NAME} kimi 启动): " alias
    if [[ -z "$alias" ]]; then
        echo "别名不能为空"
        return 1
    fi

    # 检查是否已存在
    if [[ -f "$CONFIG_DIR/${alias}.json" ]]; then
        echo -e "${YELLOW}⚠️  模型 '$alias' 已存在${NC}"
        read -p "是否覆盖? (y/N): " confirm
        [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
    fi

    read -p "Claude Code 使用的模型名ID (如 kimi-k2.5): " name
    [[ -z "$name" ]] && name="$alias"

    read -p "API Key: " api_key
    if [[ -z "$api_key" ]]; then
        echo "API Key 不能为空"
        return 1
    fi

    read -p "Base URL (如 https://api.kimi.com/coding/): " base_url
    if [[ -z "$base_url" ]]; then
        echo "Base URL 不能为空"
        return 1
    fi

    # 创建配置文件 - 使用用户输入的名称作为模型ID
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

    echo ""
    echo -e "${GREEN}✅ 模型 '$name' 添加成功!${NC}"
    echo "配置文件: $CONFIG_DIR/${alias}.json"
    echo ""
    echo "使用方法:"
    echo "  ${CMD_NAME} $alias        # 直接启动"
    echo "  ${CMD_NAME}               # 从菜单选择"
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
    local options=("dangerously-skip-permissions 启动" "普通启动")
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
    if [[ $selected -eq 0 ]]; then
        "$CLAUDE_BIN" --dangerously-skip-permissions --settings "$model_config" "$@"
    else
        "$CLAUDE_BIN" --settings "$model_config" "$@"
    fi
}

# 删除指定模型
remove_model() {
    local model="$1"

    if [[ -z "$model" ]]; then
        echo ""
        echo "用法: ${CMD_NAME} remove <模型名>"
        echo ""
        echo "支持的模型:"
        for key in "${!MODELS[@]}"; do
            echo "  $key - ${MODEL_DESCS[$key]}"
        done
        return 1
    fi

    local model_config="$CONFIG_DIR/${model}.json"

    if [[ ! -f "$model_config" ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  模型 '$model' 不存在${NC}"
        return 1
    fi

    echo ""
    echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     删除模型配置                   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
    echo ""
    echo "模型: $model"
    echo "配置: $model_config"
    echo ""
    read -p "确定要删除吗? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "取消删除"
        return 1
    fi

    rm "$model_config"
    echo ""
    echo -e "${GREEN}✅ 模型 '$model' 已删除${NC}"
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
    read -p "确定要重置吗? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "取消重置"
        return 1
    fi

    # 删除所有 json 配置文件
    local count=0
    # 使用 find -exec 直接删除，避免 glob 问题
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

# 主逻辑
main() {
    # 扫描模型配置
    scan_models "$CONFIG_DIR"

    # 处理 add 命令
    if [[ "$1" == "add" ]]; then
        add_model
        exit $?
    fi

    # 处理 reset 命令
    if [[ "$1" == "reset" ]]; then
        reset_models
        exit $?
    fi

    # 处理 remove 命令
    if [[ "$1" == "remove" || "$1" == "rm" ]]; then
        remove_model "$2"
        exit $?
    fi

    # 显示帮助
    if [[ -z "$1" || "$1" == "-h" || "$1" == "--help" || "$1" == "help" ]]; then
        echo "Claude Code 多模型启动器"
        echo ""
        echo "用法:"
        echo "  ${CMD_NAME}              - 交互式选择模型"
        echo "  ${CMD_NAME} <模型名>     - 直接启动指定模型"
        echo "  ${CMD_NAME} add          - 添加新模型配置"
        echo "  ${CMD_NAME} remove <模型> - 删除指定模型配置"
        echo "  ${CMD_NAME} reset        - 重置所有配置"
        echo "  ${CMD_NAME} -h, --help   - 显示帮助"
        echo ""
        echo "支持的模型:"
        for key in "${!MODELS[@]}"; do
            echo "  $key - ${MODEL_DESCS[$key]}"
        done

        # 如果是直接请求帮助，退出；如果是无参数，继续显示菜单
        if [[ -n "$1" ]]; then
            exit 0
        fi
        echo ""
    fi

    # 如果直接指定了模型名
    if [[ -n "$1" && "$1" != "-h" && "$1" != "--help" && "$1" != "help" ]]; then
        local model="$1"
        shift
        if [[ -n "${MODELS[$model]}" ]]; then
            launch_claude "$model" "$@"
            exit $?
        else
            echo "未知模型: $model"
            echo -n "支持的模型: "
            printf "%s " "${!MODELS[@]}"
            echo ""
            exit 1
        fi
    fi

    # 交互式选择
    while true; do
        show_menu
        read -p "请选择模型 (输入编号或名称): " choice

        # 处理退出
        if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
            echo "再见!"
            exit 0
        fi

        # 处理数字选择
        if [[ "$choice" =~ ^[0-9]+$ ]]; then
            eval "selected=\$MODEL_$choice"
            if [[ -n "$selected" && -n "${MODELS[$selected]}" ]]; then
                launch_claude "$selected"
                exit $?
            else
                echo "无效选择"
            fi
        # 处理直接输入模型名
        elif [[ -n "${MODELS[$choice]}" ]]; then
            launch_claude "$choice"
            exit $?
        else
            echo "未知选项: $choice"
        fi

        echo ""
        read -p "按回车继续..."
    done
}

main "$@"
