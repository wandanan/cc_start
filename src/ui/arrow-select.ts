import { GRN, NC } from "./colors";
import { openRawInput, RawKey } from "./raw-input";

export interface ArrowOption {
  label: string;
  value: string;
}

export function arrowSelect(
  prompt: string,
  options: ArrowOption[]
): Promise<string | null> {
  return new Promise((resolve) => {
    if (options.length === 0) {
      resolve(null);
      return;
    }

    if (!process.stdin.isTTY) {
      for (const opt of options) {
        console.log(`    ${opt.label}`);
      }
      resolve(options[0]?.value ?? null);
      return;
    }

    let selected = 0;
    const count = options.length;

    console.log(`\n\x1b[34m${prompt} (↑↓选择, 回车确认):\x1b[0m`);
    process.stdout.write("\x1b[?25l"); // hide cursor

    function render(): void {
      for (let i = 0; i < count; i++) {
        if (i === selected) {
          console.log(`  ${GRN}▶ ${options[i].label}${NC}\x1b[K`);
        } else {
          console.log(`    ${options[i].label}\x1b[K`);
        }
      }
    }

    const input = openRawInput();

    function cleanup(): void {
      process.stdout.write("\x1b[?25h"); // show cursor
      input.close();
    }

    function onKey(key: RawKey): void {
      if (key.name === "up") {
        selected = (selected - 1 + count) % count;
        process.stdout.write(`\x1b[${count}A`);
        render();
      } else if (key.name === "down") {
        selected = (selected + 1) % count;
        process.stdout.write(`\x1b[${count}A`);
        render();
      } else if (key.name === "return") {
        cleanup();
        console.log(""); // final newline
        resolve(options[selected]?.value ?? null);
      } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
        cleanup();
        console.log("");
        resolve(null);
      }
    }

    render();
    input.onKey(onKey);
  });
}
