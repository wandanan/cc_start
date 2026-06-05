export const CYA = "\x1b[0;36m";
export const BLU = "\x1b[0;34m";
export const GRN = "\x1b[0;32m";
export const YLW = "\x1b[1;33m";
export const RED = "\x1b[0;31m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const NC = "\x1b[0m";

export function color(c: string, s: string): string {
  return `${c}${s}${NC}`;
}
