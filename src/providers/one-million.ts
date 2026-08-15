import type { ModelSettings } from "../config/model-config";
import { isInWhitelist } from "../config/context-whitelist";

/**
 * 1M 上下文策略：与提供商无关，只认模型 ID 是否在白名单中。
 * 白名单内的模型自动追加 [1m] 后缀，Claude Code 识别后按 1M 上下文处理。
 */

/** 已带 [x] 后缀的模型名保持原样，白名单内的裸模型名补 [1m]。 */
export function ensureOneMillionSuffix(model: string): string {
  if (/\[[0-9]+[kKmM]\]/.test(model)) {
    return model;
  }
  return isInWhitelist(model) ? `${model}[1m]` : model;
}

/** 主模型与默认模型/子代理字段，凡在白名单中一律补 [1m] 后缀。 */
export function applyOneMillionPolicy(config: ModelSettings): boolean {
  let changed = false;
  const keys = [
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "CLAUDE_CODE_SUBAGENT_MODEL",
  ];
  for (const key of keys) {
    const val = config.env[key];
    if (val) {
      const normalized = ensureOneMillionSuffix(val);
      if (normalized !== val) {
        config.env[key] = normalized;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * 带上下文后缀（如 [1m]）的模型名对 Claude Code 是未知模型，会收到
 * unrecognized_model 警告（v2.1.233 起仅警告，不阻止使用）。
 * 这里禁用"未知模型窗口强制"，避免上下文窗口被强压回 200k。
 * 注意：不用 --bare —— bare 模式会跳过 hooks / CLAUDE.md 自动发现 /
 * plugin sync 等，导致 skills、斜杠命令、serena hooks 全部丢失。
 */
export function oneMillionEnv(config: ModelSettings): Record<string, string> {
  const model = config.env.ANTHROPIC_MODEL;
  return model && /\[[0-9]+[kKmM]\]/.test(model)
    ? { CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: "1" }
    : {};
}
