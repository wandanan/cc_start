import fs from "node:fs";
import path from "node:path";
import { getModelsDir } from "../config/paths";
import { confirmExact } from "../ui/prompts";
import { RED, GRN, BOLD, DIM, BLU, NC } from "../ui/colors";
import { getCmdName } from "../platform/detect";

export async function resetCommand(): Promise<number> {
  const cmdName = getCmdName();
  const modelsDir = getModelsDir();

  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     重置所有模型配置              ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(`  ${RED}警告: 此操作将删除所有模型配置文件${NC}`);
  console.log(`  ${DIM}配置目录: ${modelsDir}${NC}`);
  console.log("");

  if (!(await confirmExact("  确认重置? 输入 yes 继续", "yes"))) {
    console.log("  已取消");
    return 1;
  }

  const files = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith(".json"));
  let count = 0;
  for (const f of files) {
    fs.unlinkSync(path.join(modelsDir, f));
    count++;
  }

  console.log("");
  console.log(`  ${GRN}✓ 已删除 ${count} 个配置文件${NC}`);
  console.log("");
  console.log(`  ${DIM}使用 ${cmdName} add 重新添加模型${NC}`);

  return 0;
}
