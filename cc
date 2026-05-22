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
        # 1) PATH 中查找
        if which claude.exe &>/dev/null; then
            which claude.exe
            return
        elif which claude &>/dev/null; then
            which claude
            return
        fi
        # 2) npm 全局目录直接查找（绕过 PATH 缺失问题）
        local npm_bin=""
        npm_bin="$(npm prefix -g 2>/dev/null)/bin"
        if [[ -n "$npm_bin" && -d "$npm_bin" ]]; then
            if [[ -f "$npm_bin/claude" ]]; then
                echo "$npm_bin/claude"
                return
            elif [[ -f "$npm_bin/claude.cmd" ]]; then
                echo "$npm_bin/claude.cmd"
                return
            fi
        fi
        # 3) 兜底：npx -y 免交互安装
        if command -v npx &>/dev/null; then
            echo "npx -y @anthropic-ai/claude-code"
        else
            echo "$HOME_DIR/.local/bin/claude.exe"
        fi
    else
        # 1) PATH 中查找
        local claude_path
        claude_path="$(which claude 2>/dev/null)"
        if [[ -n "$claude_path" ]]; then
            echo "$claude_path"
            return
        fi
        # 2) npm 全局目录直接查找（绕过 nvm 不在 PATH 的问题）
        local npm_bin=""
        npm_bin="$(npm prefix -g 2>/dev/null)/bin"
        if [[ -n "$npm_bin" && -d "$npm_bin" ]]; then
            if [[ -f "$npm_bin/claude" ]]; then
                echo "$npm_bin/claude"
                return
            fi
        fi
        # 3) 直接扫描 nvm 安装目录（nvm 路径固定，不受 shell 环境影响）
        local nvm_dir="${NVM_DIR:-$HOME_DIR/.nvm}"
        if [[ -d "$nvm_dir/versions/node" ]]; then
            for dir in "$nvm_dir/versions/node"/*/bin; do
                if [[ -f "$dir/claude" ]]; then
                    echo "$dir/claude"
                    return
                fi
            done
        fi
        # 4) 兜底：npx -y 免交互安装
        if command -v npx &>/dev/null; then
            echo "npx -y @anthropic-ai/claude-code"
        else
            echo "$HOME_DIR/.local/bin/claude"
        fi
    fi
}

CLAUDE_BIN="$(find_claude_bin)"

# ─── DeepSeek 特殊配置支持 ─────────────────────────────────────

# 已知的环境变量列表（空格分隔，方便遍历）
ENV_VAR_NAMES="ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL ANTHROPIC_MODEL ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL CLAUDE_CODE_SUBAGENT_MODEL CLAUDE_CODE_EFFORT_LEVEL CLAUDE_CODE_AUTO_COMPACT_WINDOW"

# 检测是否为 DeepSeek API 端点
is_deepseek_api() {
    local url="$1"
    [[ "$url" == *"deepseek"* ]]
}

# 给模型名加 [1m] 后缀（如果还没有上下文窗口后缀的话）
ensure_1m_suffix() {
    local model="$1"
    if [[ "$model" =~ \[1[mM]\] ]] || [[ "$model" =~ \[[0-9]+[kKmM]\] ]]; then
        echo "$model"
    else
        echo "${model}[1m]"
    fi
}

# 在 JSON 文件中设置单个字段（存在则替换，不存在则插入）
set_json_field() {
    local json_file="$1"
    local key="$2"
    local val="$3"
    local tmpfile="${json_file}.tmp"

    if grep -q "\"$key\":" "$json_file" 2>/dev/null; then
        sed -i "s#\"$key\": \"[^\"]*\"#\"$key\": \"${val}\"#g" "$json_file" 2>/dev/null || true
    else
        awk -v k="$key" -v v="$val" '
            { lines[NR] = $0 }
            END {
                # 找到最后 } 之前最后一个非空行
                prev_idx = 0
                for (j = NR - 1; j >= 1; j--) {
                    if (lines[j] !~ /^[[:space:]]*$/) {
                        prev_idx = j
                        break
                    }
                }
                for (i = 1; i <= NR; i++) {
                    if (i == NR && lines[i] ~ /^[[:space:]]*}/) {
                        print "  \"" k "\": \"" v "\""
                    }
                    # 在最后 } 的前一个非空行末尾补逗号（如果还没有逗号且不是 {）
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
    fi
}

# 在 JSON 文件中设置布尔字段（存在则替换，不存在则插入）
set_json_bool_field() {
    local json_file="$1"
    local key="$2"
    local val="$3"
    local tmpfile="${json_file}.tmp"

    if grep -q "\"$key\":" "$json_file" 2>/dev/null; then
        sed -i "s#\"$key\": [^,}]*#\"$key\": ${val}#g" "$json_file" 2>/dev/null || true
    else
        awk -v k="$key" -v v="$val" '
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
                        print "  \"" k "\": " v
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
    fi
}

# 写入 DeepSeek 特有的默认环境变量到配置文件（仅填充缺失字段，不覆盖已有值）
write_deepseek_defaults() {
    local json_file="$1"
    local pro_model="$2"                     # 主模型名
    local subagent_model="${3:-$pro_model}"   # Haiku/子代理模型，默认用主模型

    for pair in "ANTHROPIC_DEFAULT_OPUS_MODEL:${pro_model}" \
                "ANTHROPIC_DEFAULT_SONNET_MODEL:${pro_model}" \
                "ANTHROPIC_DEFAULT_HAIKU_MODEL:${subagent_model}" \
                "CLAUDE_CODE_SUBAGENT_MODEL:${subagent_model}" \
                "CLAUDE_CODE_EFFORT_LEVEL:max" \
                "CLAUDE_CODE_AUTO_COMPACT_WINDOW:400000"; do
        local key="${pair%%:*}"
        local val="${pair#*:}"
        if ! grep -q "\"$key\":" "$json_file" 2>/dev/null; then
            set_json_field "$json_file" "$key" "$val"
        fi
    done
}

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
    echo '  _____  _____         _____  _______   ___      _____  _______ '
    echo '  / ____|/ ____|       / ____||__   __| /   \    |  __ \|__   __|'
    echo ' | |    | |           | (___     | |   /  ^  \   | |__) |  | |   '
    echo ' | |    | |            \___ \    | |  /  /_\  \  |  _  /   | |   '
    echo ' | |____| |____        ____) |   | | /  _____  \ | | \ \   | |   '
    echo '  \_____|\_____|      |_____/    |_|/__/     \__\|_|  \_\  |_|   '
    echo '                                    |__|     |__|                '
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

    # 先尝试替换已存在的核心字段（HAIKU 由子代理独立控制，不在此覆盖）
    sed -i         -e "s#\"ANTHROPIC_AUTH_TOKEN\": \"[^\"]*\"#\"ANTHROPIC_AUTH_TOKEN\": \"${api_key}\"#g"         -e "s#\"ANTHROPIC_BASE_URL\": \"[^\"]*\"#\"ANTHROPIC_BASE_URL\": \"${base_url}\"#g"         -e "s#\"ANTHROPIC_MODEL\": \"[^\"]*\"#\"ANTHROPIC_MODEL\": \"${model_name}\"#g"         -e "s#\"ANTHROPIC_DEFAULT_OPUS_MODEL\": \"[^\"]*\"#\"ANTHROPIC_DEFAULT_OPUS_MODEL\": \"${model_name}\"#g"         -e "s#\"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"[^\"]*\"#\"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"${model_name}\"#g"         "$json_file" 2>/dev/null || true

    # 对于不存在的字段，在最后一个 } 前插入（使用 awk，Git Bash 自带）
    for pair in "ANTHROPIC_AUTH_TOKEN:${api_key}" "ANTHROPIC_BASE_URL:${base_url}" "ANTHROPIC_MODEL:${model_name}"; do
        local key="${pair%%:*}"
        local val="${pair#*:}"
        if ! grep -q "\"$key\":" "$json_file" 2>/dev/null; then
            awk -v k="$key" -v v="$val" '''
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
                            print "  \"" k "\": \"" v "\""
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

# 创建合并的 settings 临时文件：全局 settings.json 非 env 部分 + per-model 的 API 凭证
# 返回临时文件路径，调用方负责清理
create_merged_settings() {
    local model_config="$1"
    local tmpfile
    tmpfile=$(mktemp "${TMPDIR:-/tmp}/cc-settings-XXXXXX.json" 2>/dev/null || mktemp)

    if [[ -f "$USER_SETTINGS" ]]; then
        local api_key base_url model_id opus_model sonnet_model haiku_model subagent_model effort_level compact_window
        api_key=$(read_json_field "$model_config" "ANTHROPIC_AUTH_TOKEN")
        base_url=$(read_json_field "$model_config" "ANTHROPIC_BASE_URL")
        model_id=$(read_json_field "$model_config" "ANTHROPIC_MODEL")
        opus_model=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_OPUS_MODEL")
        sonnet_model=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_SONNET_MODEL")
        haiku_model=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_HAIKU_MODEL")
        subagent_model=$(read_json_field "$model_config" "CLAUDE_CODE_SUBAGENT_MODEL")
        effort_level=$(read_json_field "$model_config" "CLAUDE_CODE_EFFORT_LEVEL")
        compact_window=$(read_json_field "$model_config" "CLAUDE_CODE_AUTO_COMPACT_WINDOW")

        if [[ -z "$model_id" ]]; then
            model_id=$(read_json_field "$model_config" "model")
        fi

        # 用模型 ID 填充默认模型映射（如果未单独设置）
        [[ -z "$opus_model" ]] && opus_model="$model_id"
        [[ -z "$sonnet_model" ]] && sonnet_model="$model_id"
        [[ -z "$haiku_model" ]] && haiku_model="$model_id"

        awk -v ak="$api_key" -v bu="$base_url" -v mid="$model_id" \
            -v opus="$opus_model" -v sonnet="$sonnet_model" -v haiku="$haiku_model" \
            -v subagent="$subagent_model" -v effort="$effort_level" -v compact="$compact_window" '
        BEGIN { in_env = 0; env_depth = 0; printed_env = 0 }
        {
            # 检测 env 对象的开始
            if ($0 ~ /"[[:space:]]*env[[:space:]]*"[[:space:]]*:[[:space:]]*\{/) {
                in_env = 1
                env_depth = 1
                # 打印新的 env 块（用选中模型的凭证覆盖，条件输出扩展字段）
                print "  \"env\": {"
                printf "    \"ANTHROPIC_AUTH_TOKEN\": \"%s\"", ak
                printf ",\n    \"ANTHROPIC_BASE_URL\": \"%s\"", bu
                printf ",\n    \"ANTHROPIC_MODEL\": \"%s\"", mid
                printf ",\n    \"ANTHROPIC_DEFAULT_HAIKU_MODEL\": \"%s\"", haiku
                printf ",\n    \"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"%s\"", sonnet
                printf ",\n    \"ANTHROPIC_DEFAULT_OPUS_MODEL\": \"%s\"", opus
                if (subagent != "") printf ",\n    \"CLAUDE_CODE_SUBAGENT_MODEL\": \"%s\"", subagent
                if (effort != "") printf ",\n    \"CLAUDE_CODE_EFFORT_LEVEL\": \"%s\"", effort
                if (compact != "") printf ",\n    \"CLAUDE_CODE_AUTO_COMPACT_WINDOW\": \"%s\"", compact
                print ""
                printed_env = 1
                next
            }
            # 在 env 块内，计算嵌套深度
            if (in_env) {
                line_copy = $0
                gsub(/[^{]/, "", $0); env_depth += length($0)
                gsub(/[^}]/, "", line_copy); env_depth -= length(line_copy)
                if (env_depth <= 0) {
                    in_env = 0
                    # 打印新 env 块的闭合括号，替代原 env 块
                    if (printed_env) {
                        printed_env = 0
                        print "  },"
                        next
                    }
                }
                next
            }
            # 非 env 部分，原样输出
            print
        }
        ' "$USER_SETTINGS" > "$tmpfile"

        # 如果全局 settings.json 没有 env 块，在最后一个 } 前插入
        if ! grep -q '"env"' "$tmpfile" 2>/dev/null; then
            awk -v ak="$api_key" -v bu="$base_url" -v mid="$model_id" \
                -v opus="$opus_model" -v sonnet="$sonnet_model" -v haiku="$haiku_model" \
                -v subagent="$subagent_model" -v effort="$effort_level" -v compact="$compact_window" '
                { lines[NR] = $0 }
                END {
                    # 找到最后 } 之前最后一个非空行，用于判断是否需要添加逗号
                    prev_idx = 0
                    for (j = NR - 1; j >= 1; j--) {
                        if (lines[j] !~ /^[[:space:]]*$/) {
                            prev_idx = j
                            break
                        }
                    }
                    for (i = 1; i <= NR; i++) {
                        if (i == NR && lines[i] ~ /^[[:space:]]*}/) {
                            print "  \"env\": {"
                            printf "    \"ANTHROPIC_AUTH_TOKEN\": \"%s\"", ak
                            printf ",\n    \"ANTHROPIC_BASE_URL\": \"%s\"", bu
                            printf ",\n    \"ANTHROPIC_MODEL\": \"%s\"", mid
                            printf ",\n    \"ANTHROPIC_DEFAULT_HAIKU_MODEL\": \"%s\"", haiku
                            printf ",\n    \"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"%s\"", sonnet
                            printf ",\n    \"ANTHROPIC_DEFAULT_OPUS_MODEL\": \"%s\"", opus
                            if (subagent != "") printf ",\n    \"CLAUDE_CODE_SUBAGENT_MODEL\": \"%s\"", subagent
                            if (effort != "") printf ",\n    \"CLAUDE_CODE_EFFORT_LEVEL\": \"%s\"", effort
                            if (compact != "") printf ",\n    \"CLAUDE_CODE_AUTO_COMPACT_WINDOW\": \"%s\"", compact
                            print ""
                            print "  }"
                        }
                        # 在最后 } 的前一个非空行末尾补逗号（如果还没有逗号且不是 {）
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
            ' "$tmpfile" > "${tmpfile}.bak" && mv "${tmpfile}.bak" "$tmpfile"
        fi
    else
        # 没有全局 settings.json，直接用 per-model 配置
        cp "$model_config" "$tmpfile"
    fi

    # 从模型配置注入 skipWebFetchPreflight（WebFetch 域名安全验证，解决企业防火墙阻断问题）
    if grep -q '"skipWebFetchPreflight": *true' "$model_config" 2>/dev/null; then
        set_json_bool_field "$tmpfile" "skipWebFetchPreflight" "true"
    fi

    echo "$tmpfile"
}

# 全局关联数组（需要 bash 4.0+，macOS 用户请通过 homebrew 安装：brew install bash）
declare -A MODELS
declare -A MODEL_DESCS

# 迁移旧版 DeepSeek 配置：检测并补齐缺失的扩展字段
# 返回 0 表示有变更，1 表示无需变更
migrate_deepseek_config() {
    local json_file="$1"
    local base_url model_id

    base_url=$(read_json_field "$json_file" "ANTHROPIC_BASE_URL")
    model_id=$(read_json_field "$json_file" "ANTHROPIC_MODEL")

    # 非 DeepSeek API 或没有必要字段，跳过
    if ! is_deepseek_api "$base_url" || [[ -z "$model_id" ]]; then
        return 1
    fi

    local changed=false

    # 确保模型 ID 带 [1m] 后缀
    local fixed_model
    fixed_model=$(ensure_1m_suffix "$model_id")
    if [[ "$fixed_model" != "$model_id" ]]; then
        set_json_field "$json_file" "ANTHROPIC_MODEL" "$fixed_model"
        changed=true
    fi

    # 补齐缺失的扩展字段
    local need_defaults=false
    for field in ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL CLAUDE_CODE_SUBAGENT_MODEL CLAUDE_CODE_EFFORT_LEVEL CLAUDE_CODE_AUTO_COMPACT_WINDOW; do
        local val
        val=$(read_json_field "$json_file" "$field")
        if [[ -z "$val" ]]; then
            need_defaults=true
            break
        fi
    done

    if $need_defaults; then
        write_deepseek_defaults "$json_file" "$fixed_model"
        changed=true
    fi

    if $changed; then
        return 0
    fi
    return 1
}

# 自动扫描模型配置文件
scan_models() {
    local config_dir="$1"
    local migrated=0

    for json_file in "$config_dir"/*.json; do
        [[ -f "$json_file" ]] || continue
        local name=$(basename "$json_file" .json)
        MODELS["$name"]="$name"

        # 静默迁移旧版 DeepSeek 配置
        if migrate_deepseek_config "$json_file"; then
            migrated=$((migrated + 1))
        fi

        local model_id=$(sed -n 's/.*"ANTHROPIC_MODEL": "\([^"]*\)".*/\1/p' "$json_file" 2>/dev/null | head -1)
        MODEL_DESCS["$name"]="${model_id:-$name}"
    done

    # 有迁移时输出提示
    if [[ $migrated -gt 0 ]]; then
        echo -e "  ${CYA}🔍 已自动升级 ${migrated} 个 DeepSeek 模型配置 (补齐 1M 上下文等扩展字段)${NC}"
        echo ""
    fi
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
    echo -e "  ${YELLOW}q)${NC}  退出        ${YELLOW}e)${NC}  编辑模型配置"
    echo -e "  ${YELLOW}a)${NC}  添加新模型  ${YELLOW}r)${NC}  删除模型"
    echo -e "  ${YELLOW}u)${NC}  升级 Claude  ${YELLOW}h)${NC}  查看帮助"
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

        # DeepSeek 自动检测：自动加 [1m] 后缀
        local is_ds=false
        if is_deepseek_api "$base_url"; then
            is_ds=true
            name="$(ensure_1m_suffix "$name")"
            echo ""
            echo -e "  ${CYA}🔍 检测到 DeepSeek API，已自动配置 1M 上下文窗口${NC}"
            echo -e "  ${DIM}  主模型 ID 已更新: ${name}${NC}"
        fi

        # 子代理 / Haiku 模型配置（所有模型通用）
        echo ""
        echo -e "  ${BOLD}第 5 步 / 4${NC}  ${DIM}─  设置 Haiku/子代理模型${NC}"
        echo -e "  ${DIM}  子代理使用主模型的 API 端点，只能配置同厂商的模型${NC}"
        read -e -p "    子代理模型名 [${name}]: " subagent_model
        [[ -z "$subagent_model" ]] && subagent_model="$name"

        # Effort / Compact 配置（所有模型通用，直接回车使用默认值）
        local effort_level=""
        local compact_window=""
        echo ""
        echo -e "  ${BOLD}扩展配置${NC}  ${DIM}(直接回车使用默认值)${NC}"
        echo -e "  ${DIM}Effort Level 控制推理深度（非推理模型可能不生效）${NC}"
        echo -e "  ${DIM}Compact Window 控制自动压缩行为（非百万上下文模型可能不生效）${NC}"
        read -e -p "    Effort Level [max]: " effort_level
        [[ -z "$effort_level" ]] && effort_level="max"
        read -e -p "    自动压缩窗口上限 [400000]: " compact_window
        [[ -z "$compact_window" ]] && compact_window="400000"

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
        echo -e "  子代理模型: ${subagent_model}"
        if [[ "$subagent_model" == "$name" ]]; then
            echo -e "  ${DIM}            (与主模型相同)${NC}"
        fi
        echo -e "  ${CYA}Effort Level:    ${effort_level}${NC}"
        echo -e "  ${CYA}Compact Window:  ${compact_window}${NC}"
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
            # 写入模型角色映射（所有模型通用）
            set_json_field "$CONFIG_DIR/${alias}.json" "ANTHROPIC_DEFAULT_OPUS_MODEL" "$name"
            set_json_field "$CONFIG_DIR/${alias}.json" "ANTHROPIC_DEFAULT_SONNET_MODEL" "$name"
            set_json_field "$CONFIG_DIR/${alias}.json" "ANTHROPIC_DEFAULT_HAIKU_MODEL" "$subagent_model"
            set_json_field "$CONFIG_DIR/${alias}.json" "CLAUDE_CODE_SUBAGENT_MODEL" "$subagent_model"
            set_json_field "$CONFIG_DIR/${alias}.json" "CLAUDE_CODE_EFFORT_LEVEL" "$effort_level"
            set_json_field "$CONFIG_DIR/${alias}.json" "CLAUDE_CODE_AUTO_COMPACT_WINDOW" "$compact_window"
            set_json_bool_field "$CONFIG_DIR/${alias}.json" "skipWebFetchPreflight" "true"
        else
            # 创建最小模板，然后用 set_json_field 追加其余字段
            cat > "$CONFIG_DIR/${alias}.json" << EOF
{
  "ANTHROPIC_AUTH_TOKEN": "$api_key",
  "ANTHROPIC_BASE_URL": "$base_url",
  "ANTHROPIC_MODEL": "$name"
}
EOF
            set_json_field "$CONFIG_DIR/${alias}.json" "ANTHROPIC_DEFAULT_OPUS_MODEL" "$name"
            set_json_field "$CONFIG_DIR/${alias}.json" "ANTHROPIC_DEFAULT_SONNET_MODEL" "$name"
            set_json_field "$CONFIG_DIR/${alias}.json" "ANTHROPIC_DEFAULT_HAIKU_MODEL" "$subagent_model"
            set_json_field "$CONFIG_DIR/${alias}.json" "CLAUDE_CODE_SUBAGENT_MODEL" "$subagent_model"
            set_json_field "$CONFIG_DIR/${alias}.json" "CLAUDE_CODE_EFFORT_LEVEL" "$effort_level"
            set_json_field "$CONFIG_DIR/${alias}.json" "CLAUDE_CODE_AUTO_COMPACT_WINDOW" "$compact_window"
            set_json_bool_field "$CONFIG_DIR/${alias}.json" "skipWebFetchPreflight" "true"
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
    local cur_opus=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_OPUS_MODEL")
    local cur_sonnet=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_SONNET_MODEL")
    local cur_haiku=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_HAIKU_MODEL")
    local cur_subagent=$(read_json_field "$model_config" "CLAUDE_CODE_SUBAGENT_MODEL")
    local cur_effort=$(read_json_field "$model_config" "CLAUDE_CODE_EFFORT_LEVEL")
    local cur_compact=$(read_json_field "$model_config" "CLAUDE_CODE_AUTO_COMPACT_WINDOW")

    local is_ds_edit=false
    if is_deepseek_api "$cur_url"; then
        is_ds_edit=true
    fi

    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     编辑模型: ${model}$(printf '%*s' $((24 - ${#model})) '')║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${DIM}直接回车保留当前值${NC}"
    echo ""

    read -e -p "  启动命令名称 [${model}]: " new_alias
    [[ -z "$new_alias" ]] && new_alias="$model"

    read -e -p "  模型 ID [${cur_name}]: " name
    [[ -z "$name" ]] && name="$cur_name"

    read -e -p "  API Key [${cur_key:0:8}...${cur_key: -4}]: " api_key
    [[ -z "$api_key" ]] && api_key="$cur_key"

    read -e -p "  Base URL [${cur_url}]: " base_url
    [[ -z "$base_url" ]] && base_url="$cur_url"

    # 检测 URL 变更后是否为 DeepSeek，自动处理 [1m] 后缀
    local is_ds_now=false
    local ds_pro_model=""
    if is_deepseek_api "$base_url"; then
        is_ds_now=true
        name="$(ensure_1m_suffix "$name")"
        ds_pro_model="$name"
    fi

    # 子代理 / Haiku 模型配置（所有模型通用）
    local subagent_model="$cur_subagent"
    echo ""
    echo -e "  ${BOLD}扩展配置${NC}  ${DIM}(直接回车保留当前值)${NC}"
    echo -e "  ${DIM}子代理使用主模型的 API 端点，只能配置同厂商的模型${NC}"
    read -e -p "    Haiku/子代理模型 [${cur_subagent:-$name}]: " subagent_model
    [[ -z "$subagent_model" ]] && subagent_model="${cur_subagent:-$name}"

    # 扩展字段（所有模型通用）
    echo -e "  ${DIM}Effort Level 控制推理深度（非推理模型可能不生效）${NC}"
    echo -e "  ${DIM}Compact Window 控制自动压缩行为（非百万上下文模型可能不生效）${NC}"
    local effort_level="$cur_effort"
    local compact_window="$cur_compact"
    read -e -p "    Effort Level [${cur_effort:-max}]: " effort_level
    [[ -z "$effort_level" ]] && effort_level="${cur_effort:-max}"
    read -e -p "    自动压缩窗口上限 [${cur_compact:-400000}]: " compact_window
    [[ -z "$compact_window" ]] && compact_window="${cur_compact:-400000}"
    [[ -z "$ds_pro_model" ]] && ds_pro_model="$name"

    echo ""
    echo -e "  ${BOLD}确认修改:${NC}"
    echo -e "    命令名称:  ${CMD_NAME} ${new_alias}"
    echo -e "    模型 ID:   ${name}"
    echo -e "    API Key:   ${api_key:0:8}${DIM}...${NC}${api_key: -4}"
    echo -e "    Base URL:  ${base_url}"
    echo -e "    子代理模型: ${subagent_model}"
    echo -e "    ${CYA}Effort Level:    ${effort_level}${NC}"
    echo -e "    ${CYA}Compact Window:  ${compact_window}${NC}"
    echo ""
    read -e -p "  确认保存? (Y/n): " confirm
    if [[ "$confirm" == "n" || "$confirm" == "N" ]]; then
        echo "  已取消"
        return 1
    fi

    # 如果命令名称变更，重命名配置文件
    if [[ "$new_alias" != "$model" ]]; then
        local new_config="$CONFIG_DIR/${new_alias}.json"
        if [[ -f "$new_config" ]]; then
            echo -e "${RED}  ✗ 命令名称 '${new_alias}' 已被占用${NC}"
            return 1
        fi
        mv "$model_config" "$new_config"
        model_config="$new_config"
        # 更新数组：删除旧 key，添加新 key
        unset "MODELS[$model]"
        unset "MODEL_DESCS[$model]"
        MODELS["$new_alias"]="$name"
        MODEL_DESCS["$new_alias"]="$name"
        model="$new_alias"
    fi

    update_json_env "$model_config" "$name" "$api_key" "$base_url"
    MODEL_DESCS["$model"]="$name"

    # 写入模型角色映射（所有模型通用）
    set_json_field "$model_config" "ANTHROPIC_DEFAULT_OPUS_MODEL" "$name"
    set_json_field "$model_config" "ANTHROPIC_DEFAULT_SONNET_MODEL" "$name"
    set_json_field "$model_config" "ANTHROPIC_DEFAULT_HAIKU_MODEL" "$subagent_model"
    set_json_field "$model_config" "CLAUDE_CODE_SUBAGENT_MODEL" "$subagent_model"
    [[ -n "$effort_level" ]] && set_json_field "$model_config" "CLAUDE_CODE_EFFORT_LEVEL" "$effort_level"
    [[ -n "$compact_window" ]] && set_json_field "$model_config" "CLAUDE_CODE_AUTO_COMPACT_WINDOW" "$compact_window"

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

    # 保存 DeepSeek 扩展字段（如果存在）
    local cur_subagent cur_effort cur_compact cur_opus cur_sonnet cur_haiku
    cur_subagent=$(read_json_field "$model_config" "CLAUDE_CODE_SUBAGENT_MODEL")
    cur_effort=$(read_json_field "$model_config" "CLAUDE_CODE_EFFORT_LEVEL")
    cur_compact=$(read_json_field "$model_config" "CLAUDE_CODE_AUTO_COMPACT_WINDOW")
    cur_opus=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_OPUS_MODEL")
    cur_sonnet=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_SONNET_MODEL")
    cur_haiku=$(read_json_field "$model_config" "ANTHROPIC_DEFAULT_HAIKU_MODEL")

    cp "$USER_SETTINGS" "$model_config"
    update_json_env "$model_config" "$cur_name" "$cur_key" "$cur_url"

    # 恢复 DeepSeek 扩展字段
    if is_deepseek_api "$cur_url"; then
        [[ -n "$cur_opus" ]] && set_json_field "$model_config" "ANTHROPIC_DEFAULT_OPUS_MODEL" "$cur_opus"
        [[ -n "$cur_sonnet" ]] && set_json_field "$model_config" "ANTHROPIC_DEFAULT_SONNET_MODEL" "$cur_sonnet"
        [[ -n "$cur_haiku" ]] && set_json_field "$model_config" "ANTHROPIC_DEFAULT_HAIKU_MODEL" "$cur_haiku"
        [[ -n "$cur_subagent" ]] && set_json_field "$model_config" "CLAUDE_CODE_SUBAGENT_MODEL" "$cur_subagent"
        [[ -n "$cur_effort" ]] && set_json_field "$model_config" "CLAUDE_CODE_EFFORT_LEVEL" "$cur_effort"
        [[ -n "$cur_compact" ]] && set_json_field "$model_config" "CLAUDE_CODE_AUTO_COMPACT_WINDOW" "$cur_compact"
    fi

    echo ""
    echo -e "  ${GREEN}✓ 模型 '${model}' 已同步${NC}"
    echo -e "  ${DIM}MCP / 插件配置已更新，API 信息已保留${NC}"
    echo -e "  ${DIM}${cur_name} @ ${cur_url}${NC}"
}

# 升级所有旧版 DeepSeek 配置（补齐扩展字段）
upgrade_models() {
    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     升级模型配置                  ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${DIM}扫描并补齐 DeepSeek 模型的扩展字段...${NC}"
    echo ""

    local upgraded=0 total=0
    for json_file in "$CONFIG_DIR"/*.json; do
        [[ -f "$json_file" ]] || continue
        total=$((total + 1))
        local name=$(basename "$json_file" .json)
        local base_url
        base_url=$(read_json_field "$json_file" "ANTHROPIC_BASE_URL")

        if is_deepseek_api "$base_url"; then
            local model_id
            model_id=$(read_json_field "$json_file" "ANTHROPIC_MODEL")
            local fixed_model=$(ensure_1m_suffix "$model_id")
            local fields_before=""
            local fields_after=""

            # 检查哪些字段有变化
            [[ "$fixed_model" != "$model_id" ]] && fields_before="${fields_before} [1m]后缀"
            [[ -z "$(read_json_field "$json_file" "CLAUDE_CODE_AUTO_COMPACT_WINDOW")" ]] && fields_before="${fields_before} AUTO_COMPACT_WINDOW"
            [[ -z "$(read_json_field "$json_file" "CLAUDE_CODE_EFFORT_LEVEL")" ]] && fields_before="${fields_before} EFFORT_LEVEL"
            [[ -z "$(read_json_field "$json_file" "CLAUDE_CODE_SUBAGENT_MODEL")" ]] && fields_before="${fields_before} SUBAGENT_MODEL"

            if [[ -n "$fields_before" ]]; then
                if [[ "$fixed_model" != "$model_id" ]]; then
                    set_json_field "$json_file" "ANTHROPIC_MODEL" "$fixed_model"
                fi
                write_deepseek_defaults "$json_file" "$fixed_model"
                upgraded=$((upgraded + 1))
                echo -e "  ${GREEN}✓${NC} ${name} → 已补齐:${fields_before}"
            else
                echo -e "  ${DIM}·${NC} ${name} → ${GREEN}已是最新${NC}"
            fi
        else
            echo -e "  ${DIM}·${NC} ${name} → 非 DeepSeek，跳过"
        fi
    done

    echo ""
    if [[ $upgraded -gt 0 ]]; then
        echo -e "  ${GREEN}✓ 已升级 ${upgraded} 个配置${NC}"
    else
        echo -e "  ${DIM}所有配置已是最新${NC}"
    fi
    echo ""
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
            elif [[ "$key" == "" || "$key" == $'\r' || "$key" == $'\n' ]]; then
                # 消耗缓冲区中可能残留的 \n（\r\n 场景）
                IFS= read -rsn1 -t 0.05 _drain <&3 2>/dev/null || true
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
            elif [[ "$key" == "" || "$key" == $'\r' || "$key" == $'\n' ]]; then
                # 消耗缓冲区中可能残留的 \n（\r\n 场景）
                IFS= read -rsn1 -t 0.05 _drain 2>/dev/null || true
                break
            fi
        done
    fi

    printf '\033[?25h'  # 恢复光标

    # 从配置文件中读取所有环境变量并逐一导出
    # 这才是 Claude Code 真正读取第三方 API 的方式
    for var_name in $ENV_VAR_NAMES; do
        local var_val
        var_val=$(sed -n "s/.*\"$var_name\": \"\\([^\"]*\\)\".*/\\1/p" "$model_config" 2>/dev/null | head -1)
        if [[ -n "$var_val" ]]; then
            export "${var_name}=${var_val}"
        fi
    done

    # 向后兼容：如果有顶层 model 字段且 ANTHROPIC_MODEL 未设置
    if [[ -z "${ANTHROPIC_MODEL:-}" ]]; then
        local model_id
        model_id=$(sed -n 's/.*"model": "\([^"]*\)".*/\1/p' "$model_config" 2>/dev/null | head -1)
        if [[ -n "$model_id" ]]; then
            export ANTHROPIC_MODEL="$model_id"
        fi
    fi

    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     启动 Claude Code              ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}▶${NC} 模型: ${BOLD}${MODEL_DESCS[$model]}${NC}"
    if [[ -n "${ANTHROPIC_MODEL:-}" ]]; then
        echo -e "  ${DIM}  ID: ${ANTHROPIC_MODEL}${NC}"
    fi
    if [[ -n "${ANTHROPIC_BASE_URL:-}" ]]; then
        echo -e "  ${DIM}  URL: ${ANTHROPIC_BASE_URL}${NC}"
    fi
    if [[ $selected -eq 1 ]]; then
        echo -e "  ${DIM}  模式: dangerously-skip-permissions${NC}"
    fi
    echo ""

    # 创建合并的 settings 临时文件（全局 settings 非 env 部分 + 本模型的 API 凭证）
    # 避免全局 settings.json 的 env 块（如 mimo 凭证）覆盖选中模型的配置
    local merged_settings
    merged_settings="$(create_merged_settings "$model_config")"
    trap 'rm -f "$merged_settings"' EXIT

    # 使用 --settings 参数指定合并后的配置文件
    # 将 CLAUDE_BIN 拆分为数组，支持 npx 等多词命令
    read -ra CLAUDE_CMD <<< "$CLAUDE_BIN"
    if [[ $selected -eq 1 ]]; then
        "${CLAUDE_CMD[@]}" --dangerously-skip-permissions --settings "$merged_settings" "$@"
    else
        "${CLAUDE_CMD[@]}" --settings "$merged_settings" "$@"
    fi
    rm -f "$merged_settings"
}

# ─── 升级 Claude Code ────────────────────────────────────────

upgrade_claude() {
    echo ""
    echo -e "${BLU}╔═══════════════════════════════════╗${NC}"
    echo -e "${BLU}║     升级 Claude Code              ║${NC}"
    echo -e "${BLU}╚═══════════════════════════════════╝${NC}"
    echo ""

    local cur_ver=""
    if command -v claude &>/dev/null; then
        cur_ver=$(claude --version 2>/dev/null) || true
    fi
    if [[ -n "$cur_ver" ]]; then
        echo -e "  当前版本: ${cur_ver}"
    else
        echo -e "  ${YLW}⚠ 未检测到已安装的 Claude Code${NC}"
    fi

    local npm_cmd="npm"
    local npm_prefix
    npm_prefix=$(npm config get prefix 2>/dev/null)
    if [[ "$OSTYPE" == "linux-gnu"* ]] && [[ -n "$npm_prefix" ]] && [[ ! -w "$npm_prefix/lib/node_modules" ]]; then
        if sudo -n true 2>/dev/null; then
            npm_cmd="sudo npm"
        else
            echo -e "  ${YLW}需要 root 权限，请手动运行:${NC}"
            echo ""
            echo -e "    ${BOLD}sudo npm install -g @anthropic-ai/claude-code${NC}"
            echo ""
            read -p "  按回车继续..."
            return
        fi
    fi

    echo -e "  ${DIM}通过 npm 升级到最新版本 (约 200MB，下载较慢请耐心等待)...${NC}"
    echo ""

    # Clean up stale npm temp directories from previous interrupted installs
    local pkg_dir="$npm_prefix/lib/node_modules/@anthropic-ai"
    if [[ -d "$pkg_dir" ]]; then
        local sudo_prefix=""
        [[ "$npm_cmd" == "sudo npm" ]] && sudo_prefix="sudo"
        $sudo_prefix rm -rf "$pkg_dir"/.claude-code-* 2>/dev/null || true
    fi

    # Force npmmirror for faster downloads
    local saved_registry=""
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        saved_registry=$(npm config get registry 2>/dev/null)
        if [[ "$saved_registry" != "https://registry.npmmirror.com" ]]; then
            echo -e "  ${DIM}切换至 npmmirror 镜像加速下载${NC}"
            $npm_cmd config set registry https://registry.npmmirror.com
        else
            saved_registry=""
        fi
    fi

    # If proxy is set, test direct connection; keep proxy if direct is blocked
    local save_http_proxy="$http_proxy"
    local save_https_proxy="$https_proxy"
    local save_HTTP_PROXY="$HTTP_PROXY"
    local save_HTTPS_PROXY="$HTTPS_PROXY"
    if [[ -n "${http_proxy}${https_proxy}${HTTP_PROXY}${HTTPS_PROXY}" ]]; then
        if curl -s -o /dev/null --max-time 3 --noproxy '*' "https://registry.npmmirror.com" 2>/dev/null; then
            echo -e "  ${DIM}直连 npmmirror 可达，本次升级绕过代理${NC}"
            unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
        else
            echo -e "  ${YLW}直连不可达，保留代理（可能较慢）${NC}"
        fi
    fi

    local upgrade_ok=0
    if $npm_cmd install -g --no-audit --no-fund @anthropic-ai/claude-code; then
        upgrade_ok=1
    fi

    # Restore original registry
    if [[ -n "$saved_registry" ]]; then
        $npm_cmd config set registry "$saved_registry"
    fi

    if [[ $upgrade_ok -eq 0 ]]; then
        echo ""
        echo -e "  ${RED}✗ 升级失败${NC}"
        echo -e "  ${YLW}请手动执行: $npm_cmd install -g @anthropic-ai/claude-code${NC}"
        echo ""
        read -p "  按回车继续..."
        return
    fi

    local new_ver=""
    if command -v claude &>/dev/null; then
        new_ver=$(claude --version 2>/dev/null) || true
    fi
    if [[ -n "$new_ver" ]]; then
        echo ""
        echo -e "  ${GRN}✓ 升级完成: ${new_ver}${NC}"
    else
        echo ""
        echo -e "  ${GRN}✓ 升级完成${NC}"
    fi

    echo ""
    read -p "  按回车继续..."
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
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} upgrade" "升级 DeepSeek 配置补齐扩展字段"
    printf "  ${GREEN}%-22s${NC} %s\n" "${CMD_NAME} update" "升级 Claude Code 到最新版"
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
            read -e -p "  请输入编号或名称 (q=退出 a=添加 e=编辑 r=删除 u=升级 h=帮助): " choice

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
                e|E)
                    edit_model
                    scan_models "$CONFIG_DIR"
                    echo ""
                    read -p "  按回车继续..."
                    continue
                    ;;
                r|R)
                    remove_model
                    scan_models "$CONFIG_DIR"
                    echo ""
                    read -p "  按回车继续..."
                    continue
                    ;;
                u|U)
                    upgrade_claude
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
        upgrade)
            upgrade_models
            exit $?
            ;;
        update|upgrade-claude)
            upgrade_claude
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
