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

**Step 1: 放入 PATH**

把 `cc` 和 `cc.cmd` 复制到任意 PATH 目录：
- Windows: `C:\Users\<用户名>\.local\bin\`（推荐自建此目录）
- Mac/Linux: `~/.local/bin/` 或 `/usr/local/bin/`

**如何添加目录到 PATH（Windows）:**
右键「此电脑」→ 属性 → 高级系统设置 → 环境变量 → 用户变量 `Path` → 编辑 → 新建 → 粘贴路径 → 确定。

**Step 2: 配置 API Key**

```bash
mkdir -p ~/.claude/models
cp models/example-*.json ~/.claude/models/
# 编辑各 json 文件，填入你的 API Key
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

1. 在 `~/.claude/models/` 创建新的 JSON 配置文件
2. 编辑 `cc` 脚本，添加：

```bash
MODELS["mymodel"]="mymodel"
MODEL_DESCS["mymodel"]="My Model Name"
```

## 工作原理

通过替换 `~/.claude/settings.json` 来切换模型。首次使用会备份原配置到 `settings.json.backup`。

## 依赖

- [Claude Code](https://claude.ai/code) - 安装命令：`curl -fsSL https://claude.ai/install.sh | bash`
- Git Bash (Windows) 或 Bash (Mac/Linux)

## Star History

如果这个项目对你有帮助，请给个 ⭐ Star！

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/cc-star&type=Date)](https://star-history.com/#yourusername/cc-star&Date)

## License

MIT
