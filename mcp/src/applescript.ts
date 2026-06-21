import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The build step copies skills/familiar/familiar.applescript into mcp/dist/,
// so the script lives next to the compiled JS regardless of where the package
// is installed (workspace dev tree, npm install, npx cache, ...).
const APPLESCRIPT_PATH = path.resolve(__dirname, "./familiar.applescript");

export const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024;

export type RunActionOptions = {
  /**
   * Override the osascript kill timeout. Tools that wait inside AppleScript
   * (wait_for_load, wait_for_selector, wait_for_function) must pass a value
   * that exceeds the AppleScript-side wait or the child process is killed
   * before the action returns.
   */
  timeoutMs?: number;
};

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
  options: RunActionOptions = {},
): Promise<string> {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      [APPLESCRIPT_PATH, action, ...args],
      { timeout, maxBuffer: MAX_BUFFER },
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
