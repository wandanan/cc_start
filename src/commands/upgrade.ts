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
import { applyOneMillionPolicy } from "../providers/one-million";
import { BLU, GRN, YLW, DIM, NC } from "../ui/colors";

export function upgradeCommand(): number {
  const modelsDir = getModelsDir();

  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     升级模型配置                  ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(`  ${DIM}扫描并补齐 1M 白名单模型的 [1m] 后缀...${NC}`);
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

    // repairModelConfig(write:false) 已在内存中应用了 1M 白名单策略
    // （normalizeModelSettings → applyOneMillionPolicy），此处再次调用
    // 只会得到"无变化"。因此直接比较内存 env 与磁盘 env，有差异才写回。
    applyOneMillionPolicy(settings);
    let onDiskEnv = "";
    try {
      const raw = readJsonObject(file);
      onDiskEnv = JSON.stringify(raw.env ?? {});
    } catch {
      // 读取失败按"有差异"处理，交给下方写回
    }
    if (JSON.stringify(settings.env) !== onDiskEnv) {
      writeJsonObject(file, settings as unknown as Record<string, unknown>);
      upgraded++;
      console.log(`  ${GRN}✓${NC} ${name} → 已补齐 [1m] 后缀`);
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
