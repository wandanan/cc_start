# CC Start

**一条命令完成 Claude Code 全流程安装配置，多模型随心切换，让 Claude Code 上手零门槛。**

## 为什么选择 CC Start？

Claude Code 默认只能用 Anthropic 自家的 Claude 模型，想用国产大模型？需要手动折腾环境变量、配置文件，每个窗口还要单独设置，稍不注意就冲突。CC Start 把这些脏活累活一把梭：

- **一条命令装好一切** — 自动检测并安装 Node.js、Claude Code，复制脚本到 PATH，开箱即用
- **多模型无缝切换** — `cc kimi`、`cc qwen`、`cc glm`、`cc mini`，一条命令换模型，比切歌还简单
- **多窗口独立运行** — 每个窗口独立配置互不干扰，同时开 4 个终端用 4 个模型毫无压力
- **任意模型随心加** — `cc add` 三步添加任何兼容 Claude API 的模型，不限品牌不限数量
- **全平台覆盖** — Windows / macOS / Linux 统一体验，CMD、PowerShell、Bash 全支持

## 一分钟安装

```bash
# 克隆项目
git clone https://github.com/wandanan/cc_start.git
cd cc_start

# Windows: 双击运行
install.bat

# Mac / Linux: 一条命令搞定
chmod +x install.sh && ./install.sh
```

安装脚本会自动完成：

- ✅ 检测并自动安装 Node.js / Claude Code（缺失时）
- ✅ 复制启动脚本到系统 PATH
- ✅ 创建配置目录，预置模型配置模板
- ✅ 自动注册 `cc` 和 `ccs` 两个命令
- ✅ Windows 自动配置 PATH，无需手动操作

> **macOS 用户注意**：系统自带 bash 版本为 3.2，不支持关联数组。请先通过 Homebrew 安装新版 bash：
> ```bash
> brew install bash
> ```
> Linux 用户无需此步骤，系统自带 bash 4.0+ 已满足要求。

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

╔════════════════════════════════════╗
║     Claude Code 模型选择器         ║
╚════════════════════════════════════╝

  1) kimi        - Kimi K2.5
  2) qwen        - 千问 3.5 Plus
  3) glm         - GLM 5
  4) mini        - MiniMax M2.5

请选择模型 (输入编号或名称): 2

请选择启动模式 (↑↓选择, 回车确认):

  ▶ 1. 普通启动
    2. dangerously-skip-permissions 启动

🚀 启动 Claude Code [千问 3.5 Plus]...
```

## 命令详解

```bash
cc / ccs              交互式选择模型启动（↑↓ 方向键 + 回车）
cc <模型名>            直接启动指定模型
cc add                添加新模型配置（三步：名称、API Key、Base URL）
cc edit [模型名]       编辑已有模型配置
cc remove [模型名]     删除模型配置
cc ls                 列出所有已配置模型
cc sync [模型名]       同步当前 MCP/插件配置到指定模型
cc reset              清空所有模型配置
cc -h                 查看帮助
```

> `cc` 和 `ccs` 完全等价。Linux 系统默认有 C 编译器 `/usr/bin/cc`，若需区分可使用 `ccs`。

## 支持的模型

预置 4 个国产大模型配置模板，填入 API Key 即可使用：

| 命令 | 模型 | 提供商 |
|------|------|--------|
| `cc kimi` | Kimi K2.5 | Moonshot |
| `cc qwen` | 千问 3.5 Plus | Alibaba |
| `cc glm` | GLM 5 | Zhipu |
| `cc mini` | MiniMax M2.5 | MiniMax |
| `cc <自定义>` | 任意模型 | 任意兼容 Claude API 的服务 |

```bash
# 多窗口同时使用不同模型
# 终端 1
cc kimi

# 终端 2
cc qwen

# 终端 3
cc glm

# 终端 4
cc mini
```

每个窗口独立运行，互不影响。

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
    "ANTHROPIC_MODEL": "model-name"
  }
}
```

## 工作原理

CC Start 通过 Claude Code 的 `--settings` 参数为每个实例指定独立的配置文件：

```bash
claude --settings ~/.claude/models/kimi.json
claude --settings ~/.claude/models/qwen.json
```

每个窗口使用独立配置，多窗口同时运行互不干扰。不同于旧式的替换 `settings.json` 方案，无需复制或覆盖全局配置。

## 依赖

- [Claude Code](https://claude.ai/code) — 安装脚本会自动检测并在缺失时通过 npm 安装
- Git Bash (Windows) 或 Bash 4.0+ (Mac/Linux)
  - macOS：系统自带 bash 3.2，需 `brew install bash`
  - Linux：主流发行版自带 bash 4.x/5.x，无需额外安装

## License

MIT

---

如果这个项目对你有帮助，欢迎给个 ⭐ Star！

[![Star History Chart](https://api.star-history.com/svg?repos=wandanan/cc_start&type=Date)](https://star-history.com/#wandanan/cc_start&Date)
