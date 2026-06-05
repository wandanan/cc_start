import { getModelsDir } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";
import { showBanner } from "./banner";
import { question } from "./prompts";
import { BLU, GRN, YLW, RED, NC } from "../ui/colors";
import { getCmdName } from "../platform/detect";

type MenuAction =
  | { type: "launch"; model: ModelRecord }
  | { type: "add" }
  | { type: "edit" }
  | { type: "remove" }
  | { type: "update" }
  | { type: "help" }
  | { type: "quit" }
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

  // Sort by alias
  const sorted = models.slice().sort((a, b) => a.alias.localeCompare(b.alias));

  let i = 1;
  for (const model of sorted) {
    console.log(
      `  ${GRN}${i})${NC}  ${model.alias.padEnd(14)} ${model.settings.env.ANTHROPIC_MODEL || model.alias}`
    );
    i++;
  }
  console.log(`  ${YLW}q)${NC}  取消`);
  console.log("");

  const choice = await question(`  ${promptText} (编号/名称): `);
  if (!choice || choice.toLowerCase() === "q") {
    return null;
  }

  const num = parseInt(choice, 10);
  if (!isNaN(num) && num >= 1 && num <= sorted.length) {
    return sorted[num - 1].alias;
  }

  const byName = sorted.find((m) => m.alias === choice);
  if (byName) {
    return byName.alias;
  }

  console.log(`${RED}  无效选择${NC}`);
  return null;
}

export async function interactiveMenu(): Promise<MenuAction> {
  const modelsDir = getModelsDir();
  const { models } = loadModels(modelsDir);

  showBanner();

  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     请选择模型                    ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");

  const sorted = models.slice().sort((a, b) => a.alias.localeCompare(b.alias));

  let i = 1;
  for (const model of sorted) {
    console.log(
      `  ${GRN}${i})${NC}  ${model.alias.padEnd(14)} ${model.settings.env.ANTHROPIC_MODEL || model.alias}`
    );
    i++;
  }

  console.log("");
  console.log(`  ${YLW}q)${NC}  退出        ${YLW}e)${NC}  编辑模型配置`);
  console.log(`  ${YLW}a)${NC}  添加新模型  ${YLW}r)${NC}  删除模型`);
  console.log(`  ${YLW}u)${NC}  升级 Claude  ${YLW}h)${NC}  查看帮助`);
  console.log("");

  const choice = await question(
    "  请输入编号或名称 (q=退出 a=添加 e=编辑 r=删除 u=升级 h=帮助): "
  );

  if (!choice) {
    return { type: "invalid" };
  }

  const lower = choice.toLowerCase();

  if (lower === "q") return { type: "quit" };
  if (lower === "a") return { type: "add" };
  if (lower === "e") return { type: "edit" };
  if (lower === "r") return { type: "remove" };
  if (lower === "u") return { type: "update" };
  if (lower === "h") return { type: "help" };

  const num = parseInt(choice, 10);
  if (!isNaN(num) && num >= 1 && num <= sorted.length) {
    return { type: "launch", model: sorted[num - 1] };
  }

  const byName = sorted.find((m) => m.alias === choice);
  if (byName) {
    return { type: "launch", model: byName };
  }

  return { type: "invalid" };
}
