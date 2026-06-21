import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppleScriptError,
  DEFAULT_TIMEOUT_MS,
  runAction,
} from "./applescript.js";

// `applescript.ts` wraps `execFile` with `promisify`, which uses the
// `util.promisify.custom` symbol. We mock that promisified function directly
// so the assertions can resolve/reject without going through the callback
// adapter. The factory is async because vi.mock is hoisted above the imports
// — we need a dynamic import to access `promisify` from inside.
vi.mock("node:child_process", async () => {
  const { promisify: p } = await import("node:util");
  const mockExec = vi.fn();
  (mockExec as unknown as Record<symbol, unknown>)[p.custom] = vi.fn();
  return { execFile: mockExec };
});

const mockExecAsync = (
  execFile as unknown as Record<symbol, ReturnType<typeof vi.fn>>
)[promisify.custom];

describe("AppleScriptError", () => {
  it("preserves action, args, and cause", () => {
    const cause = new Error("underlying");
    const err = new AppleScriptError("boom", "click", ["1", "2", "#x"], cause);
    expect(err.message).toBe("boom");
    expect(err.action).toBe("click");
    expect(err.args).toEqual(["1", "2", "#x"]);
    expect(err.cause).toBe(cause);
    expect(err.name).toBe("AppleScriptError");
  });

  it("is an instance of Error", () => {
    const err = new AppleScriptError("x", "y", []);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("runAction", () => {
  afterEach(() => {
    mockExecAsync.mockReset();
  });

  it("trims stdout and returns it on success", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "  hello  \n", stderr: "" });
    const result = await runAction("list_tabs", []);
    expect(result).toBe("hello");
  });

  it("invokes osascript with the bundled script path and action args", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    await runAction("navigate", ["1", "2", "https://example.com"]);

    expect(mockExecAsync).toHaveBeenCalledTimes(1);
    const [file, args] = mockExecAsync.mock.calls[0];
    expect(file).toBe("osascript");
    expect(args).toEqual([
      expect.stringMatching(/familiar\.applescript$/),
      "navigate",
      "1",
      "2",
      "https://example.com",
    ]);
  });

  it("defaults args to [] when omitted", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    await runAction("list_tabs");

    const [, args] = mockExecAsync.mock.calls[0];
    expect(args).toEqual([
      expect.stringMatching(/familiar\.applescript$/),
      "list_tabs",
    ]);
  });

  it("falls back to the default 30s timeout when timeoutMs is omitted", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    await runAction("list_tabs", []);

    const [, , options] = mockExecAsync.mock.calls[0];
    expect(options).toMatchObject({
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    });
  });

  it("uses the provided timeoutMs over the default", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    await runAction("wait_for_load", ["1", "2"], { timeoutMs: 65_000 });

    const [, , options] = mockExecAsync.mock.calls[0];
    expect(options).toMatchObject({ timeout: 65_000 });
  });

  it("falls back to the default when timeoutMs is explicitly undefined", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "ok", stderr: "" });
    await runAction("list_tabs", [], { timeoutMs: undefined });

    const [, , options] = mockExecAsync.mock.calls[0];
    expect(options).toMatchObject({ timeout: DEFAULT_TIMEOUT_MS });
  });

  it("wraps execFile errors in AppleScriptError preserving cause", async () => {
    const cause = new Error("Command failed: exit code 1");
    mockExecAsync.mockRejectedValue(cause);

    await expect(runAction("click", ["1", "2", "#x"])).rejects.toMatchObject({
      name: "AppleScriptError",
      action: "click",
      args: ["1", "2", "#x"],
      cause,
    });
  });

  it("formats the error message with action and underlying error", async () => {
    const cause = new Error("Timed out after 30s");
    mockExecAsync.mockRejectedValue(cause);

    try {
      await runAction("wait_for_load", ["1", "2"]);
      expect.unreachable("runAction should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppleScriptError);
      expect((err as AppleScriptError).message).toContain("wait_for_load");
      expect((err as AppleScriptError).message).toContain(
        "Timed out after 30s",
      );
    }
  });

  it("handles non-Error throwable values (string)", async () => {
    mockExecAsync.mockRejectedValue("plain string error");

    await expect(runAction("click", ["1", "2", "#x"])).rejects.toMatchObject({
      name: "AppleScriptError",
      action: "click",
      cause: "plain string error",
    });
  });
});
