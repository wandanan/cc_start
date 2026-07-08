import fs from "node:fs";
import path from "node:path";
import {
  getModelsDir,
  getUserSettingsPath,
} from "../config/paths";
import {
  loadModels,
  repairModelConfig,
} from "../config/model-config";
import { ensureOneMillionSuffix } from "../providers/deepseek";
import { writeJsonObject, JsonObject, isRecord } from "../config/json";
import { question, maskApiKey, pause, confirm } from "../ui/prompts";
import { BLU, GRN, YLW, RED, CYA, BOLD, DIM, NC } from "../ui/colors";
import { getCmdName } from "../platform/detect";

function deepSeekDetectAndFix(
  baseUrl: string,
  modelId: string
): { modelId: string; baseUrl: string; isDeepSeek: boolean } {
  if (baseUrl.toLowerCase().includes("deepseek")) {
    let url = baseUrl;
    // Auto-append /anthropic for bare api.deepseek.com URLs
    if (url.match(/api\.deepseek\.com\/?$/)) {
      url = url.replace(/\/?$/, "/anthropic");
    }
    return { modelId: ensureOneMillionSuffix(modelId), baseUrl: url, isDeepSeek: true };
  }
  return { modelId, baseUrl, isDeepSeek: false };
}

export async function addCommand(): Promise<number> {
  const cmdName = getCmdName();
  const modelsDir = getModelsDir();

  while (true) {
    console.log("");
    console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
    console.log(`${BLU}║     添加新模型                    ║${NC}`);
    console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
    console.log("");
    console.log(`  ${DIM}三步完成配置，之后用 ${cmdName} <名称> 直接启动${NC}`);
    console.log("");

    // Step 1: alias
    console.log(`  ${BOLD}第 1 步 / 4${NC}  ${DIM}─  设置启动命令名称${NC}`);
    const alias = await question("    启动命令名称 (如 kimi): ");
    if (!alias) {
      console.log(`  ${RED}✗ 名称不能为空${NC}`);
      continue;
    }

    const configPath = path.join(modelsDir, `${alias}.json`);
    if (fs.existsSync(configPath)) {
      console.log(`  ${YLW}⚠  模型 '${alias}' 已存在${NC}`);
      if (!(await confirm("    是否覆盖?", false))) {
        return 1;
      }
    }

    // Step 2: model ID
    console.log("");
    console.log(`  ${BOLD}第 2 步 / 4${NC}  ${DIM}─  设置模型 ID${NC}`);
    let modelId = await question(`    模型 ID (如 kimi-k2.5): `);
    if (!modelId) modelId = alias;

    // Step 3: API key
    console.log("");
    console.log(`  ${BOLD}第 3 步 / 4${NC}  ${DIM}─  设置 API Key${NC}`);
    const apiKey = await question("    API Key: ");
    if (!apiKey) {
      console.log(`  ${RED}✗ API Key 不能为空${NC}`);
      continue;
    }

    // Step 4: base URL
    console.log("");
    console.log(`  ${BOLD}第 4 步 / 4${NC}  ${DIM}─  设置 API 地址${NC}`);
    const baseUrl = await question(
      "    Base URL (如 https://api.kimi.com/coding/): "
    );
    if (!baseUrl) {
      console.log(`  ${RED}✗ Base URL 不能为空${NC}`);
      continue;
    }

    // DeepSeek detection
    const dsResult = deepSeekDetectAndFix(baseUrl, modelId);
    modelId = dsResult.modelId;
    const normalizedUrl = dsResult.baseUrl;
    if (dsResult.isDeepSeek) {
      console.log("");
      console.log(`  ${CYA}🔍 检测到 DeepSeek API，已自动配置 1M 上下文窗口${NC}`);
      console.log(`  ${DIM}  主模型 ID 已更新: ${modelId}${NC}`);
    }

    // Extended config
    console.log("");
    console.log(`  ${BOLD}第 5 步 / 4${NC}  ${DIM}─  设置 Haiku/子代理模型${NC}`);
    console.log(`  ${DIM}  子代理使用主模型的 API 端点，只能配置同厂商的模型${NC}`);
    let subagentModel = await question(`    子代理模型名 [${modelId}]: `);
    if (!subagentModel) subagentModel = modelId;

    console.log("");
    console.log(`  ${BOLD}扩展配置${NC}  ${DIM}(直接回车使用默认值)${NC}`);
    console.log(`  ${DIM}Effort Level 控制推理深度（非推理模型可能不生效）${NC}`);
    console.log(
      `  ${DIM}Compact Window 控制自动压缩行为（非百万上下文模型可能不生效）${NC}`
    );
    let effortLevel = await question("    Effort Level [max]: ");
    if (!effortLevel) effortLevel = "max";
    let compactWindow = await question("    自动压缩窗口上限 [400000]: ");
    if (!compactWindow) compactWindow = "400000";

    // Confirm
    console.log("");
    console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
    console.log(`${BLU}║     确认配置                      ║${NC}`);
    console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
    console.log("");
    console.log(`  命令名称:  ${GRN}${cmdName} ${alias}${NC}`);
    console.log(`  模型 ID:   ${modelId}`);
    console.log(`  API Key:   ${maskApiKey(apiKey)}`);
    console.log(`  Base URL:  ${normalizedUrl}`);
    console.log(`  子代理模型: ${subagentModel}`);
    if (subagentModel === modelId) {
      console.log(`  ${DIM}            (与主模型相同)${NC}`);
    }
    console.log(`  ${CYA}Effort Level:    ${effortLevel}${NC}`);
    console.log(`  ${CYA}Compact Window:  ${compactWindow}${NC}`);
    console.log("");

    const action = await question("  确认保存? (Y/n/r 重填): ");
    if (action.toLowerCase() === "r") {
      console.log(`${YLW}  重新填写...${NC}`);
      continue;
    }
    if (action.toLowerCase() === "n") {
      console.log("  已取消");
      return 1;
    }

    // Create config file
    const userSettingsPath = getUserSettingsPath();
    let config: JsonObject;

    if (fs.existsSync(userSettingsPath)) {
      const raw = fs.readFileSync(userSettingsPath, "utf8");
      config = JSON.parse(raw.replace(/^﻿/, ""));
      if (!isRecord(config)) config = {};
      if (!config.env || typeof config.env !== "object" || Array.isArray(config.env)) {
        config.env = {};
      }
    } else {
      config = {
        env: {},
      };
    }

    const env = config.env as Record<string, unknown>;
    env.ANTHROPIC_AUTH_TOKEN = apiKey;
    env.ANTHROPIC_BASE_URL = normalizedUrl;
    env.ANTHROPIC_MODEL = modelId;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelId;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelId;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = subagentModel;
    env.CLAUDE_CODE_SUBAGENT_MODEL = subagentModel;
    env.CLAUDE_CODE_EFFORT_LEVEL = effortLevel;
    env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = compactWindow;
    config.skipWebFetchPreflight = true;

    writeJsonObject(configPath, config);

    // Run repair to normalize and apply DeepSeek policy
    repairModelConfig(configPath, { write: true });

    console.log("");
    console.log(`  ${GRN}✓ 模型 '${modelId}' 添加成功!${NC}`);
    console.log(`  ${DIM}配置文件:${NC} ~/.claude/models/${alias}.json`);
    console.log("");
    console.log(`  ${BOLD}使用方法:${NC}`);
    console.log(`    ${GRN}${cmdName} ${alias}${NC}        # 直接启动`);
    console.log(`    ${GRN}${cmdName}${NC}               # 从菜单选择`);

    return 0;
  }
}
