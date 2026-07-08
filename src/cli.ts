#!/usr/bin/env node
import fs from "node:fs";
import { getModelsDir } from "./config/paths";
import { loadModels } from "./config/model-config";
import { showHelp } from "./ui/help";
import { interactiveMenu } from "./ui/menu";
import { pause } from "./ui/prompts";
import { RED, BOLD, DIM, NC } from "./ui/colors";
import { getCmdName } from "./platform/detect";
import { launchClaude } from "./launcher/launch";
import { recordUsage } from "./config/usage";
import { listCommand } from "./commands/list";
import { doctorCommand } from "./commands/doctor";
import { addCommand } from "./commands/add";
import { editCommand } from "./commands/edit";
import { removeCommand } from "./commands/remove";
import { syncCommand } from "./commands/sync";
import { upgradeCommand } from "./commands/upgrade";
import { resetCommand } from "./commands/reset";
import { updateCommand } from "./commands/update";
import { forkCommand } from "./commands/fork";

function ensureConfigDir(): void {
  const dir = getModelsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main(argv: string[]): Promise<number> {
  ensureConfigDir();

  // Interactive mode (no arguments)
  if (argv.length === 0) {
    const cmdName = getCmdName();

    while (true) {
      const action = await interactiveMenu();

      switch (action.type) {
        case "quit":
          console.log(`  ${DIM}再见!${NC}`);
          return 0;
        case "add":
          await addCommand();
          await pause();
          break;
        case "edit":
          await editCommand();
          await pause();
          break;
        case "remove":
          await removeCommand();
          await pause();
          break;
        case "update":
          await updateCommand();
          break;
        case "fork":
          await forkCommand([]);
          await pause();
          break;
        case "help":
          showHelp();
          await pause();
          break;
        case "back":
          break;
        case "launch":
          return await launchClaude(action.model, []);
        case "invalid":
          console.log(`${RED}  请输入选项${NC}`);
          console.log("");
          await pause();
          break;
      }
    }
  }

  // Command dispatch
  const [command, ...args] = argv;

  switch (command) {
    case "add":
      return await addCommand();
    case "edit":
      return await editCommand(args[0]);
    case "remove":
    case "rm":
      return await removeCommand(args[0]);
    case "list":
    case "ls":
      return listCommand();
    case "doctor":
      return doctorCommand(args);
    case "sync":
      return await syncCommand(args[0]);
    case "upgrade":
      return upgradeCommand();
    case "update":
    case "upgrade-claude":
      return await updateCommand();
    case "reset":
      return await resetCommand();
    case "fork":
      return await forkCommand(args);
    case "-h":
    case "--help":
    case "help":
      showHelp();
      return 0;
    default: {
      // Try to launch as a model name
      const modelsDir = getModelsDir();
      const configPath = `${modelsDir}/${command}.json`;

      if (fs.existsSync(configPath)) {
        const { models } = loadModels(modelsDir);
        const model = models.find((m) => m.alias === command);
        if (model) {
          recordUsage(model.alias);
          return await launchClaude(model, args);
        }
      }

      const cmdName = getCmdName();
      console.log("");
      console.log(`  ${RED}✗ 未知命令或模型: ${BOLD}${command}${NC}`);
      console.log("");
      console.log(`  ${DIM}使用 ${cmdName} -h 查看帮助${NC}`);
      return 1;
    }
  }
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
