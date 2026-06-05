import { CYA, BOLD, DIM, NC } from "./colors";

const BANNER = [
  "  _____  _____         _____  _______   ___      _____  _______ ",
  "  / ____|/ ____|       / ____||__   __| /   \\    |  __ \\|__   __|",
  " | |    | |           | (___     | |   /  ^  \\   | |__) |  | |   ",
  " | |    | |            \\___ \\    | |  /  /_\\  \\  |  _  /   | |   ",
  " | |____| |____        ____) |   | | /  _____  \\ | | \\ \\   | |   ",
  "  \\_____|\\_____|      |_____/    |_|/__/     \\__\\|_|  \\_\\  |_|   ",
  "                                    |__|     |__|                ",
];

export function showBanner(): void {
  console.log(CYA);
  for (const line of BANNER) {
    console.log(line);
  }
  console.log(NC);
  console.log(`${BOLD}  多模型，一个工具就够了${NC}`);
  console.log("");
}
