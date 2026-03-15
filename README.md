# CC Star

在不同窗口中使用不同 AI 模型的 Claude Code 启动器。

## 一句话说明

安装后，输入 `cc` 选择模型，或 `cc kimi` / `cc qwen` 直接启动对应模型。

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
🚀 启动 Claude Code [千问 3.5 Plus]...
```

## 支持的模型

| 命令 | 模型 | 提供商 |
|------|------|--------|
| `cc kimi` | Kimi K2.5 | Moonshot |
| `cc qwen` | 千问 3.5 Plus | 阿里云 |
| `cc glm` | GLM 5 | 智谱AI |
| `cc mini` | MiniMax M2.5 | MiniMax |

## 安装（2 分钟搞定）

### 方式一：自动安装（推荐）

**Windows:**
```cmd
# 克隆项目后，在项目目录运行
install.bat
```

**Mac/Linux:**
```bash
# 克隆项目后，在项目目录运行
chmod +x install.sh
./install.sh
```

### 方式二：手动安装

把 `cc` 和 `cc.cmd` 复制到任意 PATH 目录：
- Windows: `C:\Users\<用户名>\.local\bin\`（推荐自建此目录）
- Mac/Linux: `~/.local/bin/` 或 `/usr/local/bin/`

然后创建配置目录并复制模型配置：
```bash
mkdir -p ~/.claude/models
cp models/*.json ~/.claude/models/
# 编辑配置文件，填入你的 API Key
```

## 配置格式

`~/.claude/models/kimi.json` 示例：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://api.kimi.com/coding/",
    "ANTHROPIC_MODEL": "kimi-k2.5"
  }
}
```

项目 `models/` 目录包含 4 个示例配置文件，按需复制修改即可。

## 添加新模型

### 方式一：交互式添加（推荐）

```bash
cc add
```

按提示输入：
- 模型别名（如 `deepseek`，用于命令）
- 模型显示名称（如 `DeepSeek V3`）
- API Key
- Base URL
- 模型 ID（可选，默认使用别名）

自动创建配置文件，立即可用。

### 方式二：复制现有配置

看到 `models/` 下的配置文件，复制一份改个名：

```bash
cp ~/.claude/models/kimi.json ~/.claude/models/myai.json
# 编辑 myai.json，修改 API Key 和模型参数
```

下次运行 `cc` 时，会自动检测到新模型。

## 工作原理

通过替换 `~/.claude/settings.json` 来切换模型。首次使用会备份原配置到 `settings.json.backup`。

## 依赖

- [Claude Code](https://claude.ai/code) - 安装命令：`curl -fsSL https://claude.ai/install.sh | bash`
- Git Bash (Windows) 或 Bash (Mac/Linux)

## Star History

如果这个项目对你有帮助，请给个 ⭐ Star！

[![Star History Chart](https://api.star-history.com/svg?repos=wandanan/cc_start&type=Date)](https://star-history.com/#wandanan/cc_start&Date)

## License

MIT
