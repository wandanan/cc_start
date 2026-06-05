import { getModelsDir } from "../config/paths";
import { loadModels } from "../config/model-config";

export function doctorCommand(args: string[]): number {
  const repair = args.includes("--repair");
  const modelsDir = getModelsDir();
  const { models, invalid } = loadModels(modelsDir, { repair });
  const repaired = models.filter((model) => model.repaired);

  console.log(`配置目录: ${modelsDir}`);
  console.log(`有效配置: ${models.length}`);
  console.log(`无效配置: ${invalid.length}`);
  if (repair) {
    console.log(`已修复: ${repaired.length}`);
  } else {
    console.log("提示: 使用 doctor --repair 自动迁移可修复的旧格式配置");
  }

  if (repaired.length > 0) {
    console.log("");
    console.log("已修复配置：");
    for (const model of repaired) {
      console.log(`- ${model.alias}`);
    }
  }

  if (invalid.length > 0) {
    console.log("");
    console.log("无效配置：");
    for (const item of invalid) {
      console.log(`- ${item.alias}: ${item.error}`);
    }
  }

  return invalid.length > 0 ? 1 : 0;
}
