import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Load the nearest .env walking up from `startDir` (the repo root in the monorepo, the project
 * root in an exported submission). Existing env vars win. Values are never printed.
 */
export function loadEnv(startDir: string = process.cwd()): string | undefined {
  for (let dir = startDir; ; dir = dirname(dir)) {
    const file = join(dir, ".env");
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return file;
    }
    if (dirname(dir) === dir) return undefined;
  }
}
