#!/bin/bash

# Claude Code 多模型启动器
# 用法: cc [模型名] 或直接输入 cc 进行交互选择

set -e

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

    # 备份原始配置
    if [[ -f "$USER_SETTINGS" && ! -f "$USER_SETTINGS.backup" ]]; then
        cp "$USER_SETTINGS" "$USER_SETTINGS.backup"
        echo "已备份原配置到: $USER_SETTINGS.backup"
    fi

    # 使用选定模型的配置
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
    echo "  • 启动命令名称: 用于输入 cc <名称> 启动模型"
    echo "  • Claude Code 界面显示使用的模型名: 如 kimi-k2.5"
    echo ""

    read -p "启动命令名称 (如 kimi, 输入 cc kimi 启动): " alias
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

    read -p "Claude Code 界面显示使用的模型名 (如 DeepSeek V3): " name
    [[ -z "$name" ]] && name="$alias"

    read -p "API Key: " api_key
    if [[ -z "$api_key" ]]; then
        echo "API Key 不能为空"
        return 1
    fi

    read -p "Base URL (如 https://api.openai.com/v1): " base_url
    if [[ -z "$base_url" ]]; then
        echo "Base URL 不能为空"
        return 1
    fi

    # 创建配置文件
    local model_id="$alias"
    cat > "$CONFIG_DIR/${alias}.json" << EOF
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "$api_key",
    "ANTHROPIC_BASE_URL": "$base_url",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$model_id",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "$model_id",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "$model_id",
    "ANTHROPIC_MODEL": "$model_id"
  },
  "includeCoAuthoredBy": false
}
EOF

    echo ""
    echo -e "${GREEN}✅ 模型 '$name' 添加成功!${NC}"
    echo "配置文件: $CONFIG_DIR/${alias}.json"
    echo ""
    echo "使用方法:"
    echo "  cc $alias        # 直接启动"
    echo "  cc               # 从菜单选择"
}

# 启动 Claude
launch_claude() {
    local model="$1"
    shift

    if ! prepare_config "$model"; then
        exit 1
    fi

    echo ""
    echo -e "${GREEN}🚀 启动 Claude Code [${MODEL_DESCS[$model]}]...${NC}"
    echo ""

    # 启动 claude
    "$CLAUDE_BIN" "$@"
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

    # 显示帮助
    if [[ -z "$1" || "$1" == "-h" || "$1" == "--help" || "$1" == "help" ]]; then
        echo "Claude Code 多模型启动器"
        echo ""
        echo "用法:"
        echo "  cc              - 交互式选择模型"
        echo "  cc <模型名>     - 直接启动指定模型"
        echo "  cc add          - 添加新模型配置"
        echo "  cc -h, --help   - 显示帮助"
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
