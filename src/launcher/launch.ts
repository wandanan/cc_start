import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ModelRecord } from "../config/model-config";
import { isDeepSeekConfig, deepSeekExtraClaudeArgs } from "../providers/deepseek";
import { findClaudeBin } from "../platform/find-claude";
import { createMergedSettings } from "./merge-settings";
import { buildClaudeEnv } from "./env";
import { arrowSelect } from "../ui/arrow-select";
import { closePrompt } from "../ui/prompts";
import { BLU, GRN, BOLD, DIM, NC } from "../ui/colors";

/**
 * Windows 的 npm shim（claude.cmd）实际调用的是包内二进制——Claude Code v2.x
 * 是 SEA 单文件 claude.exe，旧版是 cli.js。解析出可直接 spawn 的目标，绕过
 * shell，避免 DEP0190（shell:true + args 数组 → 参数未转义警告）。
 */
function resolveShimTarget(
  cmdPath: string
): { cmd: string; preArgs: string[] } | null {
  const dir = path.dirname(cmdPath);
  const pkgRoot = path.join(
    dir,
    "node_modules",
    "@anthropic-ai",
    "claude-code"
  );
  const exe = path.join(pkgRoot, "bin", "claude.exe");
  if (fs.existsSync(exe)) return { cmd: exe, preArgs: [] };
  const cliJs = path.join(pkgRoot, "cli.js");
  if (fs.existsSync(cliJs)) return { cmd: process.execPath, preArgs: [cliJs] };
  // 兜底：读 shim 内容，正则提取它调用的 claude 目标（路径需含 claude）
  try {
    const content = fs.readFileSync(cmdPath, "utf8");
    const m = content.match(/node_modules[^\s"']*claude[^\s"']*\.(?:exe|js)/i);
    if (m) {
      const rel = m[0].replace(/\\/g, path.sep);
      const target = path.join(dir, rel);
      if (fs.existsSync(target)) {
        if (target.toLowerCase().endsWith(".exe"))
          return { cmd: target, preArgs: [] };
        return { cmd: process.execPath, preArgs: [target] };
      }
    }
  } catch {
    // ignore unreadable shim
  }
  return null;
}

/** Windows 命令行参数转义：含空格/特殊字符则双引号包裹。 */
function quoteShellArg(arg: string): string {
  if (arg === "") return '""';
  if (/[^\w@%\-+=:,./]/.test(arg)) {
    return '"' + arg.replace(/"/g, '""') + '"';
  }
  return arg;
}

/**
 * 构造 spawn 目标。优先 shell:false 直接执行底层二进制（.exe / 无扩展名
 * shim / Linux-macOS）；只有 Windows .cmd 解析失败或 npx 兜底时才回退到
 * shell:true，此时把命令+参数合并成单字符串以避免 DEP0190。
 */
function buildSpawnTarget(
  claudeBinStr: string,
  claudeArgs: string[]
): { cmd: string; args: string[]; shell: boolean } {
  const parts = claudeBinStr.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? claudeBinStr;
  const preArgs = parts.slice(1); // e.g. npx 的 "-y @anthropic-ai/claude-code"
  const ext = path.extname(first).toLowerCase();
  const base = path.basename(first).toLowerCase();

  // Windows .cmd/.bat shim：claude.cmd 解析出底层 exe/js 直接 spawn
  if (
    process.platform === "win32" &&
    (ext === ".cmd" || ext === ".bat") &&
    base.startsWith("claude")
  ) {
    const target = resolveShimTarget(first);
    if (target) {
      return {
        cmd: target.cmd,
        args: [...target.preArgs, ...claudeArgs],
        shell: false,
      };
    }
  }

  // 回退：需要 shell 的情况（npx.cmd、解析失败的 .cmd）。
  // 把命令与参数合并成单字符串，args 置空 — 这是 Node 官方推荐的 DEP0190
  // 消除方式（shell:true 不传 args 数组即不触发未转义警告）。
  const needsShell =
    process.platform === "win32" && (ext === ".cmd" || ext === ".bat");
  if (needsShell) {
    return {
      cmd: [first, ...preArgs, ...claudeArgs].map(quoteShellArg).join(" "),
      args: [],
      shell: true,
    };
  }

  // .exe / 无扩展名 shim / Linux-macOS：直接 spawn，shell:false，args 安全
  return { cmd: first, args: [...preArgs, ...claudeArgs], shell: false };
}

export async function launchClaude(
  model: ModelRecord,
  passThroughArgs: string[]
): Promise<number> {
  const modelConfig = model.settings;

  // Arrow-key select for launch mode
  const modeOptions = [
    { label: "1. dangerously-skip-permissions 启动", value: "skip-perms" },
    { label: "2. 普通启动", value: "normal" },
  ];

  const mode = await arrowSelect("请选择启动模式", modeOptions);
  if (mode === null) {
    console.log("已取消");
    return 1;
  }

  // Build environment
  const env = buildClaudeEnv(modelConfig.env);

  // Create merged settings
  const mergedSettings = createMergedSettings(modelConfig);

  // Build Claude args
  const claudeBinStr = findClaudeBin();

  const claudeArgs: string[] = [];

  if (mode === "skip-perms") {
    claudeArgs.push("--dangerously-skip-permissions");
  }

  const extraArgs = deepSeekExtraClaudeArgs(modelConfig);
  claudeArgs.push(...extraArgs);

  claudeArgs.push("--settings", mergedSettings);
  claudeArgs.push(...passThroughArgs);

  // Display launch info
  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     启动 Claude Code              ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(`  ${GRN}▶${NC} 模型: ${BOLD}${model.alias}${NC}`);
  if (env.ANTHROPIC_MODEL) {
    console.log(`  ${DIM}  ID: ${env.ANTHROPIC_MODEL}${NC}`);
  }
  if (env.ANTHROPIC_BASE_URL) {
    console.log(`  ${DIM}  URL: ${env.ANTHROPIC_BASE_URL}${NC}`);
  }
  if (mode === "skip-perms") {
    console.log(`  ${DIM}  模式: dangerously-skip-permissions${NC}`);
  }
  console.log(`  ${DIM}  配置: ${mergedSettings}${NC}`);
  console.log(`  ${DIM}  二进制: ${claudeBinStr}${NC}`);
  console.log(`  ${DIM}  配置已写入: ${fs.existsSync(mergedSettings)}${NC}`);
  console.log("");

  // Clean up all terminal state before handing control to Claude Code.
  // The readline interface (prompts.ts) and raw-mode selectors
  // (arrow-select.ts / search-select.ts via openRawInput) attach listeners
  // to stdin and toggle raw mode. Two things must happen here, in order,
  // or the inherited stdio lands in a bad state (especially on Windows
  // conpty — manifests as Claude Code hanging on input):
  //   1. exit raw mode and strip every listener we installed
  //   2. PAUSE stdin so the parent's ReadStream stops reading fd 0
  // pause() only takes effect under async spawn: a paused ReadStream calls
  // uv_read_stop, so the parent no longer competes with the child for fd 0.
  // Under spawnSync this was inert (the loop is blocked anyway) — which is
  // why the earlier pause fix did nothing. Switching to async spawn makes
  // the pause actually hand fd 0 over to Claude Code.
  // (Opposite of inter-component cleanup, which must NOT pause so the next
  // selector can read — here the parent never reads stdin again.)
  closePrompt();
  if (process.stdin.isTTY) {
    try {
      if (process.stdin.isRaw) process.stdin.setRawMode(false);
    } catch {
      // setRawMode may throw if the fd is already closed/mangled
    }
    process.stdin.removeAllListeners("data");
    process.stdin.removeAllListeners("keypress");
    if (!process.stdin.isPaused()) process.stdin.pause();
  }

  // Launch Claude Code via async spawn — spawnSync blocks the event loop
  // and mishandles TTY handoff for full-screen TUIs under Windows conpty,
  // leaving the child unable to receive input (VSCode hangs forever; cmd
  // recovers only after a delay). spawn + stdio: "inherit" lets the child
  // truly own the terminal.
  const target = buildSpawnTarget(claudeBinStr, claudeArgs);
  const child = spawn(target.cmd, target.args, {
    env,
    stdio: "inherit",
    shell: target.shell,
  });

  return new Promise<number>((resolve) => {
    child.on("error", (err) => {
      console.error(`启动失败: ${err.message}`);
      try {
        fs.unlinkSync(mergedSettings);
      } catch {
        // ignore
      }
      resolve(1);
    });

    child.on("exit", (code, signal) => {
      // Clean up temp settings file
      try {
        fs.unlinkSync(mergedSettings);
      } catch {
        // ignore cleanup errors
      }
      const status =
        signal != null ? 128 + (signalNumber(signal) ?? 0) : (code ?? 0);
      // Force exit: the paused TTY ReadStream keeps the event loop alive,
      // so a normal return would hang. We are the terminal action.
      process.exit(status);
    });
  });
}

function signalNumber(signal: string | null): number | undefined {
  switch (signal) {
    case "SIGHUP": return 1;
    case "SIGINT": return 2;
    case "SIGQUIT": return 3;
    case "SIGKILL": return 9;
    case "SIGTERM": return 15;
    default: return undefined;
  }
}
