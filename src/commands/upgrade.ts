import fs from "node:fs";
import path from "node:path";
import { getModelsDir } from "../config/paths";
import {
  loadModels,
  repairModelConfig,
  ModelRecord,
} from "../config/model-config";
import {
  readJsonObject,
  writeJsonObject,
  isRecord,
} from "../config/json";
import {
  isDeepSeekConfig,
  ensureOneMillionSuffix,
  applyDeepSeekPolicy,
} from "../providers/deepseek";
import { BLU, GRN, YLW, DIM, NC } from "../ui/colors";

export function upgradeCommand(): number {
  const modelsDir = getModelsDir();

  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     升级模型配置                  ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(`  ${DIM}扫描并补齐 DeepSeek 模型的扩展字段...${NC}`);
  console.log("");

  const files = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(modelsDir, f));

  let upgraded = 0;

  for (const file of files) {
    const name = path.basename(file, ".json");
    const repairResult = repairModelConfig(file, { write: false });

    if (!repairResult.ok) {
      console.log(`  ${YLW}⚠${NC} ${name} → 配置无效，跳过`);
      continue;
    }

    const settings = repairResult.record.settings;

    if (!isDeepSeekConfig(settings)) {
      console.log(`  ${DIM}·${NC} ${name} → 非 DeepSeek，跳过`);
      continue;
    }

    // Apply DeepSeek policy (writes to file)
    const changed = applyDeepSeekPolicy(settings);
    if (changed) {
      writeJsonObject(file, settings as unknown as Record<string, unknown>);
      upgraded++;
      console.log(`  ${GRN}✓${NC} ${name} → 已补齐扩展字段`);
    } else {
      console.log(`  ${DIM}·${NC} ${name} → ${GRN}已是最新${NC}`);
    }
  }

  console.log("");
  if (upgraded > 0) {
    console.log(`  ${GRN}✓ 已升级 ${upgraded} 个配置${NC}`);
  } else {
    console.log(`  ${DIM}所有配置已是最新${NC}`);
  }
  console.log("");

  return 0;
}
