import { describe, expect, it } from "vitest";
import { AppleScriptError } from "./applescript.js";

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
