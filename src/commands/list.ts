import { getModelsDir } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";

function printTable(models: ModelRecord[]): void {
  const aliasWidth = Math.max(12, ...models.map((model) => model.alias.length));
  console.log("命令名称".padEnd(aliasWidth + 2) + "模型 ID");
  console.log("─".repeat(aliasWidth) + "  " + "─".repeat(24));
  for (const model of models) {
    console.log(model.alias.padEnd(aliasWidth + 2) + model.settings.env.ANTHROPIC_MODEL);
  }
}

export function listCommand(): number {
  const modelsDir = getModelsDir();
  const { models, invalid } = loadModels(modelsDir, { repair: true });

  if (models.length === 0) {
    console.log("没有已配置的模型，使用 cc add 添加");
  } else {
    printTable(models);
  }

  if (invalid.length > 0) {
    console.log("");
    console.log(`跳过 ${invalid.length} 个无效配置：`);
    for (const item of invalid) {
      console.log(`- ${item.alias}: ${item.error}`);
    }
  }

  return invalid.length > 0 && models.length === 0 ? 1 : 0;
}
