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

function needsWindowsCommandShell(command: string): boolean {
  if (process.platform !== "win32") return false;
  const ext = path.extname(command).toLowerCase();
  return ext === ".cmd" || ext === ".bat";
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
  const claudeCmd = claudeBinStr.split(/\s+/); // Handle "npx -y ..." multi-word commands

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
  const child = spawn(
    claudeCmd[0],
    [...claudeCmd.slice(1), ...claudeArgs],
    { env, stdio: "inherit", shell: needsWindowsCommandShell(claudeCmd[0]) }
  );

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
