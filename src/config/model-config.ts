import fs from "node:fs";
import path from "node:path";
import { ENV_KEYS, REQUIRED_ENV_KEYS } from "./env-keys";
import { isRecord, JsonObject, readJsonObject, writeJsonObject } from "./json";
import { applyOneMillionPolicy } from "../providers/one-million";

export type ModelEnv = Record<string, string>;

export type ModelSettings = JsonObject & {
  env: ModelEnv;
  skipWebFetchPreflight?: boolean;
};

export type ModelRecord = {
  alias: string;
  filePath: string;
  settings: ModelSettings;
  repaired: boolean;
};

export type InvalidModelRecord = {
  alias: string;
  filePath: string;
  error: string;
};

export type RepairResult =
  | { ok: true; record: ModelRecord }
  | { ok: false; invalid: InvalidModelRecord };

function timestamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function backupFile(filePath: string, suffix = "bak"): string {
  const backupPath = `${filePath}.${suffix}-${timestamp()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function normalizeEnvValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeModelSettings(raw: JsonObject): { settings: ModelSettings; changed: boolean } {
  let changed = false;
  const env: ModelEnv = {};

  if (isRecord(raw.env)) {
    for (const [key, value] of Object.entries(raw.env)) {
      const normalized = normalizeEnvValue(value);
      if (normalized !== undefined) {
        env[key] = normalized;
      }
    }
  } else {
    changed = true;
  }

  for (const key of ENV_KEYS) {
    const legacyValue = normalizeEnvValue(raw[key]);
    if (legacyValue !== undefined) {
      if (!env[key]) {
        env[key] = legacyValue;
      }
      delete raw[key];
      changed = true;
    }
  }

  const legacyModel = normalizeEnvValue(raw.model);
  if (!env.ANTHROPIC_MODEL && legacyModel) {
    env.ANTHROPIC_MODEL = legacyModel;
    changed = true;
  }

  const model = env.ANTHROPIC_MODEL;
  if (model) {
    for (const key of [
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL"
    ]) {
      if (!env[key]) {
        env[key] = model;
        changed = true;
      }
    }
  }

  const settings: ModelSettings = {
    ...raw,
    env
  };

  if (applyOneMillionPolicy(settings)) {
    changed = true;
  }

  return { settings, changed };
}

function validateRequired(settings: ModelSettings): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => !settings.env[key]);
}

export function repairModelConfig(filePath: string, options: { write?: boolean } = {}): RepairResult {
  const alias = path.basename(filePath, ".json");
  const shouldWrite = options.write ?? false;

  let raw: JsonObject;
  try {
    raw = readJsonObject(filePath);
  } catch (error) {
    let detail = error instanceof Error ? error.message : String(error);
    try {
      const backupPath = backupFile(filePath, "invalid");
      detail = `${detail}; backup=${backupPath}`;
    } catch {
      // Preserve the original parse error if backup fails.
    }
    return { ok: false, invalid: { alias, filePath, error: detail } };
  }

  const { settings, changed } = normalizeModelSettings(raw);
  const missing = validateRequired(settings);
  if (missing.length > 0) {
    return {
      ok: false,
      invalid: {
        alias,
        filePath,
        error: `missing required env fields: ${missing.join(", ")}`
      }
    };
  }

  if (changed && shouldWrite) {
    backupFile(filePath);
    writeJsonObject(filePath, settings);
  }

  return {
    ok: true,
    record: {
      alias,
      filePath,
      settings,
      repaired: changed && shouldWrite
    }
  };
}

export function listModelFiles(modelsDir: string): string[] {
  if (!fs.existsSync(modelsDir)) {
    return [];
  }

  return fs
    .readdirSync(modelsDir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("."))
    .map((name) => path.join(modelsDir, name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

export function loadModels(modelsDir: string, options: { repair?: boolean } = {}): {
  models: ModelRecord[];
  invalid: InvalidModelRecord[];
} {
  const models: ModelRecord[] = [];
  const invalid: InvalidModelRecord[] = [];

  for (const filePath of listModelFiles(modelsDir)) {
    const result = repairModelConfig(filePath, { write: options.repair ?? false });
    if (result.ok) {
      models.push(result.record);
    } else {
      invalid.push(result.invalid);
    }
  }

  return { models, invalid };
}
