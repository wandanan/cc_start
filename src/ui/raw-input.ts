import { closePrompt } from "./prompts";

/**
 * A normalized key parsed from a raw stdin byte stream.
 * - `name`: logical key ("up", "down", "return", "escape", "tab", "backspace",
 *   "delete", "home", "end", "pageup", "pagedown", a single lowercase letter
 *   for ctrl combos, or "" for a plain printable / multibyte char).
 * - `char`: the printable character(s) (UTF-8), or "" for control keys.
 * - `ctrl` / `shift`: modifier flags.
 */
export interface RawKey {
  name: string;
  ctrl: boolean;
  shift: boolean;
  char: string;
}

export interface RawInputHandle {
  /** Register a handler invoked for each parsed key. */
  onKey: (handler: (key: RawKey) => void) => void;
  /** Detach the data listener and restore prior raw-mode state. Does not pause. */
  close: () => void;
}

/**
 * Take exclusive control of stdin in raw mode.
 *
 * Reads raw `data` events and parses keystrokes ourselves instead of relying on
 * `readline.emitKeypressEvents` / `keypress` events. The keypress machinery is
 * installed by `readline.createInterface` and is effectively a one-way global
 * transform on the stream; mixing it with repeated raw-mode components left
 * stdin frozen on re-entry (especially on Windows Git Bash). Reading `data`
 * directly gives each component full, isolated ownership of its listener.
 */
export function openRawInput(): RawInputHandle {
  // Tear down any readline interface that is managing stdin (left over from
  // `question()`).
  closePrompt();
  // ⚠ 绝不能 removeAllListeners("data")：Node readline 会在 stdin 上安装
  // 按键转换器（data → keypress），question() 依赖它。该转换器的恢复钩子
  // （newListener）只在首次安装时触发一次——若在这里删掉转换器，之后
  // question() 新建的 Interface 将永远收不到 keypress，输入直接卡死
  // （whitelist 连续添加两次模型必现）。
  // 我们的 onData 与 readline 转换器可以共存：没有打开的 Interface 时，
  // 转换器 emit 的 keypress 无人监听，无任何副作用；close() 时我们只移除
  // 自己的监听器，转换器始终保留，后续 question() 永远可用。
  if (process.stdin.isPaused()) process.stdin.resume();

  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();

  const handlers: Array<(key: RawKey) => void> = [];
  // 组件 resolve/cleanup 后置位：parseKeys 可能从一个 chunk 解析出多个按键
  // （如 Esc 紧跟一个普通字符）。一旦本输入上下文关闭，同一 chunk 内剩余
  // 按键必须丢弃，否则会送到已失效的 handler 产生副作用。
  let closed = false;

  function onData(chunk: Buffer): void {
    for (const key of parseKeys(chunk)) {
      if (closed) return;
      // Copy in case a handler (un)registers during dispatch.
      for (const h of handlers.slice()) h(key);
    }
  }

  process.stdin.on("data", onData);

  return {
    onKey(handler: (key: RawKey) => void): void {
      handlers.push(handler);
    },
    close(): void {
      closed = true;
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(wasRaw ?? false);
      // Intentionally do not pause — keep stdin flowing for the next component.
    },
  };
}

const K = (name: string, char = "", ctrl = false, shift = false): RawKey => ({
  name,
  char,
  ctrl,
  shift,
});

function parseKeys(chunk: Buffer): RawKey[] {
  const keys: RawKey[] = [];
  let i = 0;
  while (i < chunk.length) {
    const b = chunk[i];

    // ESC / escape sequences
    if (b === 0x1b) {
      if (i + 1 >= chunk.length) {
        keys.push(K("escape"));
        i++;
        continue;
      }
      const next = chunk[i + 1];
      if (next === 0x5b /* [ */) {
        const r = parseCSI(chunk, i);
        if (r) {
          keys.push(r.key);
          i = r.next;
          continue;
        }
      } else if (next === 0x4f /* O */) {
        const r = parseSS3(chunk, i);
        if (r) {
          keys.push(r.key);
          i = r.next;
          continue;
        }
      }
      // Bare ESC followed by something we don't recognize — treat as Escape.
      keys.push(K("escape"));
      i++;
      continue;
    }

    if (b === 0x09) { keys.push(K("tab")); i++; continue; } // Tab
    if (b === 0x0d || b === 0x0a) { keys.push(K("return")); i++; continue; } // Enter
    if (b === 0x7f || b === 0x08) { keys.push(K("backspace")); i++; continue; } // BS / DEL
    if (b >= 0x01 && b <= 0x1a) { // Ctrl+letter
      keys.push(K(String.fromCharCode(b + 96), "", true));
      i++;
      continue;
    }
    if (b >= 0x20 && b <= 0x7e) { // ASCII printable
      const ch = String.fromCharCode(b);
      keys.push(K(ch.toLowerCase(), ch, false, b >= 0x41 && b <= 0x5a));
      i++;
      continue;
    }
    // UTF-8 multibyte (b >= 0x80) — decode the full codepoint
    const len = utf8Len(b);
    const char = chunk.subarray(i, i + len).toString("utf8");
    keys.push(K("", char));
    i += len;
  }
  return keys;
}

function utf8Len(b: number): number {
  if (b >= 0xf0) return 4;
  if (b >= 0xe0) return 3;
  if (b >= 0xc0) return 2;
  return 1;
}

function parseCSI(
  chunk: Buffer,
  i: number
): { key: RawKey; next: number } | null {
  // chunk[i] = ESC, chunk[i+1] = '['
  let j = i + 2;
  let params = "";
  while (j < chunk.length) {
    const c = chunk[j];
    if (c >= 0x30 && c <= 0x3f) {
      // 0-9 ; : < = > ?
      params += String.fromCharCode(c);
      j++;
    } else {
      break;
    }
  }
  if (j >= chunk.length) return null; // incomplete sequence
  const fin = chunk[j];
  const next = j + 1;
  switch (fin) {
    case 0x41: return { key: K("up"), next };
    case 0x42: return { key: K("down"), next };
    case 0x43: return { key: K("right"), next };
    case 0x44: return { key: K("left"), next };
    case 0x48: return { key: K("home"), next };
    case 0x46: return { key: K("end"), next };
    case 0x5a: return { key: K("tab", "", false, true), next }; // Shift+Tab
    case 0x7e /* ~ */:
      switch (params) {
        case "3": return { key: K("delete"), next };
        case "1": case "7": return { key: K("home"), next };
        case "4": case "8": return { key: K("end"), next };
        case "5": return { key: K("pageup"), next };
        case "6": return { key: K("pagedown"), next };
        case "2": return { key: K("insert"), next };
        default: return null;
      }
    default:
      return null;
  }
}

function parseSS3(
  chunk: Buffer,
  i: number
): { key: RawKey; next: number } | null {
  // chunk[i] = ESC, chunk[i+1] = 'O'
  const fin = chunk[i + 2];
  if (fin === undefined) return null;
  const next = i + 3;
  switch (fin) {
    case 0x41: return { key: K("up"), next };
    case 0x42: return { key: K("down"), next };
    case 0x43: return { key: K("right"), next };
    case 0x44: return { key: K("left"), next };
    case 0x48: return { key: K("home"), next };
    case 0x46: return { key: K("end"), next };
    default: return null;
  }
}
