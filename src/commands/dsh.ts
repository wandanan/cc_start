import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { getHomeDir, getModelsDir } from "../config/paths";
import { loadModels, ModelRecord } from "../config/model-config";
import { buildDshProvidersYaml, buildCredentialEnv } from "../config/dsh-bridge";
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

/** 在 PATH 中查找 dsh 可执行文件（npm 全局安装位置）。 */
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

  // 启动命令：优先 PATH 中的 dsh，缺失时用 npx 自动获取
  const dshBin = findDshBin();
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

  showDshLaunchInfo(model, patchPath, launcherStr);

  if (!dshBin) {
    console.log(
      `${DIM}  未在 PATH 中找到 dsh，将通过 npx 获取 @deepseek-ai/dsh（需网络）${NC}`
    );
    console.log(`${DIM}  建议: npm i -g @deepseek-ai/dsh 后可离线启动${NC}`);
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
