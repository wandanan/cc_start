import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ModelSettings } from "../config/model-config";
import { readJsonObject, writeJsonObject, JsonObject, isRecord } from "../config/json";
import { ENV_KEYS } from "../config/env-keys";
import { getUserSettingsPath } from "../config/paths";

function createTempFile(): string {
  const dir = process.env.TMPDIR || os.tmpdir();
  const name = `cc-settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  return path.join(dir, name);
}

export function createMergedSettings(modelSettings: ModelSettings): string {
  const tmpfile = createTempFile();
  const userSettingsPath = getUserSettingsPath();

  if (!fs.existsSync(userSettingsPath)) {
    writeJsonObject(tmpfile, modelSettings as unknown as JsonObject);
    return tmpfile;
  }

  const globalSettings = readJsonObject(userSettingsPath);

  // Build env block from model config
  const envBlock: Record<string, string> = {};
  for (const key of ENV_KEYS) {
    const val = modelSettings.env[key];
    if (val) {
      envBlock[key] = val;
    }
  }

  // Replace env block in global settings
  const merged: JsonObject = { ...globalSettings };
  merged.env = envBlock;

  // Inject skipWebFetchPreflight from model config
  if (modelSettings.skipWebFetchPreflight === true) {
    merged.skipWebFetchPreflight = true;
  }

  writeJsonObject(tmpfile, merged);
  return tmpfile;
}
