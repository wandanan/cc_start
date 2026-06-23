import { BLU, GRN, DIM, BOLD, NC } from "./colors";
import { openRawInput, RawKey } from "./raw-input";

export interface SearchOption {
  label: string;
  value: string;
  searchText: string;
  group?: string;
}

type DisplayLine =
  | { type: "header"; group: string }
  | { type: "item"; idx: number };

/**
 * fzf-style interactive search + arrow-key selector with group headers.
 * Type to filter, ↑↓ to navigate, Enter to confirm, Esc to cancel.
 * First Esc clears filter; second Esc cancels.
 */
export function searchSelect(
  prompt: string,
  options: SearchOption[],
  maxVisible = 12
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
      resolve(options[0].value);
      return;
    }

    let filterText = "";
    let selectedIdx = 0; // index into filtered[]
    let filtered = [...options];
    let displayScroll = 0; // scroll offset in display-line space
    let drawnLines = 0;

    // Take exclusive raw control of stdin (cleans up any readline/keypress state)
    const input = openRawInput();

    function applyFilter(): void {
      const lower = filterText.toLowerCase();
      if (lower === "") {
        filtered = [...options];
      } else {
        filtered = options.filter((opt) =>
          opt.searchText.includes(lower)
        );
      }
      selectedIdx = 0;
      displayScroll = 0;
    }

    function buildDisplayList(): DisplayLine[] {
      const result: DisplayLine[] = [];
      let lastGroup = "\x00"; // sentinel — never matches a real group
      for (let i = 0; i < filtered.length; i++) {
        const group = filtered[i].group || "";
        if (group && group !== lastGroup) {
          result.push({ type: "header", group });
          lastGroup = group;
        }
        result.push({ type: "item", idx: i });
      }
      return result;
    }

    function findSelectedDisplayPos(display: DisplayLine[]): number {
      for (let i = 0; i < display.length; i++) {
        const line = display[i];
        if (line.type === "item" && line.idx === selectedIdx) {
          return i;
        }
      }
      return 0;
    }

    function render(): void {
      const display = buildDisplayList();
      const selectedDisplayPos = findSelectedDisplayPos(display);

      // Scroll window in display-line space
      if (selectedDisplayPos < displayScroll) {
        displayScroll = selectedDisplayPos;
      } else if (selectedDisplayPos >= displayScroll + maxVisible) {
        displayScroll = selectedDisplayPos - maxVisible + 1;
      }

      // Clamp
      if (displayScroll < 0) displayScroll = 0;
      if (displayScroll > Math.max(0, display.length - 1)) {
        displayScroll = Math.max(0, display.length - 1);
      }

      // Compute per-group item numbers
      const groupIndex = new Map<number, number>();
      let lastGroup = "\x00";
      let counter = 0;
      for (let i = 0; i < filtered.length; i++) {
        const g = filtered[i].group || "";
        if (g !== lastGroup) {
          lastGroup = g;
          counter = 1;
        }
        groupIndex.set(i, counter);
        counter++;
      }

      if (drawnLines > 0) {
        process.stdout.write(`\x1b[${drawnLines}A`);
      }

      const visible = display.slice(displayScroll, displayScroll + maxVisible);
      let lines = 0;

      // Search prompt
      const cursor = "\x1b[7m \x1b[27m";
      const countInfo = filterText
        ? ` ${DIM}[${filtered.length}/${options.length}]${NC}`
        : ` ${DIM}[${options.length}]${NC}`;
      process.stdout.write(
        `\x1b[K  ${BLU}${prompt}${NC} ${filterText}${cursor}${countInfo}\n`
      );
      lines++;

      // Content window (always render maxVisible slots for stable height)
      for (let i = 0; i < maxVisible; i++) {
        if (i < visible.length) {
          const line = visible[i];
          if (line.type === "header") {
            process.stdout.write(`\x1b[K  ${DIM}${BOLD}[${line.group}]${NC}\n`);
          } else {
            const opt = filtered[line.idx];
            const num = groupIndex.get(line.idx) || 0;
            const numStr = String(num).padStart(2);
            const displayLabel = `${numStr} ${opt.label}`;
            const isSelected = line.idx === selectedIdx;
            if (isSelected) {
              process.stdout.write(`\x1b[K  ${GRN}▶ ${displayLabel}${NC}\n`);
            } else {
              process.stdout.write(`\x1b[K     ${displayLabel}\n`);
            }
          }
        } else {
          process.stdout.write(`\x1b[K\n`);
        }
        lines++;
      }

      // Footer: info line
      if (filtered.length === 0) {
        process.stdout.write(`\x1b[K  ${DIM}无匹配 — 修改筛选条件${NC}\n`);
      } else if (display.length > maxVisible) {
        const start = displayScroll + 1;
        const end = Math.min(displayScroll + maxVisible, display.length);
        process.stdout.write(`\x1b[K  ${DIM}${start}-${end} / ${display.length}${NC}\n`);
      } else {
        process.stdout.write(`\x1b[K\n`);
      }
      lines++;

      // Hint line (always visible)
      process.stdout.write(`\x1b[K  ${DIM}Tab 切换分组  Esc 返回菜单  ↑↓ 选择  输入筛选  回车确认${NC}\n`);
      lines++;

      drawnLines = lines;
    }

    function cleanup(): void {
      process.stdout.write("\x1b[?25h");
      input.close();
    }

    function moveSelection(delta: 1 | -1): void {
      if (filtered.length === 0) return;
      selectedIdx =
        (selectedIdx + delta + filtered.length) % filtered.length;

      // Recompute display to check if the new position is visible
      const display = buildDisplayList();
      const displayPos = findSelectedDisplayPos(display);
      if (displayPos < displayScroll) {
        displayScroll = displayPos;
      } else if (displayPos >= displayScroll + maxVisible) {
        displayScroll = displayPos - maxVisible + 1;
      }
    }

    function getGroupOrder(): string[] {
      const groups: string[] = [];
      const seen = new Set<string>();
      for (const item of filtered) {
        const g = item.group || "";
        if (!seen.has(g)) {
          groups.push(g);
          seen.add(g);
        }
      }
      return groups;
    }

    function findFirstInGroup(group: string): number {
      for (let i = 0; i < filtered.length; i++) {
        if ((filtered[i].group || "") === group) return i;
      }
      return 0;
    }

    function jumpToGroup(direction: 1 | -1): void {
      if (filtered.length === 0) return;

      const groups = getGroupOrder();
      const currentGroup = filtered[selectedIdx]?.group || "";
      const currentIdx = groups.indexOf(currentGroup);

      if (groups.length > 1) {
        const nextIdx = (currentIdx + direction + groups.length) % groups.length;
        selectedIdx = findFirstInGroup(groups[nextIdx]);
      } else {
        selectedIdx = direction === 1 ? 0 : filtered.length - 1;
      }

      const display = buildDisplayList();
      const displayPos = findSelectedDisplayPos(display);
      displayScroll = Math.max(0, displayPos - Math.floor(maxVisible / 3));

      render();
    }

    function onKey(key: RawKey): void {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        resolve(null);
        return;
      }

      if (key.name === "escape") {
        if (filterText.length > 0) {
          filterText = "";
          applyFilter();
          render();
        } else {
          cleanup();
          process.stdout.write("\n");
          resolve(null);
        }
        return;
      }

      if (key.name === "return") {
        cleanup();
        process.stdout.write("\n");
        if (filtered.length > 0 && selectedIdx < filtered.length) {
          resolve(filtered[selectedIdx].value);
        } else {
          resolve(null);
        }
        return;
      }

      if (key.name === "up") {
        moveSelection(-1);
        render();
        return;
      }

      if (key.name === "down") {
        moveSelection(1);
        render();
        return;
      }

      if (key.name === "tab") {
        jumpToGroup(key.shift ? -1 : 1);
        return;
      }

      // Number key: jump to Nth item within current group (only when filter is empty)
      if (
        !filterText &&
        key.char.length === 1 &&
        key.char >= "1" &&
        key.char <= "9"
      ) {
        const targetNum = parseInt(key.char, 10);
        const currentGroup = filtered[selectedIdx]?.group || "";
        const groupItems: number[] = [];
        for (let i = 0; i < filtered.length; i++) {
          if ((filtered[i].group || "") === currentGroup) {
            groupItems.push(i);
          }
        }
        if (targetNum <= groupItems.length) {
          selectedIdx = groupItems[targetNum - 1];
          const display = buildDisplayList();
          const displayPos = findSelectedDisplayPos(display);
          displayScroll = Math.max(0, displayPos - Math.floor(maxVisible / 3));
          render();
        }
        return;
      }

      if (key.name === "backspace") {
        if (filterText.length > 0) {
          filterText = filterText.slice(0, -1);
          applyFilter();
          render();
        }
        return;
      }

      if (key.char) {
        filterText += key.char;
        applyFilter();
        render();
      }
    }

    process.stdout.write("\x1b[?25l");
    applyFilter();
    render();
    input.onKey(onKey);
  });
}
