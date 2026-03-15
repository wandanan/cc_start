#!/bin/bash

# Claude Code 多模型启动器
# 用法: cc [模型名] 或直接输入 cc 进行交互选择

set -e

CONFIG_DIR="/c/Users/10030/.claude/models"
CLAUDE_BIN="/c/users/10030/.local/bin/claude"
USER_SETTINGS="/c/Users/10030/.claude/settings.json"
TEMP_SETTINGS="/c/Users/10030/.claude/.cc-temp-settings.json"

# 定义支持的模型
declare -A MODELS
declare -A MODEL_DESCS

MODELS["kimi"]="kimi"
MODELS["qwen"]="qwen"
MODELS["glm"]="glm"
MODELS["mini"]="mini"

MODEL_DESCS["kimi"]="Kimi K2.5"
MODEL_DESCS["qwen"]="千问 3.5 Plus"
MODEL_DESCS["glm"]="GLM 5"
MODEL_DESCS["mini"]="MiniMax M2.5"

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
    for key in kimi qwen glm mini; do
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
    # 显示帮助
    if [[ -z "$1" || "$1" == "-h" || "$1" == "--help" || "$1" == "help" ]]; then
        echo "Claude Code 多模型启动器"
        echo ""
        echo "用法:"
        echo "  cc              - 交互式选择模型"
        echo "  cc <模型名>     - 直接启动指定模型"
        echo "  cc -h, --help   - 显示帮助"
        echo ""
        echo "支持的模型:"
        for key in kimi qwen glm mini; do
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
            echo "支持的模型: kimi qwen glm mini"
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
            case "$choice" in
                1) launch_claude "kimi"; exit $? ;;
                2) launch_claude "qwen"; exit $? ;;
                3) launch_claude "glm"; exit $? ;;
                4) launch_claude "mini"; exit $? ;;
                *) echo "无效选择" ;;
            esac
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
