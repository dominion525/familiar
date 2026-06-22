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
  it("preserves action, args, kind, and cause (via ES2022 Error options)", () => {
    const cause = new Error("underlying");
    const err = new AppleScriptError(
      "boom",
      "click",
      ["1", "2", "#x"],
      "non_zero_exit",
      { cause },
    );
    expect(err.message).toBe("boom");
    expect(err.action).toBe("click");
    expect(err.args).toEqual(["1", "2", "#x"]);
    expect(err.kind).toBe("non_zero_exit");
    expect(err.cause).toBe(cause);
    expect(err.name).toBe("AppleScriptError");
  });

  it("is an instance of Error", () => {
    const err = new AppleScriptError("x", "y", [], "unknown");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("runAction", () => {
  afterEach(() => {
    mockExecAsync.mockReset();
  });

  it("strips only the single trailing newline (preserves inner whitespace)", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "  hello  \n", stderr: "" });
    const result = await runAction("list_tabs", []);
    expect(result).toBe("  hello  ");
  });

  it("returns stdout as-is when there is no trailing newline", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "no_newline", stderr: "" });
    expect(await runAction("get_value", ["1", "2", "#x"])).toBe("no_newline");
  });

  it("preserves embedded newlines (only the last one is stripped)", async () => {
    mockExecAsync.mockResolvedValue({
      stdout: "line1\nline2\n",
      stderr: "",
    });
    expect(await runAction("execute_js", ["1", "2", "x"])).toBe("line1\nline2");
  });

  it("returns empty string when stdout is just a newline", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "\n", stderr: "" });
    expect(await runAction("close_tab", ["1", "2"])).toBe("");
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
    const cause = Object.assign(new Error("Command failed: exit code 1"), {
      code: 1,
    });
    mockExecAsync.mockRejectedValue(cause);

    await expect(runAction("click", ["1", "2", "#x"])).rejects.toMatchObject({
      name: "AppleScriptError",
      action: "click",
      args: ["1", "2", "#x"],
      kind: "non_zero_exit",
      cause,
    });
  });

  it("formats the error message with action, kind, and underlying error", async () => {
    const cause = Object.assign(new Error("Timed out after 30s"), {
      code: "ETIMEDOUT",
    });
    mockExecAsync.mockRejectedValue(cause);

    try {
      await runAction("wait_for_load", ["1", "2"]);
      expect.unreachable("runAction should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppleScriptError);
      const ase = err as AppleScriptError;
      expect(ase.message).toContain("wait_for_load");
      expect(ase.message).toContain("(timeout)");
      expect(ase.message).toContain("Timed out after 30s");
      expect(ase.kind).toBe("timeout");
    }
  });

  it("handles non-Error throwable values (string) as kind=unknown", async () => {
    mockExecAsync.mockRejectedValue("plain string error");

    await expect(runAction("click", ["1", "2", "#x"])).rejects.toMatchObject({
      name: "AppleScriptError",
      action: "click",
      kind: "unknown",
      cause: "plain string error",
    });
  });

  describe("error classification (kind)", () => {
    it("ETIMEDOUT → timeout", async () => {
      mockExecAsync.mockRejectedValue(
        Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
      );
      await expect(
        runAction("wait_for_load", ["1", "2"]),
      ).rejects.toMatchObject({ kind: "timeout" });
    });

    it("ENOENT → not_found", async () => {
      mockExecAsync.mockRejectedValue(
        Object.assign(new Error("osascript not found"), { code: "ENOENT" }),
      );
      await expect(runAction("list_tabs", [])).rejects.toMatchObject({
        kind: "not_found",
      });
    });

    it("ERR_CHILD_PROCESS_STDIO_MAXBUFFER → max_buffer", async () => {
      mockExecAsync.mockRejectedValue(
        Object.assign(new Error("stdout exceeded"), {
          code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
        }),
      );
      await expect(runAction("get_html", ["1", "2"])).rejects.toMatchObject({
        kind: "max_buffer",
      });
    });

    it("numeric exit code → non_zero_exit", async () => {
      mockExecAsync.mockRejectedValue(
        Object.assign(new Error("exit 2"), { code: 2 }),
      );
      await expect(runAction("click", ["1", "2", "#x"])).rejects.toMatchObject({
        kind: "non_zero_exit",
      });
    });

    it("numeric-string exit code → non_zero_exit", async () => {
      mockExecAsync.mockRejectedValue(
        Object.assign(new Error("exit 137"), { code: "137" }),
      );
      await expect(runAction("click", ["1", "2", "#x"])).rejects.toMatchObject({
        kind: "non_zero_exit",
      });
    });

    it("Error without code → unknown", async () => {
      mockExecAsync.mockRejectedValue(new Error("bare error"));
      await expect(runAction("list_tabs", [])).rejects.toMatchObject({
        kind: "unknown",
      });
    });
  });
});
