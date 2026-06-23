import { spawnSync } from "node:child_process";
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
  // (arrow-select.ts / search-select.ts via openRawInput) all attach
  // listeners to stdin and toggle raw mode. Lingering listeners or raw mode
  // leave the TTY inconsistent for the inherited spawnSync stdio, which
  // shows up as garbled ANSI and input echo corruption on Windows conpty.
  closePrompt();
  if (process.stdin.isTTY) {
    try {
      if (process.stdin.isRaw) process.stdin.setRawMode(false);
    } catch {
      // setRawMode may throw if the fd is already closed/mangled
    }
    process.stdin.removeAllListeners("data");
    process.stdin.removeAllListeners("keypress");
    if (process.stdin.isPaused()) process.stdin.resume();
  }

  // Launch Claude Code
  const proc = spawnSync(claudeCmd[0], [...claudeCmd.slice(1), ...claudeArgs], {
    env,
    stdio: "inherit",
    shell: needsWindowsCommandShell(claudeCmd[0]),
  });

  // Clean up temp file
  try {
    fs.unlinkSync(mergedSettings);
  } catch {
    // ignore cleanup errors
  }

  if (proc.error) {
    console.error(`启动失败: ${proc.error.message}`);
    return 1;
  }

  return proc.status ?? 0;
}
