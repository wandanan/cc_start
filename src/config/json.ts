import fs from "node:fs";

export type JsonObject = Record<string, unknown>;

export function stripBom(input: string): string {
  return input.replace(/^\uFEFF/, "");
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readJsonObject(filePath: string): JsonObject {
  const raw = stripBom(fs.readFileSync(filePath, "utf8"));
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("JSON root must be an object");
  }
  return parsed;
}

export function writeJsonObject(filePath: string, value: JsonObject): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
