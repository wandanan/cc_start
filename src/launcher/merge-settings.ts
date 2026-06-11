import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ModelSettings } from "../config/model-config";
import { readJsonObject, writeJsonObject, JsonObject, isRecord } from "../config/json";
import { ENV_KEYS } from "../config/env-keys";
import { getHomeDir, getUserSettingsPath } from "../config/paths";

function createTempFile(): string {
  // Use home directory to avoid /tmp visibility issues in some WSL configurations
  const home = getHomeDir();
  const dir = path.join(home, ".local", "share", "cc-start", "tmp");
  fs.mkdirSync(dir, { recursive: true });
  const name = `cc-settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  return path.join(dir, name);
}

export function createMergedSettings(modelSettings: ModelSettings): string {
  const tmpfile = createTempFile();
  const userSettingsPath = getUserSettingsPath();

  try {
    if (!fs.existsSync(userSettingsPath)) {
      writeJsonObject(tmpfile, modelSettings as unknown as JsonObject);
    } else {
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
    }

    // Verify the file was actually written
    if (!fs.existsSync(tmpfile)) {
      throw new Error(`Failed to write settings file: ${tmpfile}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot create merged settings: ${msg}`);
  }

  return tmpfile;
}
