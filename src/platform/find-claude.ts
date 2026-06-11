import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { isMsys, isWsl, getPlatform } from "./detect";

const IS_WINDOWS = getPlatform() === "windows";

// WSL interop: Windows binaries mounted under /mnt/ can't see WSL filesystem paths
function isWindowsInteropPath(p: string): boolean {
  return /^\/mnt\/[a-zA-Z]/.test(p);
}

// 候选文件名因平台而异
const CLAUDE_NAMES = IS_WINDOWS
  ? ["claude.cmd", "claude.exe", "claude"]
  : ["claude"];

function findInDir(binDir: string): string | null {
  for (const name of CLAUDE_NAMES) {
    const p = path.join(binDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 从 node 可执行文件的位置反向查找 claude。
 * npm 全局安装的包和 node 在同一个 bin 目录，这是最可靠的跨平台查找方式。
 */
function findFromNode(): string | null {
  const nodeDir = path.dirname(process.execPath);

  // 1) 和 node 同目录（npm 全局安装的标准位置）
  const direct = findInDir(nodeDir);
  if (direct) return direct;

  // 2) Linux nvm: 扫描兄弟版本目录
  //    node 路径: ~/.nvm/versions/node/v20.18.0/bin/node
  //    兄弟版本: ~/.nvm/versions/node/v22.1.0/bin/claude
  const parentDir = path.dirname(nodeDir);
  try {
    const entries = fs.readdirSync(parentDir);
    for (const entry of entries) {
      const binDir = path.join(parentDir, entry, "bin");
      if (binDir !== nodeDir) {
        try {
          const found = findInDir(binDir);
          if (found) return found;
        } catch {
          // skip unreadable dirs
        }
      }
    }
  } catch {
    // parentDir may not exist
  }

  // 3) Windows: %APPDATA%/npm (npm 全局安装的另一个常见位置)
  if (IS_WINDOWS) {
    const appData = process.env.APPDATA;
    if (appData) {
      const found = findInDir(path.join(appData, "npm"));
      if (found) return found;
    }
  }

  // 4) 通过 node 执行 npm prefix -g（npm 不在 PATH 时也能工作）
  try {
    const npmPrefix = execSync(
      `"${process.execPath}" -e "try{console.log(require('child_process').execSync('npm prefix -g',{stdio:['pipe','pipe','pipe']}).toString().trim())}catch(e){}"`,
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      }
    ).trim();
    if (npmPrefix) {
      const found = findInDir(path.join(npmPrefix, "bin"));
      if (found) return found;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 用系统命令查找可执行文件。
 * - Unix: which
 * - Windows CMD: where
 * - MSYS/Git Bash: which
 */
function systemWhich(cmd: string): string | null {
  // MSYS/Git Bash: 用 bash which
  if (isMsys()) {
    try {
      const result = execSync(`which "${cmd}" 2>/dev/null || true`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (result) return result;
    } catch {
      // ignore
    }
    return null;
  }

  // Windows CMD / PowerShell: 用 where
  if (IS_WINDOWS) {
    try {
      const result = execSync(`where "${cmd}" 2>nul`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: "cmd.exe",
      }).trim();
      if (result) {
        // where 可能返回多行，取第一个
        return result.split(/\r?\n/)[0].trim();
      }
    } catch {
      // where 找不到时 exit code != 0
    }
    return null;
  }

  // macOS / Linux: 用 which
  try {
    const result = execSync(`which "${cmd}" 2>/dev/null || true`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

export function findClaudeBin(): string {
  // 1) 从 node 位置反向查找（最可靠 — 确保使用与当前 Node.js 同源的 claude，避免 WSL 下误用 Windows 版本）
  const fromNode = findFromNode();
  if (fromNode) return fromNode;

  // 2) PATH 查找（fallback — 在 WSL/Linux 上跳过 Windows 路径，它们看不到 Linux 文件系统）
  const candidates = IS_WINDOWS ? ["claude.cmd", "claude.exe", "claude"] : ["claude"];
  for (const name of candidates) {
    const found = systemWhich(name);
    if (found && !isWindowsInteropPath(found)) return found;
  }

  // 3) 常见固定路径
  const home = IS_WINDOWS
    ? process.env.USERPROFILE || "."
    : process.env.HOME || ".";

  if (IS_WINDOWS) {
    const paths = [
      path.join(home, ".local", "bin"),
      path.join(home, "AppData", "Roaming", "npm"),
      "C:\\Program Files\\nodejs",
    ];
    for (const p of paths) {
      const found = findInDir(p);
      if (found) return found;
    }
  } else {
    const found = findInDir(path.join(home, ".local", "bin"));
    if (found) return found;
  }

  // 4) npx 兜底 — npx 和 node 在同一目录，直接用绝对路径避免 PATH 问题
  const nodeDir = path.dirname(process.execPath);
  const npxBin = IS_WINDOWS
    ? path.join(nodeDir, "npx.cmd")
    : path.join(nodeDir, "npx");
  if (fs.existsSync(npxBin)) {
    return `${npxBin} -y @anthropic-ai/claude-code`;
  }

  // 5) 系统 PATH 中的 npx 作为最后尝试
  const npxName = IS_WINDOWS ? "npx.cmd" : "npx";
  const npxPath = systemWhich(npxName);
  if (npxPath && !isWindowsInteropPath(npxPath)) {
    return `${npxPath} -y @anthropic-ai/claude-code`;
  }

  // 6) 绝望兜底
  if (IS_WINDOWS) {
    return path.join(home, ".local", "bin", "claude.cmd");
  }
  return path.join(home, ".local", "bin", "claude");
}
