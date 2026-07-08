import { loadWhitelist, addToWhitelist, removeFromWhitelist } from "../config/context-whitelist";
import { GRN, YLW, RED, DIM, BLU, NC } from "../ui/colors";
import { question, confirm } from "../ui/prompts";

export async function whitelistCommand(argv: string[]): Promise<number> {
  const sub = argv[0];

  if (sub === "add") {
    const modelId = argv[1] || (await question("  模型 ID: "));
    if (!modelId) {
      console.log(`\n  ${DIM}已取消${NC}\n`);
      return 0;
    }
    addToWhitelist(modelId);
    console.log(`\n  ${GRN}✓ 已添加 "${modelId}" 到 1M 上下文白名单${NC}\n`);
    return 0;
  }

  if (sub === "remove" || sub === "rm") {
    const list = loadWhitelist();
    if (list.length === 0) {
      console.log(`\n  ${DIM}白名单为空${NC}\n`);
      return 0;
    }

    let modelId = argv[1];
    if (!modelId) {
      // Show list for selection
      console.log(`\n  ${BLU}当前白名单:${NC}\n`);
      list.forEach((id, i) => console.log(`    ${i + 1}. ${id}`));
      console.log("");
      const input = await question("  输入要移除的模型 ID 或序号: ");
      if (!input) {
        console.log(`\n  ${DIM}已取消${NC}\n`);
        return 0;
      }
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= list.length) {
        modelId = list[num - 1];
      } else {
        modelId = input;
      }
    }

    const exists = list.includes(modelId);
    if (!exists) {
      console.log(`\n  ${RED}✗ "${modelId}" 不在白名单中${NC}\n`);
      return 1;
    }

    const ok = await confirm(`  确认移除 "${modelId}"?`);
    if (!ok) {
      console.log(`\n  ${DIM}已取消${NC}\n`);
      return 0;
    }
    removeFromWhitelist(modelId);
    console.log(`\n  ${GRN}✓ 已从白名单移除 "${modelId}"${NC}\n`);
    return 0;
  }

  // Default: show whitelist
  const list = loadWhitelist();
  console.log(`\n${BLU}  1M 上下文模型白名单${NC}\n`);
  if (list.length === 0) {
    console.log(`  ${DIM}(空)${NC}\n`);
  } else {
    list.forEach((id) => console.log(`  ${GRN}•${NC} ${id}`));
    console.log("");
  }
  console.log(`  ${DIM}用法: cc whitelist add <model>   |   cc whitelist remove${NC}\n`);
  return 0;
}
