import { getModelsDir } from "../config/paths";
import { loadModels } from "../config/model-config";
import { showBanner } from "./banner";
import { BOLD, GRN, YLW, NC } from "./colors";
import { getCmdName } from "../platform/detect";

export function showHelp(): void {
  const cmdName = getCmdName();
  const modelsDir = getModelsDir();
  const { models } = loadModels(modelsDir);

  showBanner();

  console.log(`  ${BOLD}用法:${NC}`);
  console.log("");
  console.log(`  ${GRN}${cmdName.padEnd(22)}${NC} 交互式选择模型启动`);
  console.log(`  ${GRN}${(cmdName + " <模型名>").padEnd(22)}${NC} 直接启动指定模型`);
  console.log(`  ${GRN}${(cmdName + " ls").padEnd(22)}${NC} 列出所有已配置模型`);
  console.log(`  ${GRN}${(cmdName + " add").padEnd(22)}${NC} 添加新模型配置`);
  console.log(`  ${GRN}${(cmdName + " edit [模型名]").padEnd(22)}${NC} 编辑已有模型配置`);
  console.log(`  ${GRN}${(cmdName + " remove [模型名]").padEnd(22)}${NC} 删除模型配置`);
  console.log(`  ${GRN}${(cmdName + " sync [模型名]").padEnd(22)}${NC} 同步 MCP/插件到指定模型`);
  console.log(`  ${GRN}${(cmdName + " upgrade").padEnd(22)}${NC} 为白名单模型补齐 [1m] 后缀`);
  console.log(`  ${GRN}${(cmdName + " update").padEnd(22)}${NC} 查看 Claude Code 版本固定信息`);
  console.log(`  ${GRN}${(cmdName + " reset").padEnd(22)}${NC} 重置所有配置`);
  console.log(`  ${GRN}${(cmdName + " -h").padEnd(22)}${NC} 显示此帮助`);
  console.log("");

  if (models.length > 0) {
    console.log(`  ${BOLD}已配置的模型:${NC}`);
    console.log("");
    const sorted = models.slice().sort((a, b) => a.alias.localeCompare(b.alias));
    for (const model of sorted) {
      console.log(
        `  ${GRN}·${NC} ${model.alias.padEnd(16)} ${model.settings.env.ANTHROPIC_MODEL || model.alias}`
      );
    }
  } else {
    console.log(
      `  ${YLW}暂无已配置的模型，使用 ${cmdName} add 添加${NC}`
    );
  }
  console.log("");
}
