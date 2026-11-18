import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { registerCommandTools, COMMANDS } from "../tools/commands.js";
import { collectTools, mockJson, stubFetch, callAt, payload } from "./helpers.js";

const { tools, schemas, descriptions } = collectTools(registerCommandTools);

describe("command tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("run_command merges extra params into the body", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 3, commandName: "RssSync", status: "queued" }));
    const res = await tools.get("run_command")!({ name: "RssSync", params: { seriesId: 4 } });
    const call = callAt(mockFetch);
    expect(call.url).toBe("http://sonarr:8989/api/v3/command");
    expect(call.body).toEqual({ name: "RssSync", seriesId: 4 });
    expect(payload(res)).toMatchObject({ id: 3, name: "RssSync", status: "queued" });
  });

  it("run_command only accepts allowlisted command names", () => {
    const schema = z.object(schemas.get("run_command") as z.ZodRawShape);
    for (const name of COMMANDS) {
      expect(schema.safeParse({ name }).success).toBe(true);
    }
    for (const name of [
      "ApplicationUpdate",
      "ResetApiKey",
      "DeleteLogFiles",
      "DeleteUpdateLogFiles",
      "ClearLog",
      "CleanUpRecycleBin",
      "ResetQualityDefinitions",
      "rsssync",
      "",
    ]) {
      expect(schema.safeParse({ name }).success).toBe(false);
      expect(COMMANDS).not.toContain(name);
    }
    expect(descriptions.get("run_command")).not.toContain("ApplicationUpdate,");
  });

  it("run_command does not let params override the command name", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 3 }));
    await tools.get("run_command")!({
      name: "RssSync",
      params: { name: "ApplicationUpdate", Name: "ResetApiKey", NAME: "x", seriesId: 4 },
    });
    expect(callAt(mockFetch).body).toEqual({ name: "RssSync", seriesId: 4 });
  });

  it("search_season sends SeasonSearch with the season number", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1 }));
    await tools.get("search_season")!({ series_id: 2, season_number: 3 });
    expect(callAt(mockFetch).body).toEqual({
      name: "SeasonSearch",
      seriesId: 2,
      seasonNumber: 3,
    });
  });

  it("refresh_series omits seriesId when refreshing everything", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1 }));
    await tools.get("refresh_series")!({});
    expect(callAt(mockFetch).body).toEqual({ name: "RefreshSeries" });
  });

  it("search_episodes sends the episode id list", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1 }));
    await tools.get("search_episodes")!({ episode_ids: [11, 12] });
    expect(callAt(mockFetch).body).toEqual({ name: "EpisodeSearch", episodeIds: [11, 12] });
  });

  it("list_commands summarizes and prefers commandName", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([{ id: 1, name: "RssSync", commandName: "RSS Sync", status: "completed" }]),
    );
    const body = payload(await tools.get("list_commands")!({}));
    expect(body.count).toBe(1);
    expect(body.commands[0].name).toBe("RSS Sync");
  });

  it("cancel_command deletes the command", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("cancel_command")!({ id: 8 });
    const call = callAt(mockFetch);
    expect(call.method).toBe("DELETE");
    expect(call.url).toBe("http://sonarr:8989/api/v3/command/8");
  });
});
