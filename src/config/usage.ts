import fs from "node:fs";
import path from "node:path";
import { getModelsDir } from "./paths";

export interface UsageEntry {
  count: number;
  lastUsed: string;
}

function getUsagePath(): string {
  return path.join(getModelsDir(), ".usage.json");
}

export function loadUsage(): Record<string, UsageEntry> {
  try {
    return JSON.parse(fs.readFileSync(getUsagePath(), "utf-8"));
  } catch {
    return {};
  }
}

export function recordUsage(alias: string): void {
  const usage = loadUsage();
  const entry = usage[alias] || { count: 0, lastUsed: "" };
  entry.count++;
  entry.lastUsed = new Date().toISOString();
  usage[alias] = entry;
  try {
    fs.writeFileSync(getUsagePath(), JSON.stringify(usage, null, 2));
  } catch {
    // non-critical
  }
}
