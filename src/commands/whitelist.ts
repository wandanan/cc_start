import { loadWhitelist, addToWhitelist, removeFromWhitelist } from "../config/context-whitelist";
import { GRN, YLW, RED, DIM, BLU, NC } from "../ui/colors";
import { question } from "../ui/prompts";
import { openRawInput, RawKey } from "../ui/raw-input";

export async function whitelistCommand(_argv: string[]): Promise<number> {
  let list = loadWhitelist();

  while (true) {
    console.log(`\n${BLU}  1M 上下文模型白名单${NC}\n`);
    if (list.length === 0) {
      console.log(`  ${DIM}(空)${NC}\n`);
    } else {
      list.forEach((id) => console.log(`  ${GRN}•${NC} ${id}`));
      console.log("");
    }
    console.log(`  ${DIM}a 添加${NC}    ${DIM}d 删除${NC}    ${DIM}q 退出${NC}`);

    const key = await waitKey();

    if (key === "q") break;

    if (key === "a") {
      const modelId = await question("\n  模型 ID: ");
      if (modelId) {
        addToWhitelist(modelId);
        console.log(`  ${GRN}✓ 已添加 "${modelId}"${NC}`);
      }
    }

    if (key === "d" && list.length > 0) {
      const removed = await selectToRemove(list);
      if (removed) {
        removeFromWhitelist(removed);
        console.log(`  ${GRN}✓ 已移除 "${removed}"${NC}`);
      }
    }

    list = loadWhitelist();
  }

  console.log("");
  return 0;
}

function waitKey(): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) { resolve("q"); return; }
    process.stdout.write("\x1b[?25l");
    const input = openRawInput();
    input.onKey((key: RawKey) => {
      input.close();
      process.stdout.write("\x1b[?25h");
      if (key.name === "q" || (key.ctrl && key.name === "c")) resolve("q");
      else if (key.char === "a") resolve("a");
      else if (key.char === "d") resolve("d");
      else if (key.name === "return") resolve("enter");
      else resolve("");
    });
  });
}

async function selectToRemove(list: string[]): Promise<string | null> {
  if (!process.stdin.isTTY) return null;

  return new Promise((resolve) => {
    let selected = 0;
    const count = list.length;

    console.log(`\n${BLU}? 选择要移除的模型 (↑↓ 选择, Enter 确认, q 取消):${NC}\n`);
    process.stdout.write("\x1b[?25l");

    function render() {
      for (let i = 0; i < count; i++) {
        if (i === selected) {
          console.log(`  ${RED}▶ ${list[i]}${NC}\x1b[K`);
        } else {
          console.log(`    ${list[i]}\x1b[K`);
        }
      }
    }

    const input = openRawInput();

    input.onKey((key: RawKey) => {
      if (key.name === "up") {
        selected = (selected - 1 + count) % count;
        process.stdout.write(`\x1b[${count}A`);
        render();
      } else if (key.name === "down") {
        selected = (selected + 1) % count;
        process.stdout.write(`\x1b[${count}A`);
        render();
      } else if (key.name === "return") {
        input.close();
        process.stdout.write("\x1b[?25h");
        console.log("");
        resolve(list[selected]);
      } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
        input.close();
        process.stdout.write("\x1b[?25h");
        console.log("");
        resolve(null);
      }
    });

    render();
  });
}
