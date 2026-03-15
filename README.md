# CC Star

一个简洁的 Claude Code 多模型切换工具，让你在不同窗口中轻松使用不同的 AI 模型。

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 功能特点

- 🚀 快速切换多个 AI 模型
- 🖥️ 支持交互式菜单和命令行直接启动
- ⚡ 一键启动，无需手动修改配置
- 🔧 易于扩展，支持添加新模型

## 支持的模型

| 命令 | 模型 | 提供商 |
|------|------|--------|
| `cc kimi` | Kimi K2.5 | Moonshot |
| `cc qwen` | 千问 3.5 Plus | 阿里云 |
| `cc glm` | GLM 5 | 智谱AI |
| `cc mini` | MiniMax M2.5 | MiniMax |

## 安装

### 前置要求

- [Claude Code](https://claude.ai/code) 已安装
- Git Bash (Windows) 或 Bash (Mac/Linux)

### 快速安装

**Windows:**

1. 克隆项目
```bash
git clone https://github.com/yourusername/cc-star.git
cd cc-star
```

2. 安装脚本到 PATH
```powershell
# PowerShell 管理员
$binDir = "$env:USERPROFILE\.local\bin"
New-Item -ItemType Directory -Force -Path $binDir

Copy-Item "cc" "$binDir\cc"
Copy-Item "cc.cmd" "$binDir\cc.cmd"

# 添加到用户 PATH
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";$binDir",
    "User"
)
```

3. 重启终端

**Mac/Linux:**

```bash
git clone https://github.com/yourusername/cc-star.git
cd cc-star

# 安装到 /usr/local/bin
sudo cp cc /usr/local/bin/
sudo chmod +x /usr/local/bin/cc

# 或者安装到 ~/.local/bin
mkdir -p ~/.local/bin
cp cc ~/.local/bin/
chmod +x ~/.local/bin/cc
```

### 配置模型

1. 创建配置目录
```bash
mkdir -p ~/.claude/models
```

2. 复制示例配置并修改 API Key
```bash
cp models/example-kimi.json ~/.claude/models/kimi.json
cp models/example-qwen.json ~/.claude/models/qwen.json
# 编辑文件，填入你的 API Key
```

3. 配置说明

在 `~/.claude/models/` 目录下创建模型配置文件：

**kimi.json:**
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-kimi-api-key",
    "ANTHROPIC_BASE_URL": "https://api.kimi.com/coding/",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "kimi-k2.5",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "kimi-k2.5",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "kimi-k2.5",
    "ANTHROPIC_MODEL": "kimi-k2.5"
  },
  "includeCoAuthoredBy": false
}
```

**qwen.json:**
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-dashscope-api-key",
    "ANTHROPIC_BASE_URL": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "qwen3.5-plus",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "qwen3.5-plus",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "qwen3.5-plus",
    "ANTHROPIC_MODEL": "qwen3.5-plus"
  },
  "includeCoAuthoredBy": false
}
```

## 使用方法

### 交互式选择

直接输入 `cc`，会弹出菜单：

```
$ cc

╔════════════════════════════════════╗
║     Claude Code 模型选择器         ║
╚════════════════════════════════════╝

  1) kimi        - Kimi K2.5
  2) qwen        - 千问 3.5 Plus
  3) glm         - GLM 5
  4) mini        - MiniMax M2.5

  q) 退出

请选择模型 (输入编号或名称):
```

### 直接启动

```bash
cc kimi    # 启动 Kimi K2.5
cc qwen    # 启动千问 3.5 Plus
cc glm     # 启动 GLM 5
cc mini    # 启动 MiniMax M2.5
```

### 查看帮助

```bash
cc --help
cc help
```

## 添加自定义模型

1. 在 `~/.claude/models/` 创建新的 JSON 配置文件
2. 在 `cc` 脚本中添加模型定义（约第 15-25 行）：

```bash
MODELS["yourmodel"]="yourmodel"
MODEL_DESCS["yourmodel"]="Your Model Description"
```

3. 重新运行 `cc` 即可看到新选项

## 工作原理

CC Star 通过动态替换 `~/.claude/settings.json` 来切换模型：

1. 首次使用时备份原配置到 `settings.json.backup`
2. 根据选择的模型，将对应配置复制到 `settings.json`
3. 启动 Claude Code

## 项目结构

```
cc-star/
├── README.md              # 本文件
├── cc                     # 主脚本 (Bash)
├── cc.cmd                 # Windows 批处理包装器
├── .gitignore             # Git 忽略规则
└── models/                # 示例配置
    ├── example-kimi.json
    ├── example-qwen.json
    ├── example-glm.json
    └── example-mini.json
```

## 常见问题

**Q: Windows 上提示 'cc' 不是内部或外部命令？**

A: 确保 `cc.cmd` 所在目录已添加到系统 PATH，并重启终端。

**Q: 如何恢复原始配置？**

A: 备份文件保存在 `~/.claude/settings.json.backup`，手动复制回去即可。

**Q: 支持哪些 Claude Code 版本？**

A: 已测试 v2.1.76+，理论支持所有版本。

## 贡献

欢迎 Issue 和 PR！

## License

MIT License

---

Made with ❤️ for Claude Code users
