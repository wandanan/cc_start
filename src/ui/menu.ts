import * as readline from "node:readline";
import { getModelsDir } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";
import { loadUsage, recordUsage } from "../config/usage";
import { showBanner } from "./banner";
import { question } from "./prompts";
import { searchSelect, SearchOption } from "./search-select";
import { GRN, YLW, RED, DIM, NC } from "../ui/colors";
import { getCmdName } from "../platform/detect";

function detectVendor(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("deepseek")) return "DeepSeek";
  if (lower.includes("claude")) return "Claude";
  if (lower.includes("gemini")) return "Gemini";
  if (lower.includes("qwen") || lower.includes("qewn")) return "Qwen";
  if (lower.includes("doubao")) return "豆包";
  if (lower.includes("glm")) return "GLM";
  if (lower.includes("gpt")) return "GPT";
  if (lower.includes("mimo")) return "MiniMax";
  return "";
}

function buildSearchOptions(models: ModelRecord[]): SearchOption[] {
  return models.map((m) => {
    const modelId = m.settings.env.ANTHROPIC_MODEL || m.alias;
    return {
      label: `${m.alias.padEnd(14)} ${modelId}`,
      value: m.alias,
      searchText: `${m.alias} ${modelId}`.toLowerCase(),
      group: detectVendor(modelId),
    };
  });
}

type MenuAction =
  | { type: "launch"; model: ModelRecord }
  | { type: "add" }
  | { type: "edit" }
  | { type: "remove" }
  | { type: "update" }
  | { type: "help" }
  | { type: "quit" }
  | { type: "back" }
  | { type: "invalid" };

export function selectModel(prompt: string): Promise<string | null> {
  return selectModelInteractive(prompt);
}

async function selectModelInteractive(
  promptText: string
): Promise<string | null> {
  const modelsDir = getModelsDir();
  const { models } = loadModels(modelsDir);

  if (models.length === 0) {
    console.log(
      `${YLW}⚠  没有已配置的模型，请先使用 ${getCmdName()} add 添加${NC}`
    );
    return null;
  }

  const sorted = models.slice().sort((a, b) => a.alias.localeCompare(b.alias));
  return searchSelect(promptText, buildSearchOptions(sorted));
}

function actionPrompt(): Promise<MenuAction> {
  return new Promise((resolve) => {
    console.log("");
    console.log(`  ${GRN}b)${NC}  返回模型选择  ${GRN}a)${NC}  添加新模型`);
    console.log(`  ${GRN}e)${NC}  编辑模型配置  ${GRN}r)${NC}  删除模型`);
    console.log(`  ${GRN}u)${NC}  升级 Claude   ${GRN}h)${NC}  查看帮助`);
    console.log(`                        ${YLW}q)${NC}  退出`);
    console.log("");
    console.log(`  ${DIM}按 Esc 或 b 返回模型选择${NC}`);

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin);

    function cleanup(): void {
      process.stdin.setRawMode(wasRaw ?? false);
      process.stdin.removeListener("keypress", handler);
      process.stdin.pause();
    }

    function handler(
      str: string | undefined,
      key: readline.Key | undefined
    ): void {
      if (!key) return;

      if (key.ctrl && key.name === "c") {
        cleanup();
        resolve({ type: "quit" });
        return;
      }

      if (key.name === "escape") {
        cleanup();
        resolve({ type: "back" });
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve({ type: "back" });
        return;
      }

      const ch = (str || "").toLowerCase();
      if (ch === "q") { cleanup(); resolve({ type: "quit" }); return; }
      if (ch === "a") { cleanup(); resolve({ type: "add" }); return; }
      if (ch === "e") { cleanup(); resolve({ type: "edit" }); return; }
      if (ch === "r") { cleanup(); resolve({ type: "remove" }); return; }
      if (ch === "u") { cleanup(); resolve({ type: "update" }); return; }
      if (ch === "h") { cleanup(); resolve({ type: "help" }); return; }
      if (ch === "b") { cleanup(); resolve({ type: "back" }); return; }
    }

    process.stdin.on("keypress", handler);
    process.stdin.resume();
  });
}

export async function interactiveMenu(): Promise<MenuAction> {
  const modelsDir = getModelsDir();
  const { models } = loadModels(modelsDir);

  showBanner();

  // No models at all
  if (models.length === 0) {
    console.log(`  ${YLW}⚠  没有已配置的模型${NC}`);
    console.log("");
    console.log(`  ${GRN}a)${NC}  添加新模型  ${YLW}q)${NC}  退出`);
    console.log("");
    const choice = await question("  选择操作: ");
    const lower = (choice || "").toLowerCase();
    if (lower === "a") return { type: "add" };
    return { type: "quit" };
  }

  const usage = loadUsage();

  // Top 3 most-used models
  const allHot: ModelRecord[] = [];
  for (const m of models) {
    if (usage[m.alias]) allHot.push(m);
  }
  allHot.sort((a, b) => {
    const ua = usage[a.alias];
    const ub = usage[b.alias];
    if (ua.lastUsed !== ub.lastUsed) return ub.lastUsed.localeCompare(ua.lastUsed);
    return ub.count - ua.count;
  });
  const hot = allHot.slice(0, 3);

  // All models sorted by alias (for vendor grouping below 常用)
  const allSorted = [...models].sort((a, b) => a.alias.localeCompare(b.alias));

  // Build options: 常用 section first, then vendor groups
  // Hot models appear in both — quick access at top, also findable by vendor
  const options: SearchOption[] = [];
  for (const m of hot) {
    const modelId = m.settings.env.ANTHROPIC_MODEL || m.alias;
    options.push({
      label: `${m.alias.padEnd(14)} ${modelId}`,
      value: m.alias,
      searchText: `${m.alias} ${modelId}`.toLowerCase(),
      group: "常用",
    });
  }
  for (const m of allSorted) {
    const modelId = m.settings.env.ANTHROPIC_MODEL || m.alias;
    options.push({
      label: `${m.alias.padEnd(14)} ${modelId}`,
      value: m.alias,
      searchText: `${m.alias} ${modelId}`.toLowerCase(),
      group: detectVendor(modelId),
    });
  }

  const selected = await searchSelect("模型:", options);

  if (selected !== null) {
    const model = models.find((m) => m.alias === selected);
    if (model) {
      recordUsage(model.alias);
      return { type: "launch", model };
    }
  }

  // Esc from selector → show action prompt (single-key, Esc=back)
  return await actionPrompt();
}
