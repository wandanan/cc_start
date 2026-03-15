# CC Star

在不同窗口中使用不同 AI 模型的 Claude Code 启动器。

## 一句话说明

一个命令切换不同 AI 模型，各窗口独立运行。

## 🚀 一分钟安装

```bash
# 克隆项目
git clone https://github.com/wandanan/cc_start.git
cd cc_start

# Windows: 双击运行
install.bat

# Mac/Linux: 一行命令
chmod +x install.sh && ./install.sh
```

安装脚本会自动完成：
- ✅ 检测/创建安装目录
- ✅ 复制脚本到 PATH
- ✅ 创建配置目录
- ✅ 复制模型配置文件
- ✅ 自动添加 PATH（Windows）

安装完成后，输入 `cc` 即可使用。

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

| 命令 | 模型 |
|------|------|
| `cc kimi` | Kimi K2.5 |
| `cc qwen` | 千问 3.5 Plus |
| `cc glm` | GLM 5 |
| `cc mini` | MiniMax M2.5 |
| `cc <任意>` | **其他任意模型** |

> 💡 **想添加自己的模型？** 往下看，支持任意兼容 Claude API 的模型。

## 配置 API Key

安装后需要配置你的 API Key 才能使用。

**方式一：命令行添加（推荐新手）**

```bash
cc add
# 按提示输入：别名、名称、API Key、Base URL
```

**方式二：复制修改（适合批量）**

```bash
cp ~/.claude/models/kimi.json ~/.claude/models/myai.json
# 编辑文件，修改 API Key
```

然后输入 `cc myai` 即可启动。

## 使用示例

```bash
cc              # 交互式选择模型
cc kimi         # 直接启动 Kimi
cc myai         # 启动自定义模型
```

## 手动安装（备选）

如果不想用自动安装脚本：

```bash
# 1. 复制脚本到 PATH
mkdir -p ~/.local/bin
cp cc ~/.local/bin/          # Mac/Linux
cp cc cc.cmd ~/.local/bin/   # Windows

# 2. 确保 ~/.local/bin 在 PATH 中

# 3. 复制模型配置
mkdir -p ~/.claude/models
cp models/*.json ~/.claude/models/
```

## 配置说明

配置文件格式（`~/.claude/models/任意名称.json`）：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://api.example.com/anthropic",
    "ANTHROPIC_MODEL": "model-name"
  }
}
```

项目 `models/` 目录包含 4 个预置配置文件，作为参考模板。

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
