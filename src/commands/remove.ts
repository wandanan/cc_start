import fs from "node:fs";
import path from "node:path";
import { getModelsDir } from "../config/paths";
import { loadModels } from "../config/model-config";
import { selectModel } from "../ui/menu";
import { confirm } from "../ui/prompts";
import { RED, GRN, BOLD, DIM, NC } from "../ui/colors";

export async function removeCommand(modelName?: string): Promise<number> {
  const modelsDir = getModelsDir();

  if (!modelName) {
    console.log("");
    console.log(`${RED}╔═══════════════════════════════════╗${NC}`);
    console.log(`${RED}║     删除模型配置                  ║${NC}`);
    console.log(`${RED}╚═══════════════════════════════════╝${NC}`);
    console.log("");

    const selected = await selectModel("选择要删除的模型");
    if (!selected) return 1;
    modelName = selected;
  }

  const configPath = path.join(modelsDir, `${modelName}.json`);
  if (!fs.existsSync(configPath)) {
    console.log(`${RED}✗ 模型 '${modelName}' 不存在${NC}`);
    return 1;
  }

  const { models } = loadModels(modelsDir);
  const model = models.find((m) => m.alias === modelName);
  const modelDesc = model?.settings.env.ANTHROPIC_MODEL || modelName;

  console.log("");
  console.log(`  ${BOLD}确认删除:${NC}`);
  console.log(`    命令名称:  ${RED}${modelName}${NC}`);
  console.log(`    模型 ID:   ${modelDesc}`);
  console.log(`    配置文件:  ${DIM}${configPath}${NC}`);
  console.log("");

  if (!(await confirm(`  ${RED}确定删除?${NC}`, false))) {
    console.log("  已取消");
    return 1;
  }

  fs.unlinkSync(configPath);
  console.log("");
  console.log(`  ${GRN}✓ 模型 '${modelName}' 已删除${NC}`);

  return 0;
}
