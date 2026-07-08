import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getProjectSessionsDir, getModelsDir } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";
import { selectModel } from "../ui/menu";
import { forkTreeSelect } from "../ui/fork-select";
import { launchClaude } from "../launcher/launch";
import { openRawInput, RawKey } from "../ui/raw-input";
import { closePrompt } from "../ui/prompts";
import { GRN, YLW, RED, BOLD, BLU, CYA, DIM, NC } from "../ui/colors";

// ── Types ──

export interface SessionMeta {
  file: string;
  sessionId: string;
  title: string;
  lines: number;
  lastActivity: string;
  parentSessionId: string | null;
  parentTitle: string | null;
  forkedAt: string | null;
}

export interface ForkTreeNode {
  meta: SessionMeta;
  children: ForkTreeNode[];
}

export interface FlatItem {
  meta: SessionMeta;
  depth: number;
  isLastChild: boolean;
  ancestors: boolean[];
}

export interface SessionResult {
  sessionId: string | null;
  promoted: string | null;
}

// ── Helpers ──

export function isForked(meta: SessionMeta): boolean {
  return meta.parentSessionId !== null;
}

function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) return `${m[2]}-${m[3]}`;
  return iso.slice(0, 10);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

// ── Session scanning ──

export function scanSessions(projectDir: string): SessionMeta[] {
  if (!fs.existsSync(projectDir)) return [];

  return fs
    .readdirSync(projectDir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((file) => {
      const fullPath = path.join(projectDir, file);
      const sessionId = path.basename(file, ".jsonl");
      const content = fs.readFileSync(fullPath, "utf-8");
      const lineCount = content.split("\n").filter(Boolean).length;
      let title = sessionId.slice(0, 8) + "...";
      let lastActivity = "";
      let parentSessionId: string | null = null;
      let parentTitle: string | null = null;
      let forkedAt: string | null = null;

      let lastTimestamp = "";
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === "fork-source") {
            parentSessionId = obj.parentSessionId ?? null;
            parentTitle = obj.parentTitle ?? null;
            forkedAt = obj.forkedAt ?? null;
          }
          if (obj.type === "ai-title") {
            title = obj.aiTitle || title;
          }
          if (obj.timestamp) {
            lastTimestamp = obj.timestamp;
          }
        } catch {
          // skip unparseable lines
        }
      }

      lastActivity = lastTimestamp || "unknown";

      return { file: fullPath, sessionId, title, lines: lineCount, lastActivity, parentSessionId, parentTitle, forkedAt };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

// ── Fork tree building ──

export function buildForkTree(sessions: SessionMeta[]): ForkTreeNode[] {
  const nodeMap = new Map<string, ForkTreeNode>();
  const roots: ForkTreeNode[] = [];

  for (const s of sessions) {
    nodeMap.set(s.sessionId, { meta: s, children: [] });
  }

  for (const s of sessions) {
    const node = nodeMap.get(s.sessionId)!;
    if (s.parentSessionId && nodeMap.has(s.parentSessionId)) {
      nodeMap.get(s.parentSessionId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (node: ForkTreeNode) => {
    node.children.sort((a, b) => b.meta.lastActivity.localeCompare(a.meta.lastActivity));
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);
  return roots;
}

export function flattenTree(nodes: ForkTreeNode[], depth: number, ancestors: boolean[]): FlatItem[] {
  const result: FlatItem[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const isLast = i === nodes.length - 1;
    result.push({ meta: nodes[i].meta, depth, isLastChild: isLast, ancestors: [...ancestors, !isLast] });
    if (nodes[i].children.length > 0) {
      result.push(...flattenTree(nodes[i].children, depth + 1, [...ancestors, !isLast]));
    }
  }
  return result;
}

// ── File operations ──

export function executeFork(meta: SessionMeta, modelAlias: string): string {
  const newId = crypto.randomUUID();
  const projectDir = path.dirname(meta.file);
  const newFile = path.join(projectDir, newId + ".jsonl");
  const tmpFile = newFile + ".tmp";

  try {
    if (!fs.existsSync(meta.file)) {
      throw new Error("源会话文件不存在");
    }

    const originalContent = fs.readFileSync(meta.file, "utf-8");
    const lines = originalContent.split("\n");

    const parsedLines = lines.map((line) => {
      if (!line.trim()) return { raw: line, parsed: null as Record<string, unknown> | null };
      try { return { raw: line, parsed: JSON.parse(line) as Record<string, unknown> }; }
      catch { return { raw: line, parsed: null as Record<string, unknown> | null }; }
    });

    // Step 1: Replace all sessionId references
    const replaced = parsedLines.map((pl) => {
      const newRaw = pl.raw.replaceAll(meta.sessionId, newId);
      // Also update the parsed object so later JSON.stringify doesn't reintroduce old IDs
      if (pl.parsed) {
        const reParsed = JSON.parse(newRaw) as Record<string, unknown>;
        return { raw: newRaw, parsed: reParsed };
      }
      return { raw: newRaw, parsed: pl.parsed };
    });

    // Step 2: Insert fork-source record at line 2
    const forkSourceRecord = JSON.stringify({
      type: "fork-source",
      parentSessionId: meta.sessionId,
      parentTitle: meta.title,
      forkedAt: new Date().toISOString(),
    });
    replaced.splice(1, 0, { raw: forkSourceRecord, parsed: JSON.parse(forkSourceRecord) });

    // Step 3: Update aiTitle on last ai-title record
    for (let i = replaced.length - 1; i >= 0; i--) {
      if (replaced[i].parsed && replaced[i].parsed!.type === "ai-title") {
        const obj = replaced[i].parsed!;
        const currentTitle = (obj.aiTitle as string) || meta.title;
        obj.aiTitle = currentTitle + ` [分列·${modelAlias}]`;
        replaced[i].raw = JSON.stringify(obj);
        break;
      }
    }

    const content = replaced.map((pl) => pl.raw).join("\n");
    fs.writeFileSync(tmpFile, content, "utf-8");
    fs.renameSync(tmpFile, newFile);

    return newId;
  } catch (err) {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    try { if (fs.existsSync(newFile)) fs.unlinkSync(newFile); } catch { /* ignore */ }
    throw err;
  }
}

export function promoteSession(meta: SessionMeta): void {
  // Backup original
  const backupPath = meta.file + `.bak-${timestamp()}`;
  fs.copyFileSync(meta.file, backupPath);

  // Find and remove fork-source line
  const content = fs.readFileSync(meta.file, "utf-8");
  const lines = content.split("\n");
  const forkSourceIdx = lines.findIndex((line) => {
    if (!line.trim()) return false;
    try {
      return JSON.parse(line).type === "fork-source";
    } catch {
      return false;
    }
  });

  if (forkSourceIdx === -1) return;

  lines.splice(forkSourceIdx, 1);
  fs.writeFileSync(meta.file, lines.join("\n"), "utf-8");
}

function resetStdin(): void {
  closePrompt();
  process.stdin.removeAllListeners("data");
  if (process.stdin.isPaused()) process.stdin.resume();
}

// ── Raw-mode confirm (avoids readline/raw stdin conflicts on Windows) ──

function confirmRaw(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const input = openRawInput();

    function onKey(key: RawKey) {
      if (key.char === "y" || key.char === "Y") {
        input.close();
        process.stdout.write("y\n");
        resolve(true);
      } else if (key.char === "n" || key.char === "N") {
        input.close();
        process.stdout.write("n\n");
        resolve(false);
      } else if (key.name === "return") {
        input.close();
        process.stdout.write("\n");
        resolve(false);
      } else if (key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) {
        input.close();
        process.stdout.write("\n");
        resolve(false);
      }
    }

    input.onKey(onKey);
  });
}

// ── Main command (stub — C02 fills in the rest) ──

export async function forkCommand(argv: string[]): Promise<number> {
  // Parse CLI args
  const args = argv.filter((a) => a !== "--no-launch" && a !== "--last");
  const isLast = argv.includes("--last");
  const noLaunch = argv.includes("--no-launch");
  const modelArg = args.length > 0 ? args[0] : null;

  // Get project sessions directory
  const projectDir = getProjectSessionsDir();

  // Scan sessions
  console.log(`\n  ${BLU}⏳ 扫描对话记录...${NC}`);
  let sessions = scanSessions(projectDir);

  if (sessions.length === 0) {
    console.log(`\n  ${RED}📭 当前项目没有对话记录。请先使用 cc <model> 开始一次对话。${NC}\n`);
    return 1;
  }

  // Load models
  const modelsDir = getModelsDir();
  const { models } = loadModels(modelsDir);

  if (models.length === 0) {
    console.log(`  ${YLW}⚠  没有已配置的模型，请先使用 cc add 添加${NC}\n`);
    return 1;
  }

  // Resolve target model from CLI arg
  let modelAlias: string | null = modelArg;
  let modelRecord: ModelRecord | null = null;

  if (modelAlias) {
    modelRecord = models.find((m) => m.alias === modelAlias) ?? null;
    if (!modelRecord) {
      console.log(`  ${RED}✗ 未找到模型: ${modelAlias}${NC}\n`);
      return 1;
    }
  }

  // Build tree
  let tree = buildForkTree(sessions);
  let flat = flattenTree(tree, 0, []);
  const forkableCount = flat.filter((f) => !isForked(f.meta)).length;
  console.log(`  ${GRN}✓ 找到 ${sessions.length} 个会话 (${forkableCount} 个可被分叉)${NC}\n`);

  // ── Session selection (with promote loop) ──
  let targetSession: SessionMeta | null = null;

  if (isLast) {
    targetSession = flat.filter((f) => !isForked(f.meta))[0]?.meta ?? null;
    if (!targetSession) {
      console.log(`  ${RED}✗ 无可用的 📝 根会话。请先将一个 🔀 会话提升为主会话。${NC}\n`);
      return 1;
    }
    console.log(`  ${GRN}✓ 最近会话: ${targetSession.title}${NC}`);
  }

  while (!targetSession) {
    const result = await forkTreeSelect(flat);

    // User quit
    if (!result.sessionId && !result.promoted) {
      console.log(`\n  ${DIM}已取消${NC}\n`);
      resetStdin();
      return 0;
    }

    // Promote flow
    if (result.promoted) {
      const toPromote = sessions.find((s) => s.sessionId === result.promoted)!;
      const confirmed = await confirmRaw(`\n  将 "${toPromote.title}" 提升为主会话? (y/N): `);
      if (!confirmed) {
        console.log(`\n  ${DIM}已取消提升，回到列表${NC}\n`);
        tree = buildForkTree(sessions);
        flat = flattenTree(tree, 0, []);
        console.log(`${BLU}? 选择要分叉的会话:${NC}`);
        continue;
      }

      promoteSession(toPromote);

      // Update in-memory sessions
      sessions = sessions.map((s) => {
        if (s.sessionId === toPromote.sessionId) {
          return { ...s, parentSessionId: null, parentTitle: null, forkedAt: null };
        }
        return s;
      });
      tree = buildForkTree(sessions);
      flat = flattenTree(tree, 0, []);

      console.log(`\n  ${GRN}${BOLD}✓ 会话已提升为主会话，现在可以分叉了${NC}\n`);
      console.log(`${BLU}? 选择要分叉的会话:${NC}`);
      continue;
    }

    targetSession = sessions.find((s) => s.sessionId === result.sessionId)!;
  }

  console.log(`\n  ${GRN}✓ 已选择: ${targetSession.title}${NC}`);

  // ── Model selection (if not specified via CLI) ──
  if (!modelAlias) {
    const alias = await selectModel("选择目标模型:");
    if (!alias) {
      console.log(`\n  ${DIM}已取消${NC}\n`);
      resetStdin();
      return 0;
    }
    modelAlias = alias;
    modelRecord = models.find((m) => m.alias === alias) ?? null;
  }
  console.log(`  ${GRN}✓ 目标模型: ${modelAlias}${NC}`);

  // ── Preview & confirm ──
  const newTitle = `${targetSession.title} [分列·${modelAlias}]`;
  console.log(`\n${BOLD}${BLU}  ─── 分叉预览 ───${NC}`);
  console.log(`  ${DIM}原会话:${NC}   ${targetSession.title}`);
  console.log(`  ${DIM}行数:${NC}     ${targetSession.lines}`);
  console.log(`  ${DIM}目标模型:${NC} ${CYA}${modelAlias}${NC}`);
  console.log(`  ${DIM}新标题:${NC}   ${YLW}${newTitle}${NC}`);

  const confirmed = await confirmRaw("\n  确认分叉? (y/N): ");
  if (!confirmed) {
    console.log(`\n  ${DIM}已取消，未创建分叉${NC}\n`);
    resetStdin();
    return 0;
  }

  // ── Execute fork ──
  console.log(`\n  ${BLU}⏳ 执行分叉...${NC}`);
  let newSessionId = "";
  try {
    newSessionId = executeFork(targetSession, modelAlias);
    console.log(`  ${GRN}✓ 复制对话文件 (${targetSession.lines} 行)${NC}`);
    console.log(`  ${GRN}✓ 插入 fork-source 溯源记录${NC}`);
    console.log(`  ${GRN}✓ 替换 sessionId${NC}`);
    console.log(`  ${GRN}✓ 更新 aiTitle: ${newTitle}${NC}`);
    console.log(`\n  ${GRN}${BOLD}✓ 分叉完成!${NC}`);
    console.log(`  ${DIM}新会话: ${newTitle}${NC}`);
    console.log(`  ${DIM}状态: 🔀 分叉会话 (锁定，不可再次分叉)${NC}\n`);
  } catch (err) {
    console.log(`\n  ${RED}✗ 分叉失败: ${err instanceof Error ? err.message : String(err)}${NC}\n`);
    resetStdin();
    return 1;
  }

  // ── Launch (unless --no-launch) ──
  if (!noLaunch && modelRecord) {
    return await launchClaude(modelRecord, ["--resume", newSessionId]);
  }

  resetStdin();
  return 0;
}
