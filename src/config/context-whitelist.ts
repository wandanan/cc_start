import fs from "node:fs";
import path from "node:path";
import { getHomeDir } from "./paths";

const WHITELIST_FILENAME = ".1m-whitelist.json";

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
