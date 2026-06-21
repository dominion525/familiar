import { z } from "zod";

const TabRef = {
  windowId: z.string().describe("Chrome window id"),
  tabId: z.string().describe("Chrome tab id"),
};

export type ToolInputShape = Record<string, z.ZodTypeAny>;

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: ToolInputShape;
  runArgs: (input: Record<string, unknown>) => string[];
};

export const TOOLS: ToolDef[] = [
  {
    name: "list_tabs",
    description:
      'List all open Chrome tabs across all windows. Returns one tab per line as "<windowId>,<tabId>,<title>,<url>". Native; works even when "Allow JavaScript from Apple Events" is off.',
    inputSchema: {},
    runArgs: () => [],
  },
  {
    name: "new_tab",
    description:
      'Open a new tab in a normal Chrome window. Launches Chrome if not already running. Returns "<windowId>,<tabId>".',
    inputSchema: {},
    runArgs: () => [],
  },
  {
    name: "navigate",
    description:
      "Navigate a specific Chrome tab to a URL. Briefly waits for navigation to begin; follow with wait_for_load to wait for the page to finish loading.",
    inputSchema: {
      ...TabRef,
      url: z.string().describe("URL to navigate to"),
    },
    runArgs: (input) => [
      String(input.windowId),
      String(input.tabId),
      String(input.url),
    ],
  },
  {
    name: "wait_for_load",
    description:
      'Wait until the tab\'s document.readyState reaches "complete". Polls up to 60 seconds. Returns "complete" or "timeout".',
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
  {
    name: "get_html",
    description:
      "Get the tab's current DOM as outerHTML. May return up to 10 MiB.",
    inputSchema: TabRef,
    runArgs: (input) => [String(input.windowId), String(input.tabId)],
  },
];
