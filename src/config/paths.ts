import path from "node:path";

export function getHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.USERPROFILE || env.HOME || process.cwd();
}

export function getModelsDir(homeDir = getHomeDir()): string {
  return path.join(homeDir, ".claude", "models");
}

export function getUserSettingsPath(homeDir = getHomeDir()): string {
  return path.join(homeDir, ".claude", "settings.json");
}
