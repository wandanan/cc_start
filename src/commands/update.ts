import { BLU, GRN, YLW, DIM, NC } from "../ui/colors";
import { question } from "../ui/prompts";

/**
 * Claude Code 版本固定点。
 *
 * 1M 上下文方案依赖该版本的模型校验行为：未知模型（带 [1m] 后缀）只打
 * unrecognized_model 警告、不阻止使用。升级后校验可能重新收紧（历史上
 * v2.1.197 曾因此拒绝 [1m] 模型），导致 cc 启动的模型不可用。
 *
 * 如需恢复升级：手动执行 `npm install -g @anthropic-ai/claude-code@latest`，
 * 并同步更新 install.bat / install.sh 中的锁定版本号。
 */
const PINNED_VERSION = "2.1.233";

export async function updateCommand(): Promise<number> {
  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     升级 Claude Code              ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(
    `  ${YLW}⚠ 升级已禁用：Claude Code 版本永久固定为 ${GRN}${PINNED_VERSION}${NC}`
  );
  console.log("");
  console.log(`  ${DIM}原因: 1M 上下文方案依赖该版本的模型校验行为${NC}`);
  console.log(`  ${DIM}      （未知模型仅警告、不阻止使用）${NC}`);
  console.log(`  ${DIM}      （历史版本曾收紧校验导致 [1m] 模型不可用）${NC}`);
  console.log("");
  console.log(`  ${DIM}如需恢复升级，手动执行:${NC}`);
  console.log(`  ${GRN}    npm install -g @anthropic-ai/claude-code@latest${NC}`);
  console.log("");
  await question("  按回车继续...");
  return 0;
}
