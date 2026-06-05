import * as readline from "node:readline";
import fs from "node:fs";

let _rl: readline.Interface | null = null;

function getRl(): readline.Interface {
  if (!_rl) {
    _rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return _rl;
}

export function closePrompt(): void {
  if (_rl) {
    _rl.close();
    _rl = null;
  }
}

export function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    getRl().question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function confirm(prompt: string, defaultYes = false): Promise<boolean> {
  const yn = defaultYes ? "Y/n" : "y/N";
  const answer = await question(`${prompt} (${yn}): `);
  if (!answer) return defaultYes;
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

export async function confirmExact(prompt: string, required: string): Promise<boolean> {
  const answer = await question(`${prompt}: `);
  return answer === required;
}

export function pause(message = "按回车继续..."): Promise<void> {
  return question(message).then(() => {});
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return "*".repeat(key.length);
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
