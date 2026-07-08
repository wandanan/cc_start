import { GRN, YLW, RED, BLU, DIM, NC } from "./colors";
import { openRawInput, RawKey } from "./raw-input";
import { SessionMeta, FlatItem, SessionResult, isForked } from "../commands/fork";

// ── Rendering ──

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) return `${m[2]}-${m[3]}`;
  return iso.slice(0, 10);
}

function renderItem(item: FlatItem, selected: boolean): string {
  const { meta, depth, ancestors, isLastChild } = item;
  const fork = isForked(meta);

  let prefix = "";
  for (let d = 0; d < depth; d++) {
    prefix += ancestors[d] ? "  │ " : "    ";
  }
  if (depth > 0) {
    prefix += isLastChild ? "  └─ " : "  ├─ ";
  }

  const icon = fork ? "🔀" : "📝";
  const metaStr = `[${meta.lines} 行 · ${formatDate(meta.lastActivity)}]`;
  const cols = process.stdout.columns || 100;
  const maxTitle = cols - (depth * 4 + 10 + metaStr.length + 12);
  const title = truncate(meta.title, Math.max(maxTitle, 15));

  if (fork) {
    if (selected) {
      return prefix + `  ${DIM}▸ ${icon} ${title}${NC}  ${DIM}${metaStr}${NC}`;
    }
    return prefix + `    ${icon} ${title}  ${DIM}${metaStr}${NC}`;
  }
  if (selected) {
    return prefix + `  ${GRN}▶ ${icon} ${title}${NC}  ${DIM}${metaStr}${NC}`;
  }
  return prefix + `    ${icon} ${title}  ${DIM}${metaStr}${NC}`;
}

function getHint(item: FlatItem | null): string {
  if (!item) return `  ${DIM}↑↓ 移动  Enter 选择  q 退出${NC}`;
  if (isForked(item.meta)) {
    return `  ${DIM}↑↓ 移动  ${YLW}p 提升为主会话${DIM}  Enter 不可选  q 退出${NC}`;
  }
  return `  ${DIM}↑↓ 移动  ${GRN}Enter 选择${DIM}  q 退出${NC}`;
}

// ── Selection ──

export function forkTreeSelect(flat: FlatItem[]): Promise<SessionResult> {
  return new Promise((resolve) => {
    if (flat.length === 0) {
      resolve({ sessionId: null, promoted: null });
      return;
    }

    if (!process.stdin.isTTY) {
      for (const item of flat) {
        console.log(renderItem(item, false));
      }
      const firstRoot = flat.find((f) => !isForked(f.meta));
      resolve({ sessionId: firstRoot?.meta.sessionId ?? null, promoted: null });
      return;
    }

    let selected = 0;
    const count = flat.length;
    let hintLine = "";

    console.log(`${BLU}? 选择要分叉的会话:${NC}`);
    process.stdout.write("\x1b[?25l");

    function render() {
      if (hintLine) process.stdout.write(`\x1b[${count + 2}A`);
      else process.stdout.write(`\x1b[${count}A`);

      for (let i = 0; i < count; i++) {
        console.log(renderItem(flat[i], i === selected) + "\x1b[K");
      }
      hintLine = getHint(flat[selected] ?? null);
      console.log("");
      console.log(hintLine + "\x1b[K");
    }

    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    function showFlash(msg: string) {
      if (flashTimer) clearTimeout(flashTimer);
      process.stdout.write(`\x1b[1A\x1b[K  ${RED}${msg}${NC}`);
      flashTimer = setTimeout(() => {
        process.stdout.write(`\x1b[1A\x1b[K${hintLine}`);
        flashTimer = null;
      }, 2000);
    }

    const input = openRawInput();

    function onKey(key: RawKey) {
      if (key.name === "up") {
        selected = (selected - 1 + count) % count;
        render();
      } else if (key.name === "down") {
        selected = (selected + 1) % count;
        render();
      } else if (key.name === "return") {
        const current = flat[selected];
        if (current && isForked(current.meta)) {
          showFlash("✗ 此会话是分叉会话，请先按 p 提升为主会话");
        } else if (current) {
          input.close();
          process.stdout.write("\x1b[?25h");
          process.stdout.write(`\x1b[${count + 2}A\x1b[J`);
          resolve({ sessionId: current.meta.sessionId, promoted: null });
        }
      } else if (key.name === "p") {
        const current = flat[selected];
        if (current && isForked(current.meta)) {
          input.close();
          process.stdout.write("\x1b[?25h");
          resolve({ sessionId: null, promoted: current.meta.sessionId });
        }
      } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
        input.close();
        process.stdout.write("\x1b[?25h");
        process.stdout.write(`\x1b[${count + 2}A\x1b[J`);
        resolve({ sessionId: null, promoted: null });
      }
    }

    render();
    input.onKey(onKey);
  });
}
