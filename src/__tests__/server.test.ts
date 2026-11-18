import { describe, it, expect } from "vitest";
import { createServer } from "../server.js";
import { SonarrClient } from "../sonarr/client.js";

describe("createServer", () => {
  it("registers every tool group without name collisions", () => {
    const names = new Set<string>();
    const server = createServer(new SonarrClient("http://sonarr:8989", "k")) as any;
    for (const name of Object.keys(server._registeredTools ?? {})) {
      expect(names.has(name)).toBe(false);
      names.add(name);
    }
    expect(names.size).toBeGreaterThan(90);
    for (const expected of [
      "list_series",
      "add_series",
      "get_calendar",
      "get_queue",
      "search_releases",
      "list_indexers",
      "get_system_status",
    ]) {
      expect(names.has(expected)).toBe(true);
    }
  });

  it("gives every tool annotations that match what it does", () => {
    const server = createServer(new SonarrClient("http://sonarr:8989", "k")) as any;
    const tools = Object.entries(server._registeredTools) as [string, any][];
    expect(tools.length).toBeGreaterThan(90);
    for (const [name, tool] of tools) {
      expect(typeof tool.annotations?.readOnlyHint, name).toBe("boolean");
      const { readOnlyHint, destructiveHint, idempotentHint } = tool.annotations;
      if (!readOnlyHint) expect(typeof destructiveHint, name).toBe("boolean");
      if (/^(list|get|lookup|parse)_/.test(name)) expect(readOnlyHint, name).toBe(true);
      if (/^(delete|remove)_/.test(name)) {
        expect(readOnlyHint, name).toBe(false);
        expect(destructiveHint, name).toBe(true);
        expect(idempotentHint, name).toBe(true);
      }
      if (/^(add|create|update|set|test|grab|refresh|rescan)_/.test(name)) {
        expect(readOnlyHint, name).toBe(false);
        expect(destructiveHint, name).toBe(false);
      }
    }
    for (const name of ["run_command", "restart_sonarr", "mark_history_item_failed"]) {
      expect(server._registeredTools[name].annotations.destructiveHint, name).toBe(true);
    }
  });

  it("only accepts positive integers for ids that end up in a URL path", () => {
    const server = createServer(new SonarrClient("http://sonarr:8989", "k")) as any;
    let checked = 0;
    for (const [name, tool] of Object.entries(server._registeredTools) as [string, any][]) {
      const id = tool.inputSchema?.shape?.id;
      if (!id) continue;
      checked++;
      for (const bad of ["../host/1", "1", 0, -3, 2.5]) {
        expect(id.safeParse(bad).success, name).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});
