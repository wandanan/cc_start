import fs from "node:fs";
import path from "node:path";
import { getModelsDir, getUserSettingsPath } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";
import { readJsonObject, writeJsonObject, isRecord } from "../config/json";
import { selectModel } from "../ui/menu";
import { GRN, RED, DIM, BLU, NC } from "../ui/colors";

export async function syncCommand(modelName?: string): Promise<number> {
  const modelsDir = getModelsDir();
  const userSettingsPath = getUserSettingsPath();

  if (!fs.existsSync(userSettingsPath)) {
    console.log(
      `${RED}✗ 未找到当前配置文件: ${userSettingsPath}${NC}`
    );
    console.log("  请先启动一次 Claude Code 生成配置文件");
    return 1;
  }

  if (!modelName) {
    console.log("");
    console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
    console.log(`${BLU}║     同步模型配置                  ║${NC}`);
    console.log(`${BLU}║     MCP / 插件 → 指定模型         ║${NC}`);
    console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
    console.log("");

    const selected = await selectModel("选择要同步的模型");
    if (!selected) return 1;
    modelName = selected;
  }

  const configPath = path.join(modelsDir, `${modelName}.json`);
  if (!fs.existsSync(configPath)) {
    console.log(`${RED}✗ 模型 '${modelName}' 不存在${NC}`);
    return 1;
  }

  // Read current model env
  const currentConfig = readJsonObject(configPath);
  const currentEnv: Record<string, unknown> =
    currentConfig.env && typeof currentConfig.env === "object" && !Array.isArray(currentConfig.env)
      ? (currentConfig.env as Record<string, unknown>)
      : {};

  // Copy global settings as base
  const globalSettings = readJsonObject(userSettingsPath);

  // Preserve the model's env and skipWebFetchPreflight
  const merged = { ...globalSettings };
  merged.env = currentEnv;
  if (currentConfig.skipWebFetchPreflight !== undefined) {
    merged.skipWebFetchPreflight = currentConfig.skipWebFetchPreflight;
  }

  writeJsonObject(configPath, merged);

  const curName = currentEnv.ANTHROPIC_MODEL || modelName;
  const curUrl = currentEnv.ANTHROPIC_BASE_URL || "";

  console.log("");
  console.log(`  ${GRN}✓ 模型 '${modelName}' 已同步${NC}`);
  console.log(`  ${DIM}MCP / 插件配置已更新，API 信息已保留${NC}`);
  console.log(`  ${DIM}${curName} @ ${curUrl}${NC}`);

  return 0;
}
