import { ModelRecord, ModelEnv } from "../config/model-config";
import { ENV_KEYS } from "../config/env-keys";

export function buildClaudeEnv(
  modelEnv: ModelEnv,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    DISABLE_AUTOUPDATER: baseEnv.DISABLE_AUTOUPDATER || "1",
  };

  for (const key of ENV_KEYS) {
    const val = modelEnv[key];
    if (val) {
      env[key] = val;
    }
  }

  // Backward compat: legacy "model" field
  if (!env.ANTHROPIC_MODEL) {
    // This should have been normalized by model-config already
  }

  return env;
}

export function modelToEnv(model: ModelRecord): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ENV_KEYS) {
    const val = model.settings.env[key];
    if (val) {
      result[key] = val;
    }
  }
  return result;
}
