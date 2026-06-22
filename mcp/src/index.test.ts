import { beforeAll, describe, expect, it, vi } from "vitest";

// Capture instances and spies. The McpServer mock only needs to exist; the
// only thing we verify here is that index.ts wires it to a freshly-created
// StdioServerTransport and awaits connect() exactly once.
const { connectSpy, transportInstances } = vi.hoisted(() => ({
  connectSpy: vi.fn().mockResolvedValue(undefined),
  transportInstances: [] as object[],
}));

vi.mock("./server.js", () => ({
  createServer: () => ({
    connect: connectSpy,
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {
    constructor() {
      transportInstances.push(this);
    }
  },
}));

beforeAll(async () => {
  await import("./index.js");
});

describe("index (thin CLI runner)", () => {
  it("instantiates a StdioServerTransport", () => {
    expect(transportInstances).toHaveLength(1);
  });

  it("connects the server to the transport exactly once", () => {
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledWith(transportInstances[0]);
  });
});
