import os from "node:os";

export type Platform = "windows" | "macos" | "linux";

export function getPlatform(): Platform {
  const p = os.platform();
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  return "linux";
}

export function isMintty(): boolean {
  return process.env.TERM_PROGRAM === "mintty";
}

export function isMsys(): boolean {
  const ostype = process.env.OSTYPE || "";
  return ostype === "msys" || ostype === "cygwin" || !!process.env.MSYSTEM;
}

export function resolveHomeDir(): string {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

export function getCmdName(): string {
  const arg1 = process.argv[1] || "";
  const base = arg1.replace(/^.*[/\\]/, "").replace(/\.(js|cmd|exe)$/, "");
  if (base === "cc" || base === "ccs") return base;
  // Default to ccs to avoid conflict with /usr/bin/cc on Linux
  return "ccs";
}
