import { loadWhitelist, addToWhitelist, removeFromWhitelist } from "../config/context-whitelist";
import { GRN, RED, DIM, BLU, NC } from "../ui/colors";
import { question } from "../ui/prompts";
import { openRawInput, RawKey } from "../ui/raw-input";

export async function whitelistCommand(_argv: string[]): Promise<number> {
  let list = loadWhitelist();

  while (true) {
    if (list.length === 0) {
      console.log(`\n${BLU}  1M 上下文模型白名单${NC}\n`);
      console.log(`  ${DIM}(空)${NC}\n`);
      console.log(`  ${DIM}a 添加  q 退出${NC}`);
      const key = await waitKey();
      if (key === "q") break;
      if (key === "a") {
        const modelId = await question("\n  模型 ID: ");
        if (modelId) {
          addToWhitelist(modelId);
          console.log(`  ${GRN}✓ 已添加 "${modelId}"${NC}\n`);
        }
      }
    } else {
      const result = await interactiveList(list);
      if (result === "quit") break;
      if (result === "add") {
        const modelId = await question("\n  模型 ID: ");
        if (modelId) {
          addToWhitelist(modelId);
          console.log(`  ${GRN}✓ 已添加 "${modelId}"${NC}\n`);
        }
      }
      if (typeof result === "string" && result !== "add" && result !== "quit") {
        removeFromWhitelist(result);
        console.log(`  ${GRN}✓ 已移除 "${result}"${NC}\n`);
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
      else resolve("");
    });
  });
}

function interactiveList(list: string[]): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) { resolve("quit"); return; }

    let selected = 0;
    const count = list.length;

    console.log(`\n${BLU}  1M 上下文模型白名单${NC}\n`);
    process.stdout.write("\x1b[?25l");

    let hintLine = "";
    function render() {
      if (hintLine) process.stdout.write(`\x1b[${count + 2}A`);
      else process.stdout.write(`\x1b[${count}A`);

      for (let i = 0; i < count; i++) {
        const line = i === selected
          ? `  ${RED}▶ ${list[i]}${NC}\x1b[K`
          : `    ${list[i]}\x1b[K`;
        console.log(line);
      }
      hintLine = `  ${DIM}↑↓ 选择  Enter/d 移除  a 添加  q 退出${NC}`;
      console.log("");
      console.log(hintLine + "\x1b[K");
    }

    const input = openRawInput();

    input.onKey((key: RawKey) => {
      if (key.name === "up") {
        selected = (selected - 1 + count) % count;
        render();
      } else if (key.name === "down") {
        selected = (selected + 1) % count;
        render();
      } else if (key.name === "return" || key.char === "d") {
        input.close();
        process.stdout.write("\x1b[?25h");
        resolve(list[selected]);
      } else if (key.char === "a") {
        input.close();
        process.stdout.write("\x1b[?25h");
        resolve("add");
      } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
        input.close();
        process.stdout.write("\x1b[?25h");
        resolve("quit");
      }
    });

    render();
  });
}
