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
  // (arrow-select.ts / search-select.ts via openRawInput) attach listeners
  // to stdin and toggle raw mode. Two things must happen here, in order,
  // or the inherited spawnSync stdio lands in a bad state (especially on
  // Windows conpty — manifests as Claude Code hanging on input):
  //   1. exit raw mode and strip every listener we installed
  //   2. PAUSE stdin so the parent's ReadStream stops reading fd 0
  // pause() is the key fix: openRawInput resumes stdin into flowing mode.
  // A flowing ReadStream keeps uv_read_start on fd 0 and races the child
  // for input — conpty then routes keystrokes to the parent instead of
  // Claude Code. Pausing releases the fd to the child. (This is the
  // opposite of inter-component cleanup, which must NOT pause so the next
  // selector can read — here we never read stdin in the parent again.)
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
