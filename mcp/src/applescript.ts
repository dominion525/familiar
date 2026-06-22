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
export const MAX_BUFFER = 10 * 1024 * 1024;

export type RunActionOptions = {
  /**
   * Override the osascript kill timeout. Tools that wait inside AppleScript
   * (wait_for_load, wait_for_selector, wait_for_function) must pass a value
   * that exceeds the AppleScript-side wait or the child process is killed
   * before the action returns.
   */
  timeoutMs?: number;
};

/**
 * Categorizes the underlying failure so callers (and the LLM, via the MCP
 * isError content) can distinguish recoverable from terminal conditions.
 *
 * - `timeout`: the osascript kill-timeout fired before the action completed
 * - `max_buffer`: stdout exceeded MAX_BUFFER (10 MiB)
 * - `not_found`: the `osascript` binary itself was missing (PATH / install)
 * - `non_zero_exit`: osascript exited with a non-zero status (usually a
 *   syntax error or an AppleScript runtime error)
 * - `unknown`: any other failure
 */
export type AppleScriptErrorKind =
  | "timeout"
  | "max_buffer"
  | "not_found"
  | "non_zero_exit"
  | "unknown";

export class AppleScriptError extends Error {
  constructor(
    message: string,
    public readonly action: string,
    public readonly args: readonly string[],
    public readonly kind: AppleScriptErrorKind,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppleScriptError";
  }
}

function classifyExecFileError(error: unknown): AppleScriptErrorKind {
  if (!(error instanceof Error)) return "unknown";
  // Node's execFile sets `code` on the thrown error: a system errno
  // string (ETIMEDOUT, ENOENT, ERR_CHILD_PROCESS_STDIO_MAXBUFFER) for
  // signal-level failures, or the numeric exit code for non-zero exits.
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ETIMEDOUT") return "timeout";
  if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return "max_buffer";
  if (code === "ENOENT") return "not_found";
  if (
    typeof code === "number" ||
    (typeof code === "string" && /^\d+$/.test(code))
  ) {
    return "non_zero_exit";
  }
  return "unknown";
}

/**
 * Run a familiar.applescript action via `osascript` and return its stdout.
 *
 * The runner is intentionally thin: sentinel return strings such as
 * "not_found", "no_form", "no_option", and "timeout" are passed through
 * verbatim. Their interpretation belongs to the tool layer.
 *
 * Only the single trailing newline that `osascript` appends to every result
 * is stripped — leading / trailing whitespace inside the returned value is
 * preserved so reads like `get_value` and `get_attribute` keep significant
 * whitespace, and `execute_js` can return values that contain newlines.
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
    return stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout;
  } catch (error) {
    const kind = classifyExecFileError(error);
    const message = error instanceof Error ? error.message : String(error);
    throw new AppleScriptError(
      `osascript ${action} failed (${kind}): ${message}`,
      action,
      args,
      kind,
      { cause: error },
    );
  }
}
