import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn, execFileSync, execSync } from "node:child_process";
import { getHomeDir, getModelsDir } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";
import {
  buildDshProvidersYaml,
  buildCredentialEnv,
  slugifyProviderId,
  stripContextSuffix,
  yamlString,
} from "../config/dsh-bridge";
import { buildClaudeEnv } from "../launcher/env";
import { selectModel } from "../ui/menu";
import { confirm } from "../ui/prompts";
import { GRN, BOLD, DIM, NC, RED, BLU, YLW } from "../ui/colors";
import { getCmdName } from "../platform/detect";

/** dsh 配置叠加层文件名（写入 $DSH_HOME 下）。 */
const DSH_PATCH_FILE = "cc-start-providers.yml";
/** 运行实例状态文件（记录端口/URL，供 `cc dsh stop` 清理）。 */
const DSH_STATE_FILE = "cc-start-dsh.json";
/** dsh web 默认端口。 */
const DEFAULT_WEB_PORT = 3080;

interface DshState {
  port: number;
  url: string;
  pid: number;
  startedAt: string;
}

function getDshHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.DSH_HOME || path.join(getHomeDir(env), ".dsh");
}

function getPatchPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getDshHome(env), DSH_PATCH_FILE);
}

function getStatePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getDshHome(env), DSH_STATE_FILE);
}

function writeState(state: DshState): void {
  const statePath = getStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

function readState(): DshState | null {
  try {
    const raw = JSON.parse(fs.readFileSync(getStatePath(), "utf8"));
    if (typeof raw.port === "number" && typeof raw.url === "string") {
      return raw as DshState;
    }
    return null;
  } catch {
    return null;
  }
}

function clearState(): void {
  try {
    fs.rmSync(getStatePath(), { force: true });
  } catch {
    // ignore
  }
}

/** 查找监听指定端口的进程 PID（Windows netstat / POSIX lsof）。 */
function findListenerPid(port: number): number | null {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/127\.0\.0\.1:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
        if (m && Number(m[1]) === port) return Number(m[2]);
      }
      return null;
    }
    const out = execFileSync("lsof", ["-t", `-i:${port}`], { encoding: "utf8" });
    const pid = Number.parseInt(out.trim().split(/\n/)[0], 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

/** 杀掉整棵进程树（Windows taskkill /T，POSIX 进程组）。 */
function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // no process group
  }
}

/** npm 全局安装目录（`npm config get prefix`），失败返回空串。 */
function getNpmPrefix(): string {
  try {
    return execSync("npm config get prefix", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/** 目录是否可写：存在则检查权限，不存在则尝试创建。 */
function isDirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** 在某个 npm prefix 的 bin 目录下查找 dsh 可执行文件。 */
function findDshBinInPrefix(prefix: string): string | null {
  const names =
    process.platform === "win32" ? ["dsh.cmd", "dsh.exe", "dsh"] : ["dsh"];
  const binDir = path.join(prefix, process.platform === "win32" ? "" : "bin");
  for (const name of names) {
    const candidate = path.join(binDir, name);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

/**
 * 挑选一个可写的 npm 全局安装目录，用于 `npm i -g` 的权限兜底。
 * 优先 npm 现有 prefix；不可写（如系统级 /usr，EACCES）则回退用户级目录，
 * ~/.local 的 bin 通常已在 PATH 中，装完即可直接使用。
 */
function pickWritableNpmPrefix(): string {
  const home = getHomeDir();
  const candidates = [
    getNpmPrefix(),
    path.join(home, ".local"),
    path.join(home, ".npm-global"),
  ];
  for (const dir of candidates) {
    if (dir && isDirWritable(dir)) return dir;
  }
  return path.join(home, ".npm-global");
}

/** 在 PATH、npm 全局目录或用户级回退目录中查找 dsh 可执行文件。 */
function findDshBin(): string | null {
  const names =
    process.platform === "win32" ? ["dsh.cmd", "dsh.exe", "dsh"] : ["dsh"];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // keep looking
      }
    }
  }
  // npm 全局目录回退：PATH 可能不含 npm prefix（无需用户改 PATH）
  const npmPrefix = getNpmPrefix();
  if (npmPrefix) {
    const found = findDshBinInPrefix(npmPrefix);
    if (found) return found;
  }
  // 用户级回退目录：自动安装曾写入过这些位置
  const home = getHomeDir();
  for (const dir of [path.join(home, ".local"), path.join(home, ".npm-global")]) {
    const found = findDshBinInPrefix(dir);
    if (found) return found;
  }
  return null;
}

/** Windows 命令行参数转义：含空格/特殊字符则双引号包裹（与 launch.ts 一致）。 */
function quoteShellArg(arg: string): string {
  if (arg === "") return '""';
  if (/[^\w@%\-+=:,./]/.test(arg)) {
    return '"' + arg.replace(/"/g, '""') + '"';
  }
  return arg;
}

/** 探测端口是否已被占用。 */
function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** 用系统默认浏览器打开 URL（不阻塞、不关联生命周期）。 */
function openBrowser(url: string): void {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
  console.log(`  ${GRN}✓${NC} 已在浏览器打开: ${BOLD}${url}${NC}`);
}

/**
 * 把所选模型同步为 dsh 的默认 Agent 模型（~/.dsh/settings.yaml 的
 * agent-default-model 段）。
 *
 * 背景：dsh 的 UI 默认模型由 settings.yaml 持久化（上次使用），与 cc 的
 * 启动参数无关。cc 选择模型启动 dsh 后，UI 仍显示旧的默认模型。
 * dsh 的 settings 层优先级高于 composition 层（patch 注入无效），
 * 所以这里直接写 settings.yaml —— 与 dsh UI 中"设为默认"（saveSelection）
 * 的行为一致。reasoningEffort 保留原值，未设置时默认 high。
 */
export function syncDefaultModelSetting(model: ModelRecord): void {
  const env = model.settings.env;
  const providerId = slugifyProviderId(model.alias);
  const modelId = stripContextSuffix(env.ANTHROPIC_MODEL ?? "");
  if (!providerId || !modelId) return;

  const yamlPath = path.join(getDshHome(), "settings.yaml");
  let effort = "high";

  try {
    if (fs.existsSync(yamlPath)) {
      const raw = fs.readFileSync(yamlPath, "utf8");
      const sectionRe = /(^|\n)agent-default-model:(\n(?:[ \t]+.*\n?)*)/;
      const effortRe = sectionRe.exec(raw)?.[2]?.match(/reasoningEffort:\s*(\S+)/);
      if (effortRe) effort = effortRe[1];
      const section =
        `agent-default-model:\n` +
        `  provider: ${yamlString(providerId)}\n` +
        `  model: ${yamlString(modelId)}\n` +
        `  reasoningEffort: ${effort}\n`;
      const updated = sectionRe.test(raw)
        ? raw.replace(sectionRe, `$1${section}`)
        : raw.replace(/\n?$/, `\n${section}\n`);
      if (updated !== raw) {
        fs.writeFileSync(yamlPath, updated, "utf8");
      }
      return;
    }
  } catch {
    // 读/改失败则回退到整文件重建（下面 try 兜底）
  }

  // 文件不存在或处理失败：创建最小配置
  try {
    fs.mkdirSync(path.dirname(yamlPath), { recursive: true });
    fs.writeFileSync(
      yamlPath,
      `agent-default-model:\n  provider: ${yamlString(providerId)}\n  model: ${yamlString(modelId)}\n  reasoningEffort: ${effort}\n`,
      "utf8"
    );
  } catch {
    // settings 写失败不阻断启动
  }
}

/**
 * 所选模型的 baseURL 若是 localhost/127.0.0.1（本地代理）且端口不可达，
 * 提示用户代理未运行——否则 dsh 会话初始化必现 Connection error。
 */
async function warnIfLocalEndpointDown(model: ModelRecord): Promise<void> {
  const url = model.settings.env.ANTHROPIC_BASE_URL ?? "";
  const m = url.match(/^https?:\/\/([^:/]+)(?::(\d+))?/);
  if (!m) return;
  const host = m[1];
  const port = m[2] ? Number(m[2]) : undefined;
  if (host !== "localhost" && host !== "127.0.0.1") return;
  if (port === undefined) return;
  if (!(await isPortInUse(port))) {
    console.log("");
    console.log(
      `${YLW}⚠  所选模型的本地代理不可达: ${BOLD}${url}${NC}`
    );
    console.log(`  ${DIM}请先启动代理服务，否则 dsh 会话初始化将报 Connection error${NC}`);
    console.log("");
  }
}

/** 显示 dsh 启动信息。 */
function showDshLaunchInfo(model: ModelRecord, patchPath: string, dshBinStr: string): void {
  const env = model.settings.env;
  console.log("");
  console.log(`${BLU}╔═══════════════════════════════════╗${NC}`);
  console.log(`${BLU}║     启动 DeepSeek Harness         ║${NC}`);
  console.log(`${BLU}╚═══════════════════════════════════╝${NC}`);
  console.log("");
  console.log(`  ${GRN}▶${NC} 模型: ${BOLD}${model.alias}${NC}`);
  if (env.ANTHROPIC_MODEL) {
    console.log(`  ${DIM}  ID: ${env.ANTHROPIC_MODEL}${NC}`);
  }
  if (env.ANTHROPIC_BASE_URL) {
    console.log(`  ${DIM}  URL: ${env.ANTHROPIC_BASE_URL}${NC}`);
  }
  console.log(`  ${DIM}  配置层: ${patchPath}${NC}`);
  console.log(`  ${DIM}  启动器: ${dshBinStr}${NC}`);
  console.log(`  ${DIM}  凭据: 经环境变量传递，不落盘${NC}`);
  console.log("");
}

/**
 * `cc dsh stop`：停止正在运行的 dsh 实例（按状态文件记录的端口，
 * 找不到则回退到默认端口 3080），清理进程树与状态文件。
 */
export async function stopDsh(): Promise<number> {
  const state = readState();
  const port = state?.port ?? DEFAULT_WEB_PORT;

  const pid = findListenerPid(port);
  if (!pid) {
    console.log("");
    console.log(`${YLW}⚠  未发现运行中的 dsh 实例 (端口 ${port})${NC}`);
    return 1;
  }

  try {
    killProcessTree(pid);
    console.log("");
    console.log(`${GRN}✓${NC} 已停止 dsh 实例 (${BOLD}${port}${NC})`);
  } catch (error) {
    console.log(`${RED}✗ 停止失败: ${error instanceof Error ? error.message : String(error)}${NC}`);
    return 1;
  }

  clearState();
  return 0;
}

/**
 * `cc dsh`：把 cc_start 的模型配置转换为 dsh 的 provider 配置层，
 * 然后用所选模型的环境变量启动 dsh（默认 web 界面，自动打开浏览器）。
 *
 * 用法：
 *   cc dsh                 交互选择模型，启动 dsh web
 *   cc dsh <模型名>        用指定模型启动 dsh web
 *   cc dsh <模型名> headless "任务"   透传 dsh 参数/子命令
 *   cc dsh stop            停止正在运行的 dsh 实例
 *   cc dsh                 退出：Ctrl+C 或 cc dsh stop
 */
export async function dshCommand(args: string[]): Promise<number> {
  if (args[0] === "stop") {
    return stopDsh();
  }

  // --reopen：非交互环境（脚本/后台）下显式复用已有实例；不传给 dsh
  const reopenExisting = args.includes("--reopen");
  if (reopenExisting) {
    args = args.filter((a) => a !== "--reopen");
  }

  const modelsDir = getModelsDir();
  const { models } = loadModels(modelsDir);
  if (models.length === 0) {
    console.log("");
    console.log(
      `${YLW}⚠  没有已配置的模型，请先使用 ${getCmdName()} add 添加${NC}`
    );
    console.log(
      `${DIM}  dsh 通过 --patch 复用这些模型配置，无需二次配置${NC}`
    );
    return 1;
  }

  // 第一个参数若是模型别名 → 用之；否则交互选择
  let model: ModelRecord;
  let rest: string[];
  const argModel = args[0] ? models.find((m) => m.alias === args[0]) : undefined;
  if (argModel) {
    model = argModel;
    rest = args.slice(1);
  } else {
    const alias = await selectModel("选择用于 dsh 的模型");
    if (!alias) return 1;
    const found = models.find((m) => m.alias === alias);
    if (!found) return 1;
    model = found;
    rest = args;
  }

  // 每次启动现生成配置层：模型配置永远是最新的，无需手动同步
  const yaml = buildDshProvidersYaml(models);
  if (!yaml) {
    console.log(`${RED}✗ 无法从模型配置生成 dsh provider 配置${NC}`);
    return 1;
  }
  const patchPath = getPatchPath();
  fs.mkdirSync(path.dirname(patchPath), { recursive: true });
  fs.writeFileSync(patchPath, yaml, "utf8");

  // 环境：模型 env 注入；每个 provider 的凭据经各自独立的 apiKeyEnv
  // 变量导出（buildCredentialEnv），这样 UI 里切换任意模型都有正确 key
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...buildClaudeEnv(model.settings.env),
    ...buildCredentialEnv(models),
  };

  // 启动命令：优先 PATH/npm 全局中的 dsh；缺失时自动全局安装一次
  //（避免每次启动都走 npx 重新解析/下载，且 npx 首启慢会触发服务地址超时）
  let dshBin = findDshBin();
  if (!dshBin) {
    console.log("");
    console.log(
      `  ${DIM}未找到 dsh，自动安装 @deepseek-ai/dsh（仅首次需要网络）...${NC}`
    );
    // 系统级 npm prefix（如 /usr）不可写会报 EACCES：自动改到用户可写目录
    const targetPrefix = pickWritableNpmPrefix();
    try {
      execSync("npm install -g @deepseek-ai/dsh", {
        stdio: "inherit",
        env: { ...process.env, npm_config_prefix: targetPrefix },
      });
      dshBin = findDshBinInPrefix(targetPrefix) ?? findDshBin();
      if (dshBin) {
        console.log(`  ${GRN}✓${NC} dsh 已安装: ${dshBin}`);
      } else {
        console.log(
          `  ${YLW}安装完成但未找到可执行文件，回退 npx 启动${NC}`
        );
      }
    } catch {
      console.log(
        `  ${YLW}自动安装失败，回退 npx 启动（需要网络）${NC}`
      );
    }
  }
  const cmdName = getCmdName();
  const launcherStr = dshBin ?? "npx --yes @deepseek-ai/dsh";
  const baseArgs = dshBin ? [] : ["--yes", "@deepseek-ai/dsh"];
  // 参数顺序：`web` 是 dsh 的子命令，自带 --patch；其他 profile（如
  // --profile headless）的 --patch 是 dsh 根级 flag，须放在前面。
  const isWeb = rest.length === 0 || rest[0] === "web";
  const dshArgs: string[] = [...baseArgs];
  if (isWeb) {
    dshArgs.push("web", "--patch", patchPath);
    if (rest.length > 0) {
      dshArgs.push(...rest.slice(1));
    }
    // 默认端口被占用时：询问打开已有实例，或新开一个（--port 0 让 OS 分配）
    if (!rest.includes("--port")) {
      if (await isPortInUse(DEFAULT_WEB_PORT)) {
        const existing = readState()?.url ?? `http://127.0.0.1:${DEFAULT_WEB_PORT}`;
        if (reopenExisting) {
          openBrowser(existing);
          return 0;
        }
        if (process.stdin.isTTY) {
          const reuse = await confirm(
            `已有 dsh 实例在运行 (${existing})，打开已有实例？`,
            true
          );
          if (reuse) {
            openBrowser(existing);
            return 0;
          }
          console.log(`${DIM}  将在新端口启动另一个实例${NC}`);
          dshArgs.push("--port", "0");
        } else {
          // 非交互环境（脚本/后台/管道）：不做静默选择，明确报错并给指引
          console.log("");
          console.log(`${YLW}⚠  已有 dsh 实例在运行 (${existing})${NC}`);
          console.log(`  ${DIM}非交互环境无法询问，已中止。可执行:${NC}`);
          console.log(`  ${DIM}  ${getCmdName()} dsh stop       停止旧实例后重新启动${NC}`);
          console.log(`  ${DIM}  ${getCmdName()} dsh --reopen   直接打开已有实例${NC}`);
          console.log("");
          return 1;
        }
      }
    }
  } else {
    dshArgs.push("--patch", patchPath, ...rest);
  }

  // 把所选模型同步为 dsh 默认 Agent 模型（UI 打开即用该模型）
  syncDefaultModelSetting(model);

  // 本地端点（localhost 代理）不可达时提前警告：会话初始化会直接
  // Connection error，且 UI 提示无法定位是代理没跑
  await warnIfLocalEndpointDown(model);

  showDshLaunchInfo(model, patchPath, launcherStr);

  if (!dshBin) {
    console.log(
      `${DIM}  自动安装失败，本次通过 npx 启动（需要网络）${NC}`
    );
    console.log(
      `${DIM}  可手动执行: npm i -g @deepseek-ai/dsh 后离线启动${NC}`
    );
    console.log(
      `${DIM}  （EACCES 权限报错时加 --prefix ~/.local，如 npm i -g --prefix ~/.local @deepseek-ai/dsh）${NC}`
    );
    console.log("");
  }

  // Windows .cmd shim（npx.cmd / dsh.cmd）需 shell:true，参数合并为单字符串
  const first = dshBin ?? (process.platform === "win32" ? "npx.cmd" : "npx");
  const ext = path.extname(first).toLowerCase();
  const needsShell =
    process.platform === "win32" && (ext === ".cmd" || ext === ".bat");

  // web 模式：捕获 stdout 以解析服务地址，自动打开浏览器
  const stdio: ("inherit" | "pipe")[] = isWeb
    ? ["inherit", "pipe", "inherit"]
    : ["inherit", "inherit", "inherit"];

  return new Promise<number>((resolve) => {
    let child;
    if (needsShell) {
      const cmdLine = [first, ...dshArgs].map(quoteShellArg).join(" ");
      child = spawn(cmdLine, { env, stdio, shell: true });
    } else {
      child = spawn(first, dshArgs, { env, stdio, shell: false });
    }

    // 从 dsh 输出行 "dsh web: http://127.0.0.1:3080" 解析地址：自动打开浏览器
    // 并写入状态文件（供 `cc dsh stop` 清理）
    if (isWeb && child.stdout) {
      let opened = false;
      const timeout = setTimeout(() => {
        if (!opened) {
          console.log(
            `${YLW}⚠  未检测到 dsh 服务地址，请稍后手动打开浏览器${NC}`
          );
        }
      }, 30_000);
      timeout.unref();
      child.stdout.on("data", (chunk: Buffer) => {
        process.stdout.write(chunk);
        if (opened) return;
        const match = chunk.toString().match(/dsh web: (https?:\/\/[^\s]+)/);
        if (match) {
          opened = true;
          const url = match[1];
          const portMatch = url.match(/:(\d+)$/);
          writeState({
            port: portMatch ? Number(portMatch[1]) : DEFAULT_WEB_PORT,
            url,
            pid: child.pid ?? 0,
            startedAt: new Date().toISOString(),
          });
          openBrowser(url);
        }
      });
    }

    // Ctrl+C 转发给 dsh 进程树，确保前台能干净退出
    const onSigint = (): void => {
      try {
        child.kill("SIGINT");
      } catch {
        // already exited
      }
    };
    process.on("SIGINT", onSigint);

    child.on("error", (err) => {
      process.removeListener("SIGINT", onSigint);
      console.error(`${RED}✗ 启动 dsh 失败: ${err.message}${NC}`);
      clearState();
      resolve(1);
    });
    child.on("exit", (code) => {
      process.removeListener("SIGINT", onSigint);
      clearState();
      resolve(code ?? 0);
    });
  });
}
