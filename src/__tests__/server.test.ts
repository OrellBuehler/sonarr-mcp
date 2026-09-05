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
});
