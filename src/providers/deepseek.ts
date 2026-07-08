import type { ModelSettings } from "../config/model-config";
import { isInWhitelist } from "../config/context-whitelist";

const DEEPSEEK_SUPPORTED_CAPABILITIES = "thinking,adaptive_thinking,temperature";

export function isDeepSeekConfig(config: ModelSettings): boolean {
  return config.env.ANTHROPIC_BASE_URL?.toLowerCase().includes("deepseek") ?? false;
}

export function ensureOneMillionSuffix(model: string): string {
  if (/\[[0-9]+[kKmM]\]/.test(model)) {
    return model;
  }
  // Only add [1m] suffix if the model is in the 1M context whitelist
  if (isInWhitelist(model)) {
    return `${model}[1m]`;
  }
  return model;
}

export function applyDeepSeekPolicy(config: ModelSettings): boolean {
  if (!isDeepSeekConfig(config)) {
    return false;
  }

  let changed = false;
  const currentModel = config.env.ANTHROPIC_MODEL;
  if (currentModel) {
    const normalized = ensureOneMillionSuffix(currentModel);
    if (normalized !== currentModel) {
      config.env.ANTHROPIC_MODEL = normalized;
      changed = true;
    }
  }

  const model = config.env.ANTHROPIC_MODEL;
  if (model) {
    for (const key of [
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "CLAUDE_CODE_SUBAGENT_MODEL"
    ]) {
      if (!config.env[key]) {
        config.env[key] = model;
        changed = true;
      }
    }
  }

  if (!config.env.CLAUDE_CODE_EFFORT_LEVEL) {
    config.env.CLAUDE_CODE_EFFORT_LEVEL = "max";
    changed = true;
  }
  if (!config.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) {
    config.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = "400000";
    changed = true;
  }

  if (!config.env.CLAUDE_CODE_USE_FOUNDRY) {
    config.env.CLAUDE_CODE_USE_FOUNDRY = "1";
    changed = true;
  }
  if (!config.env.ANTHROPIC_FOUNDRY_BASE_URL && config.env.ANTHROPIC_BASE_URL) {
    config.env.ANTHROPIC_FOUNDRY_BASE_URL = config.env.ANTHROPIC_BASE_URL;
    changed = true;
  }
  if (!config.env.ANTHROPIC_FOUNDRY_API_KEY && config.env.ANTHROPIC_AUTH_TOKEN) {
    config.env.ANTHROPIC_FOUNDRY_API_KEY = config.env.ANTHROPIC_AUTH_TOKEN;
    changed = true;
  }
  for (const key of [
    "ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES"
  ]) {
    if (!config.env[key]) {
      config.env[key] = DEEPSEEK_SUPPORTED_CAPABILITIES;
      changed = true;
    }
  }

  return changed;
}

export function deepSeekExtraClaudeArgs(config: ModelSettings): string[] {
  if (!isDeepSeekConfig(config)) {
    return [];
  }
  return config.env.CLAUDE_CODE_USE_FOUNDRY === "1" ? [] : ["--bare"];
}
