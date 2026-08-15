import fs from "node:fs";
import path from "node:path";
import { getModelsDir } from "../config/paths";
import { loadModels, repairModelConfig } from "../config/model-config";
import {
  writeJsonObject,
  readJsonObject,
} from "../config/json";
import { ensureOneMillionSuffix } from "../providers/one-million";
import { question, maskApiKey, confirm } from "../ui/prompts";
import { selectModel } from "../ui/menu";
import { BLU, GRN, YLW, RED, CYA, BOLD, DIM, NC } from "../ui/colors";
import { getCmdName } from "../platform/detect";

export async function editCommand(modelName?: string): Promise<number> {
  const cmdName = getCmdName();
  const modelsDir = getModelsDir();

  if (!modelName) {
    console.log("");
    console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
    console.log(`${BLU}║     编辑模型配置                  ║${NC}`);
    console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
    console.log("");

    const selected = await selectModel("选择要编辑的模型");
    if (!selected) return 1;
    modelName = selected;
  }

  let configPath = path.join(modelsDir, `${modelName}.json`);
  if (!fs.existsSync(configPath)) {
    console.log(`${RED}✗ 模型 '${modelName}' 不存在${NC}`);
    return 1;
  }

  // Validate first
  const repairResult = repairModelConfig(configPath, { write: false });
  if (!repairResult.ok) {
    return 1;
  }

  const curSettings = repairResult.record.settings;
  const curEnv = curSettings.env;
  const curName = curEnv.ANTHROPIC_MODEL || "";
  const curKey = curEnv.ANTHROPIC_AUTH_TOKEN || "";
  const curUrl = curEnv.ANTHROPIC_BASE_URL || "";
  const curOpus = curEnv.ANTHROPIC_DEFAULT_OPUS_MODEL || "";
  const curSonnet = curEnv.ANTHROPIC_DEFAULT_SONNET_MODEL || "";
  const curHaiku = curEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL || "";
  const curSubagent = curEnv.CLAUDE_CODE_SUBAGENT_MODEL || "";
  const curEffort = curEnv.CLAUDE_CODE_EFFORT_LEVEL || "";
  const curCompact = curEnv.CLAUDE_CODE_AUTO_COMPACT_WINDOW || "";

  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(
    `${BLU}║     编辑模型: ${modelName}${" ".repeat(
      Math.max(0, 24 - modelName.length)
    )}║${NC}`
  );
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(`  ${DIM}直接回车保留当前值${NC}`);
  console.log("");

  let newAlias = await question(`  启动命令名称 [${modelName}]: `);
  if (!newAlias) newAlias = modelName;

  let newModelId = await question(`  模型 ID [${curName}]: `);
  if (!newModelId) newModelId = curName;

  let newKey = await question(`  API Key [${maskApiKey(curKey)}]: `);
  if (!newKey) newKey = curKey;

  let newUrl = await question(`  Base URL [${curUrl}]: `);
  if (!newUrl) newUrl = curUrl;

  // 白名单模型自动补 [1m] 后缀（与提供商无关）
  newModelId = ensureOneMillionSuffix(newModelId);
  // api.deepseek.com 裸地址自动补 /anthropic 路径
  if (newUrl.match(/api\.deepseek\.com\/?$/)) {
    newUrl = newUrl.replace(/\/?$/, "/anthropic");
  }

  console.log("");
  console.log(`  ${BOLD}扩展配置${NC}  ${DIM}(直接回车保留当前值)${NC}`);
  console.log(`  ${DIM}子代理使用主模型的 API 端点，只能配置同厂商的模型${NC}`);

  let newSubagent = await question(
    `    Haiku/子代理模型 [${curSubagent || newModelId}]: `
  );
  if (!newSubagent) newSubagent = curSubagent || newModelId;

  console.log(`  ${DIM}Effort Level 控制推理深度（非推理模型可能不生效）${NC}`);
  console.log(
    `  ${DIM}Compact Window 控制自动压缩行为（非百万上下文模型可能不生效）${NC}`
  );

  let newEffort = await question(
    `    Effort Level [${curEffort || "max"}]: `
  );
  if (!newEffort) newEffort = curEffort || "max";

  let newCompact = await question(
    `    自动压缩窗口上限 [${curCompact || "400000"}]: `
  );
  if (!newCompact) newCompact = curCompact || "400000";

  // Confirm
  console.log("");
  console.log(`  ${BOLD}确认修改:${NC}`);
  console.log(`    命令名称:  ${cmdName} ${newAlias}`);
  console.log(`    模型 ID:   ${newModelId}`);
  console.log(`    API Key:   ${maskApiKey(newKey)}`);
  console.log(`    Base URL:  ${newUrl}`);
  console.log(`    子代理模型: ${newSubagent}`);
  console.log(`    ${CYA}Effort Level:    ${newEffort}${NC}`);
  console.log(`    ${CYA}Compact Window:  ${newCompact}${NC}`);
  console.log("");

  if (!(await confirm("  确认保存?", true))) {
    console.log("  已取消");
    return 1;
  }

  // Handle rename
  if (newAlias !== modelName) {
    const newPath = path.join(modelsDir, `${newAlias}.json`);
    if (fs.existsSync(newPath)) {
      console.log(`  ${RED}✗ 命令名称 '${newAlias}' 已被占用${NC}`);
      return 1;
    }
    fs.renameSync(configPath, newPath);
    configPath = newPath;
  }

  // Update config in env format
  const raw = readJsonObject(configPath);
  if (!raw.env || typeof raw.env !== "object" || Array.isArray(raw.env)) {
    raw.env = {};
  }
  const env = raw.env as Record<string, unknown>;
  env.ANTHROPIC_AUTH_TOKEN = newKey;
  env.ANTHROPIC_BASE_URL = newUrl;
  env.ANTHROPIC_MODEL = newModelId;
  env.ANTHROPIC_DEFAULT_OPUS_MODEL = newModelId;
  env.ANTHROPIC_DEFAULT_SONNET_MODEL = newModelId;
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL = newSubagent;
  env.CLAUDE_CODE_SUBAGENT_MODEL = newSubagent;
  if (newEffort) env.CLAUDE_CODE_EFFORT_LEVEL = newEffort;
  if (newCompact) env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = newCompact;

  writeJsonObject(configPath, raw);
  repairModelConfig(configPath, { write: true });

  console.log("");
  console.log(`  ${GRN}✓ 模型 '${newAlias}' 已更新${NC}`);

  return 0;
}
