import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compiled location is mcp/dist/applescript.js; the bundled AppleScript lives
// at <repo-root>/skills/familiar/familiar.applescript, two levels up.
const APPLESCRIPT_PATH = path.resolve(
  __dirname,
  "../../skills/familiar/familiar.applescript",
);

const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024;

export class AppleScriptError extends Error {
  constructor(
    message: string,
    public readonly action: string,
    public readonly args: readonly string[],
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppleScriptError";
  }
}

/**
 * Run a familiar.applescript action via `osascript` and return its stdout.
 *
 * The runner is intentionally thin: sentinel return strings such as
 * "not_found", "no_form", "no_option", and "timeout" are passed through
 * verbatim. Their interpretation belongs to the tool layer.
 */
export async function runAction(
  action: string,
  args: readonly string[] = [],
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      [APPLESCRIPT_PATH, action, ...args],
      { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
    );
    return stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppleScriptError(
      `osascript ${action} failed: ${message}`,
      action,
      args,
      error,
    );
  }
}
