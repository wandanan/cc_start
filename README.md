# CC Start

```
  _____  _____         _____  _______   ___      _____  _______ 
  / ____|/ ____|       / ____||__   __| /   \    |  __ \|__   __|
 | |    | |           | (___     | |   /  ^  \   | |__) |  | |   
 | |    | |            \___ \    | |  /  /_\  \  |  _  /   | |   
 | |____| |____        ____) |   | | /  _____  \ | | \ \   | |   
  \_____|\_____|      |_____/    |_|/__/     \__\|_|  \_\  |_|   
                                    |__|     |__|                
```

**一条命令，终结 Claude Code 的上手门槛。多模型，一个工具就够了。**

---
![alt text](image.png)
## 为什么选择 CC Start？

Claude Code 默认只认 Anthropic 自家模型——想用国产大模型？环境变量、配置文件、每个窗口各自为战，稍不留神全面冲突。

CC Start 让你彻底告别这些折腾：

| | |
|---|---|
| 🚀 **一条命令装好一切** | 自动检测 & 安装 Node.js、Claude Code，脚本直达 PATH，安装即用，零手动 |
| 🎯 **多模型无缝切换** | `cc kimi` → `cc qwen` → `cc glm` — 一条命令换模型，比切歌还流畅 |
| 🪟 **多窗口独立运行** | 每个终端独立配置互不干扰，4 个窗口跑 4 个模型，随心所欲 |
| ➕ **任意模型随心加** | `cc add` 三步上手，兼容任何 Claude API 服务，不挑品牌不限数量 |
| 🌍 **全平台统一体验** | Windows / macOS / Linux 通吃，CMD、PowerShell、Bash 全支持 |

## 一分钟安装

> **前置依赖**：请先安装 [Git](https://git-scm.com/downloads)（Windows 用户还需要 Git Bash 来运行脚本）。

```bash
git clone https://github.com/wandanan/cc_start.git && cd cc_start

# Windows → 双击运行
install.bat

# Mac / Linux → 终端执行
chmod +x install.sh && ./install.sh
```

安装脚本自动完成：

```
✅ 检测 & 自动安装 Node.js / Claude Code（缺失时）
✅ 复制启动脚本到系统 PATH
✅ 创建配置目录，预置模型配置模板
✅ 自动注册 cc 和 ccs 两个命令
✅ Windows 自动配置 PATH，无需手动操作
```

> **安装后提示命令找不到？** Windows 安装程序会自动添加 PATH，但如果失效请手动添加：
> `系统属性 → 环境变量 → 编辑用户 PATH → 新建 → %USERPROFILE%\.local\bin`

## 快速开始

安装完成后，先添加模型配置，然后就能用了：

```bash
# 添加模型配置
cc add

# 交互式选择模型启动
cc

# 或直接指定模型
cc kimi
cc qwen
```

```bash
$ cc

  _____  _____         _____  _______   ___      _____  _______
  / ____|/ ____|       / ____||__   __| /   \    |  __ \|__   __|
 | |    | |           | (___     | |   /  ^  \   | |__) |  | |
 | |    | |            \___ \    | |  /  /_\  \  |  _  /   | |
 | |____| |____        ____) |   | | /  _____  \ | | \ \   | |
  \_____|\_____|      |_____/    |_|/__/     \__\|_|  \_\  |_|
                                    |__|     |__|

  多模型，一个工具就够了

  模型: █ [23]

  [Claude]
      1 ag-o45t        claude-opus-4-5-thinking
  ▶   2 ag-o46         claude-opus-4-6-thinking
      3 ag-s45         claude-sonnet-4-5
  [DeepSeek]
      1 dsp4-flash      deepseek-v4-flash[1m]
      2 dsp4-pro        deepseek-v4-pro[1m]
  [Gemini]
      1 ag-g31ph        gemini-3.1-pro-high

  1-12 / 32

  Esc 返回菜单  ↑↓ 选择  输入筛选  回车确认
```

## 命令详解

| 命令 | 说明 |
|---|---|
| `cc` | 交互式 fzf 风格搜索 + 选择模型启动（支持搜索过滤、上下键选择、Tab 切换分组、数字键快速跳转） |
| `cc <模型名>` | 跳过菜单，直接启动指定模型 |
| `cc add` | 添加新模型配置 |
| `cc edit [模型名]` | 编辑已有模型配置 |
| `cc remove [模型名]` | 删除模型配置 |
| `cc ls` | 列出所有已配置模型 |
| `cc sync [模型名]` | 同步当前 MCP/插件配置到指定模型 |
| `cc dsh [模型名]` | 用所选模型启动 DeepSeek Harness（自动打开浏览器） |
| `cc dsh stop` | 停止正在运行的 dsh 实例 |
| `cc dsh --reopen` | 打开已有 dsh 实例（非交互/脚本场景） |
| `cc reset` | 清空所有模型配置 |
| `cc -h` | 查看帮助 |

### 交互菜单快捷键

| 快捷键 | 功能 |
|---|---|
| `输入文字` | 实时搜索过滤模型（匹配别名 + 模型 ID） |
| `↑ ↓` | 上下选择模型 |
| `Tab` / `Shift+Tab` | 快速切换厂商分组（Claude → DeepSeek → Gemini → ...） |
| `1-9` | 筛选为空时，按数字直达当前分组第 N 个模型 |
| `Esc` | 第一次清空筛选，第二次打开操作菜单 |
| `b` / `空回车` | 操作菜单中返回模型选择 |

> 💡 `cc` 和 `ccs` 完全等价。Linux 系统默认有 `/usr/bin/cc`（C 编译器），若需区分使用 `ccs` 即可。

### DeepSeek Harness (dsh)

`cc dsh` 用你已配置的模型直接启动 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——**模型只在 cc_start 配一次，dsh 自动复用，无需二次配置**：

```bash
cc dsh              # 交互选择模型 → 启动 dsh Web UI，自动打开浏览器
cc dsh <模型名>      # 指定模型启动
cc dsh stop         # 停止正在运行的 dsh 实例
cc dsh <模型名> --profile headless "任务"   # 透传 dsh 参数（如 headless 跑任务）
```

- **一套配置两处用**：启动时自动把 `~/.claude/models/*.json` 转换为 dsh provider 配置层（`$DSH_HOME/cc-start-providers.yml`），每次启动现生成，改配置即生效
- **凭据不落盘**：每个 provider 经独立环境变量（`CC_START_KEY_*`）传递，UI 里切换任意模型都有正确 key
- **推理级别**：DeepSeek 模型（任意渠道：官方 / 火山方舟 / 本地代理）自动声明推理强度（off / low / medium / high / max），composer 模型选择器可选
- **退出**：前台 `Ctrl+C`；或另开终端 `cc dsh stop`（按端口找到进程树并清理）
- 首次使用需 `npm i -g @deepseek-ai/dsh`（未安装时自动通过 npx 获取）

## 支持的模型

预置国产大模型 + Anti-API 内部模型，填入 API Key 即刻启动：

### 国产大模型

| | 命令 | 模型 | 提供商 |
|---|---|---|---|
| 🔵 | `cc kimi` | Kimi K2.5 | Moonshot |
| 🟢 | `cc qwen` | 千问 3.5 Plus | Alibaba |
| 🟣 | `cc glm` | GLM 5 | Zhipu |
| 🟠 | `cc mini` | MiniMax M2.5 | MiniMax |

### Anti-API（Antigravity 代理）

本地启动 [Anti-API](https://github.com/wandanan/anti-api) 后一键切换 Claude / Gemini 模型：

| | 命令 | 模型 ID | 说明 |
|---|---|---|---|
| 🟡 | `cc ag-o46` | `claude-opus-4-6-thinking` | Opus 4.6 最强 |
| 🟡 | `cc ag-s46` | `claude-sonnet-4-6` | Sonnet 4.6 均衡 |
| 🟡 | `cc ag-s45` | `claude-sonnet-4-5` | Sonnet 4.5 |
| 🟡 | `cc ag-g35` | `gemini-3.5-flash` | Flash 快速 |

Anti-API 可用模型详见 [MODELS.md](https://github.com/wandanan/anti-api/blob/main/MODELS.md)。

```bash
# 打开 4 个终端，各跑各的

终端 1 > cc ag-o46    # Claude Opus 4.6 Thinking
终端 2 > cc ag-s46    # Claude Sonnet 4.6
终端 3 > cc ag-g35    # Gemini 3.5 Flash
终端 4 > cc qwen      # 千问 3.5 Plus
```

> 🔒 每个窗口独立配置，互不干扰，互不打架。

## 添加你自己的模型

`cc add` 支持添加任意兼容 Claude API 的模型，只需提供：

- **启动命令名称**（如 `deepseek`，之后用 `cc deepseek` 启动）
- **模型 ID**（如 `deepseek-v3`）
- **API Key**
- **Base URL**（API 端点地址）

```bash
cc add
# 按提示依次输入上述信息即可
```

配置文件保存在 `~/.claude/models/` 目录下，格式如下：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://api.example.com/anthropic",
    "ANTHROPIC_MODEL": "model-name",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "subagent-model",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "subagent-model",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "subagent-model",
    "CLAUDE_CODE_SUBAGENT_MODEL": "subagent-model"
  },
  "model": "sonnet",
  "skipDangerousModePermissionPrompt": true,
  "skipWebFetchPreflight": true
}
```

### Anti-API 配置示例

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8964",
    "ANTHROPIC_AUTH_TOKEN": "any-value",
    "ANTHROPIC_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-6-thinking",
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-6"
  },
  "model": "sonnet",
  "skipDangerousModePermissionPrompt": true,
  "skipWebFetchPreflight": true
}
```

> Token 填任意非空值即可，Anti-API 不校验。`ANTHROPIC_BASE_URL` 指向 `http://localhost:8964`。

## 工作原理

CC Start 通过 Claude Code 的 `--settings` 参数为每个实例指定独立的配置文件：

```bash
claude --settings ~/.claude/models/kimi.json
claude --settings ~/.claude/models/qwen.json
```

每个窗口使用独立配置，多窗口同时运行互不干扰。不同于旧式的替换 `settings.json` 方案，无需复制或覆盖全局配置。

## 依赖

- [Git](https://git-scm.com/downloads) — Windows 用户需要安装 Git（含 Git Bash）；Mac/Linux 通常已预装
- [Node.js](https://nodejs.org/) 18+ — 安装脚本会自动检测并在缺失时安装
- [Claude Code](https://claude.ai/code) — 安装脚本会自动检测并在缺失时通过 npm 安装

## License

MIT

---

<p align="center">
  <b>如果这个项目对你有帮助，点个 ⭐ Star 就是最大的鼓励！</b>
</p>

[![Star History Chart](https://api.star-history.com/svg?repos=wandanan/cc_start&type=Date)](https://star-history.com/#wandanan/cc_start&Date)
