Claude Code 在 Linux 服务器上以 root 用户运行时，无法使用 `--dangerously-skip-permissions` 启动。创建一个具备 root 权限的其他用户，即可畅用自动模式。

# Create Root User

> **Skill**: 创建具有完全 root 权限的用户（UID=0）

## Description
创建一个具有完全 root 权限的独立用户，UID=0 等同于 root，可指定自定义家目录。适用于开发/测试环境需要多人共享 root 权限的场景。

## When to Use
- 用户要求创建 root 用户或 root 权限用户
- 需要独立家目录但保留 root 权限
- 开发/测试环境需要多个管理员账户
- 用户提到 "UID=0"、"root 级别"、"完全权限"

## SOP 流程

### Step 1: 确认参数
向用户确认以下参数（有默认值的可跳过）：
- **用户名**：新用户的登录名（必填）
- **密码**：登录密码（必填，建议使用强密码）
- **家目录**：默认工作目录（可选，默认 `/home/<用户名>`）
- **Shell**：登录 Shell（可选，默认 `/bin/bash`）

### Step 2: 创建用户

#### 2.1 基础创建（使用默认家目录）
```bash
useradd -m -s /bin/bash <用户名>
```

#### 2.2 指定家目录创建
```bash
# 确保家目录存在
mkdir -p <家目录路径>

# 创建用户并指定家目录
useradd -m -d <家目录路径> -s /bin/bash <用户名>
```

### Step 3: 设置密码
```bash
echo "<用户名>:<密码>" | chpasswd
```

### Step 4: 添加到管理组（可选）
```bash
usermod -aG sudo <用户名>
```

### Step 5: 赋予 Root 权限（UID=0）
```bash
# 关键步骤：将 UID 改为 0，等同于 root
# -o 参数允许非唯一 UID（多个用户共享 UID 0）
usermod -u 0 -o <用户名>
```

### Step 6: 修改家目录（如需要）
如果用户已创建但需要修改家目录：
```bash
# 方法1：使用 usermod（需确保用户未被使用）
usermod -d <新家目录> <用户名>

# 方法2：直接编辑配置文件（用户正在使用时）
sed -i 's|^<用户名>:\([^:]*\):0:\([^:]*\):\(.*\):/home/<用户名>:\(.*\)$|<用户名>:\1:0:\2:\3:<新家目录>:\4|' /etc/passwd
```

### Step 7: 验证权限
```bash
# 查看用户信息
id <用户名>

# 期望输出：
# uid=0(root) gid=<gid>(<用户名>) groups=0(root),27(sudo)

# 验证家目录
grep <用户名> /etc/passwd

# 期望输出格式：
# <用户名>:x:0:<gid>::<家目录>:/bin/bash
```

## 完整一键命令

### 示例 1：标准创建（默认家目录）
```bash
USERNAME="xl"
PASSWORD="gf71ay0n"

useradd -m -s /bin/bash $USERNAME && \
echo "$USERNAME:$PASSWORD" | chpasswd && \
usermod -aG sudo $USERNAME && \
usermod -u 0 -o $USERNAME && \
echo "✅ 用户 $USERNAME 创建成功" && \
id $USERNAME
```

### 示例 2：指定家目录
```bash
USERNAME="xl"
PASSWORD="gf71ay0n"
HOMEDIR="/root/rivermind-data"

mkdir -p $HOMEDIR && \
useradd -m -d $HOMEDIR -s /bin/bash $USERNAME && \
echo "$USERNAME:$PASSWORD" | chpasswd && \
usermod -aG sudo $USERNAME && \
usermod -u 0 -o $USERNAME && \
echo "✅ 用户 $USERNAME 创建成功，家目录：$HOMEDIR" && \
id $USERNAME && \
grep $USERNAME /etc/passwd
```

### 示例 3：修改现有用户的家目录
```bash
USERNAME="xl"
NEWHOME="/root/rivermind-data"

# 直接修改 /etc/passwd（适用于用户正在使用的情况）
sed -i "s|^$USERNAME:\([^:]*\):0:\([^:]*\):\(.*\):/home/$USERNAME:\(.*\)$|$USERNAME:\1:0:\2:\3:$NEWHOME:\4|" /etc/passwd && \
echo "✅ 家目录已更新" && \
grep $USERNAME /etc/passwd
```

## 验证清单

- [ ] `id <用户名>` 显示 `uid=0(root)`
- [ ] `groups <用户名>` 包含 `root` 组
- [ ] `grep <用户名> /etc/passwd` 显示正确的家目录
- [ ] `su - <用户名>` 可以正常登录
- [ ] 登录后 `pwd` 显示正确的家目录
- [ ] 可以执行 root 命令（如 `ls /root`）

## 使用方式

### 登录用户
```bash
su - <用户名>
# 输入密码
```

### 执行 root 命令
```bash
# 无需 sudo，直接执行
ls /root
cat /etc/shadow
systemctl restart nginx
```

## 安全注意事项

⚠️ **重要提醒：**

1. **UID=0 = root**：拥有系统最高权限，误操作可能导致系统损坏
2. **密码安全**：使用强密码（建议 12+ 字符，包含大小写、数字、特殊字符）
3. **审计追踪**：多个 UID=0 用户的操作都记录为 root，难以区分具体用户
4. **生产环境**：仅在开发/测试环境使用，生产环境建议使用 sudo 方式
5. **SSH 登录**：确保 `/etc/ssh/sshd_config` 允许该用户登录
6. **最小权限原则**：评估是否真的需要 UID=0，考虑是否可以用 sudo 替代

## 管理命令

### 查看所有 UID=0 的用户
```bash
awk -F: '$3 == 0 {print $1, $6}' /etc/passwd
```

### 修改用户密码
```bash
passwd <用户名>
```

### 删除用户
```bash
# 先确保没有其他 root 会话使用该用户
userdel -r <用户名>
```

### 临时禁用用户
```bash
usermod -L <用户名>  # 锁定账户
usermod -U <用户名>  # 解锁账户
```

## 常见问题

### Q: 为什么用 UID=0 而不是 sudo？
**A**: UID=0 提供完全等价的 root 权限，无需每次输入密码，适合需要频繁执行 root 操作的场景。但牺牲了审计能力。

### Q: 可以恢复成普通用户吗？
**A**: 可以，执行 `usermod -u <新UID> <用户名>` 将 UID 改回非 0 值。

### Q: 多个 UID=0 用户会冲突吗？
**A**: 不会冲突，但所有操作在日志中都显示为 root，无法区分具体是哪个用户。

### Q: 家目录修改后需要重启吗？
**A**: 不需要，新登录会话会自动使用新家目录。当前会话需要重新登录才能生效。

## 适用场景

- ✅ 开发/测试环境多人共享 root 权限
- ✅ 需要独立家目录和配置，但保留 root 权限
- ✅ 临时授权给其他管理员
- ✅ 自动化脚本需要 root 权限但使用独立账户
- ❌ 生产环境（建议使用 sudo 方式）
- ❌ 需要严格审计的场景
- ❌ 多租户环境

---

**Version**: 1.0  
**Last Updated**: 2026-07-08  
**Author**: Claude Code
