# CC Start

在不同窗口中使用不同 AI 模型的 Claude Code 启动器。

## 一句话说明

一个命令切换不同 AI 模型，各窗口独立运行，互不影响。

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
- ✅ 创建 `ccs` 别名（避免与系统 C 编译器冲突）

> ⚠️ **安装后如果提示 `ccs` 命令找不到？**
>
> Windows 安装程序会尝试自动添加 PATH，但如果失效，请手动添加：
> `系统属性 → 环境变量 → 编辑用户 PATH → 新建 → 添加 %USERPROFILE%\.local\bin`

### 特别说明：为什么使用 `ccs` 而不是 `cc`？

Linux 系统默认有一个 `/usr/bin/cc` 命令（C 编译器），为避免冲突，**所有平台统一使用 `ccs` 命令**（CC Start 的缩写）。

```bash
# 使用 ccs 代替 cc
ccs add        # 添加模型配置
ccs kimi       # 启动 Kimi 模型
```

安装完成后，**先添加模型配置**，然后输入 `ccs` 即可使用：

```bash
$ ccs

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
| `ccs kimi` | Kimi K2.5 |
| `ccs qwen` | 千问 3.5 Plus |
| `ccs glm` | GLM 5 |
| `ccs mini` | MiniMax M2.5 |
| `ccs <任意>` | **其他任意模型** |

> 💡 **想添加自己的模型？** 使用 `ccs add` 命令，支持任意兼容 Claude API 的模型。

## 🔧 配置 API Key（必做）

安装后需要添加模型配置才能使用。

### 推荐方式：命令行添加

```bash
ccs add
```

按提示输入：
- **启动命令名称**：如 `kimi`（之后用 `ccs kimi` 启动）
- **模型 ID**：如 `kimi-k2.5`
- **API Key**：你的 API 密钥
- **Base URL**：API 地址，如 `https://api.kimi.com/coding/`

重复 `ccs add` 可添加多个模型。

### 备选方式：复制修改

```bash
cp ~/.claude/models/kimi.json ~/.claude/models/myai.json
# 编辑文件，修改 API Key
```

然后输入 `ccs myai` 即可启动。

## 使用示例

```bash
ccs              # 交互式选择模型
ccs kimi         # 直接启动 Kimi
ccs qwen         # 在另一个窗口启动 Qwen
ccs myai         # 启动自定义模型
```

**多窗口同时使用**：

```bash
# 终端 1
ccs kimi

# 终端 2（同时运行）
ccs qwen

# 终端 3（同时运行）
ccs glm
```

每个窗口独立使用不同模型，配置互不干扰。

## 手动安装（备选）

如果不想用自动安装脚本，只需两步：

**Step 1: 把脚本放入 PATH**

方案 A - 复制到系统目录：
```bash
mkdir -p ~/.local/bin
cp cc ~/.local/bin/ccs          # Mac/Linux
cp cc cc.cmd ~/.local/bin/      # Windows (会自动创建 ccs 别名)
```

方案 B - 直接把本项目目录加入 PATH：
```bash
# 编辑 ~/.bashrc 或 ~/.zshrc，添加
export PATH="$PATH:/path/to/cc_start"
```

**Step 2: 复制模型配置到 Claude 配置目录**

```bash
mkdir -p ~/.claude/models
cp models/*.json ~/.claude/models/
# 然后编辑这些 json 文件，填入你的 API Key
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

通过 `--settings` 参数为每个 Claude Code 实例指定独立的配置文件：

```bash
claude --settings ~/.claude/models/kimi.json
claude --settings ~/.claude/models/qwen.json
```

每个窗口使用自己的配置，**多窗口同时运行互不干扰**。

> 旧版本使用替换 `settings.json` 的方式，已改为 `--settings` 参数方案。

## 依赖

- [Claude Code](https://claude.ai/code) - 安装命令：`curl -fsSL https://claude.ai/install.sh | bash`
- Git Bash (Windows) 或 Bash (Mac/Linux)

## Star History

如果这个项目对你有帮助，请给个 ⭐ Star！

[![Star History Chart](https://api.star-history.com/svg?repos=wandanan/cc_start&type=Date)](https://star-history.com/#wandanan/cc_start&Date)

## License

MIT
