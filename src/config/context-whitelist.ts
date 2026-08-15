import fs from "node:fs";
import path from "node:path";
import { getHomeDir } from "./paths";

const WHITELIST_FILENAME = ".1m-whitelist.json";

// 默认白名单：支持百万上下文的模型。任何提供商的模型，
// 只要 ID 在此白名单内，启动时都会自动追加 [1m] 后缀。
const DEFAULT_WHITELIST: string[] = [
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner",
];

function getWhitelistPath(): string {
  return path.join(getHomeDir(), ".claude", "models", WHITELIST_FILENAME);
}

export function loadWhitelist(): string[] {
  const filePath = getWhitelistPath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    }
  } catch { /* corrupt file, fall through to defaults */ }

  // Seed with defaults on first access
  saveWhitelist(DEFAULT_WHITELIST);
  return [...DEFAULT_WHITELIST];
}

export function saveWhitelist(items: string[]): void {
  const filePath = getWhitelistPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const deduped = [...new Set(items.filter(Boolean))].sort();
  fs.writeFileSync(filePath, JSON.stringify(deduped, null, 2), "utf-8");
}

export function isInWhitelist(modelId: string): boolean {
  const list = loadWhitelist();
  return list.some((entry) => modelId === entry || modelId.startsWith(entry));
}

export function addToWhitelist(modelId: string): void {
  const list = loadWhitelist();
  if (!list.includes(modelId)) {
    list.push(modelId);
    saveWhitelist(list);
  }
}

export function removeFromWhitelist(modelId: string): void {
  const list = loadWhitelist();
  saveWhitelist(list.filter((v) => v !== modelId));
}
