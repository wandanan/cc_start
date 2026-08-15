import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getPlatform } from "../platform/detect";
import { findClaudeBin } from "../platform/find-claude";
import { BLU, GRN, YLW, RED, BOLD, DIM, NC } from "../ui/colors";
import { question, confirm, closePrompt } from "../ui/prompts";

function getClaudeVersion(claudeBin: string): string {
  // npx-based fallback paths — skip version check
  if (claudeBin.includes("npx ")) return "";
  try {
    // Use the resolved path directly so PATH is not involved.
    // Note: no `2>/dev/null || true` — those are bash-isms; on win32 execSync
    // defaults to cmd.exe where they break the command and yield empty output.
    // The try/catch + piped stdio already swallow failures and stderr.
    return execSync(`"${claudeBin}" --version`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * 查询 npm registry 上的最新发布版本（best-effort，网络失败返回空串）。
 * 与当前版本比较，已是最新则跳过无意义的 200MB 重装。
 */
function getLatestVersion(): string {
  try {
    return execSync(`npm view @anthropic-ai/claude-code version`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 20000,
    }).trim();
  } catch {
    return "";
  }
}

export async function updateCommand(): Promise<number> {
  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     升级 Claude Code              ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");

  // Use multi-platform binary detection, not bare PATH lookup
  const claudeBin = findClaudeBin();
  const curVer = getClaudeVersion(claudeBin);

  if (curVer) {
    console.log(`  ${DIM}当前版本:${NC} ${curVer}`);
  } else {
    console.log(`  ${YLW}⚠ 未检测到已安装的 Claude Code${NC}`);
  }

  // 查询最新版本，已是最新则跳过（避免无意义的 200MB 重装）
  const latestVer = getLatestVersion();
  if (latestVer) {
    console.log(`  ${DIM}最新版本:${NC} ${latestVer}`);
    if (curVer) {
      // curVer 形如 "2.1.207 (Claude Code)" - 提取数字版本比较
      const curNum = curVer.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "";
      if (curNum === latestVer) {
        console.log(`  ${GRN}✓ 已是最新版本，无需升级${NC}`);
        console.log("");
        await question("  按回车继续...");
        return 0;
      }
    }
  }

  // Determine npm command
  let npmCmd = "npm";
  const platform = getPlatform();
  if (platform === "linux") {
    try {
      const prefix = execSync("npm config get prefix 2>/dev/null || true", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (prefix) {
        const libPath = path.join(prefix, "lib", "node_modules");
        try {
          fs.accessSync(libPath, fs.constants.W_OK);
        } catch {
          try {
            execSync("sudo -n true 2>/dev/null", { stdio: "ignore" });
            npmCmd = "sudo npm";
          } catch {
            console.log(`  ${YLW}需要 root 权限，请手动运行:${NC}`);
            console.log("");
            console.log(
              `    ${BOLD}sudo npm install -g @anthropic-ai/claude-code${NC}`
            );
            console.log("");
            await question("  按回车继续...");
            return 0;
          }
        }
      }
    } catch {
      // proceed with regular npm
    }
  }

  console.log(
    `  ${DIM}通过 npm 升级到最新版本 (约 200MB，下载较慢请耐心等待)...${NC}`
  );
  console.log("");

  // 显式确认：菜单里 'u' 是单键无确认，误触（或 stdin 残留字节）会直接
  // 触发 200MB 下载。TTY 交互时必须确认；非 TTY（脚本调用 `cc update`）放行。
  if (process.stdin.isTTY) {
    const ok = await confirm(`  ${BOLD}确认开始升级？${NC}`, false);
    closePrompt(); // 释放 stdin，避免 readline 与后续 npm 的 stdio:inherit 冲突
    if (!ok) {
      console.log(`  ${DIM}已取消${NC}`);
      return 0;
    }
  }

  // Clean stale temp dirs
  try {
    const prefix = execSync("npm config get prefix", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (prefix) {
      const pkgDir = path.join(prefix, "lib", "node_modules", "@anthropic-ai");
      if (fs.existsSync(pkgDir)) {
        const entries = fs.readdirSync(pkgDir);
        for (const entry of entries) {
          if (entry.startsWith(".claude-code-")) {
            const sudoPrefix = npmCmd === "sudo npm" ? "sudo" : "";
            try {
              execSync(`${sudoPrefix} rm -rf "${path.join(pkgDir, entry)}"`, {
                stdio: "ignore",
              });
            } catch {
              // ignore
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Switch to npmmirror for faster downloads on Linux
  let savedRegistry = "";
  if (platform === "linux") {
    try {
      savedRegistry = execSync("npm config get registry 2>/dev/null || true", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (savedRegistry !== "https://registry.npmmirror.com") {
        console.log(`  ${DIM}切换至 npmmirror 镜像加速下载${NC}`);
        execSync(`${npmCmd} config set registry https://registry.npmmirror.com`, {
          stdio: "ignore",
        });
      } else {
        savedRegistry = "";
      }
    } catch {
      // ignore
    }
  }

  // Unset proxy if direct connection works
  let savedProxy = false;
  const hasProxy = process.env.http_proxy || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (hasProxy) {
    try {
      execSync(
        `curl -s -o /dev/null --max-time 3 --noproxy '*' "https://registry.npmmirror.com" 2>/dev/null`,
        { stdio: "ignore" }
      );
      console.log(`  ${DIM}直连 npmmirror 可达，本次升级绕过代理${NC}`);
      savedProxy = true;
      delete process.env.http_proxy;
      delete process.env.https_proxy;
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
    } catch {
      console.log(`  ${YLW}直连不可达，保留代理（可能较慢）${NC}`);
    }
  }

  // Run upgrade
  let upgradeOk = false;
  try {
    execSync(
      `${npmCmd} install -g --no-audit --no-fund @anthropic-ai/claude-code`,
      { stdio: "inherit" }
    );
    upgradeOk = true;
  } catch {
    // failed
  }

  // Restore registry
  if (savedRegistry) {
    try {
      execSync(`${npmCmd} config set registry "${savedRegistry}"`, {
        stdio: "ignore",
      });
    } catch {
      // ignore
    }
  }

  if (!upgradeOk) {
    console.log("");
    console.log(`  ${RED}✗ 升级失败${NC}`);
    console.log(
      `  ${YLW}请手动执行: ${npmCmd} install -g @anthropic-ai/claude-code${NC}`
    );
    console.log("");
    await question("  按回车继续...");
    return 0;
  }

  const newVer = getClaudeVersion(claudeBin);

  if (newVer) {
    console.log("");
    console.log(`  ${GRN}✓ 升级完成: ${newVer}${NC}`);
  } else {
    console.log("");
    console.log(`  ${GRN}✓ 升级完成${NC}`);
  }

  // Check for [1m] context models and warn about compatibility
  try {
    const modelsDir = path.join(
      process.env.USERPROFILE || process.env.HOME || "~",
      ".claude", "models"
    );
    if (fs.existsSync(modelsDir)) {
      const has1mModel = fs.readdirSync(modelsDir)
        .filter((f) => f.endsWith(".json") && !f.startsWith("."))
        .some((f) => {
          try {
            const raw = fs.readFileSync(path.join(modelsDir, f), "utf-8");
            return /\[[0-9]+[mM]\]/.test(raw);
          } catch { return false; }
        });
      if (has1mModel) {
        console.log("");
        console.log(`  ${YLW}⚠ 检测到 1M 上下文模型配置${NC}`);
        console.log(`  ${DIM}新版本可能存在兼容性问题。如遇模型不可用，请回退:${NC}`);
        console.log(`  ${DIM}npm install -g @anthropic-ai/claude-code@2.1.196${NC}`);
      }
    }
  } catch { /* ignore */ }

  console.log("");
  await question("  按回车继续...");

  return 0;
}
