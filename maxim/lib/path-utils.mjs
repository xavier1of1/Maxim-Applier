import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function fromRoot(...parts) {
  return path.join(repoRoot, ...parts);
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}
