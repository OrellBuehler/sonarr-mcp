import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerReleaseTools } from "../tools/releases.js";
import { collectTools, mockJson, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(registerReleaseTools);

const RELEASES = [
  {
    guid: "a",
    title: "Show.S01E01.1080p",
    indexerId: 2,
    quality: { quality: { name: "WEBDL-1080p" } },
    rejected: false,
  },
  { guid: "b", title: "Show.S01E01.720p", indexerId: 2, rejected: true, rejections: ["size"] },
];

describe("release tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search_releases summarizes and can drop rejected releases", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(RELEASES));
    const res = await tools.get("search_releases")!({ episode_id: 4, include_rejected: false });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/release?episodeId=4");
    const body = payload(res);
    expect(body.count).toBe(1);
    expect(body.releases[0]).toMatchObject({ guid: "a", quality: "WEBDL-1080p" });
  });

  it("search_releases keeps rejected releases by default", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(RELEASES));
    const body = payload(await tools.get("search_releases")!({ series_id: 1, season_number: 2 }));
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/release?seriesId=1&seasonNumber=2",
    );
    expect(body.count).toBe(2);
  });

  it("grab_release posts the guid and indexer id", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("grab_release")!({ guid: "a", indexer_id: 2 });
    expect(callAt(mockFetch).body).toEqual({ guid: "a", indexerId: 2 });
  });

  it("parse_release_title forwards the title", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("parse_release_title")!({ title: "Show.S01E01" });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/parse?title=Show.S01E01");
  });

  it("get_rename_preview counts the affected files", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([{ episodeFileId: 1 }]));
    const res = await tools.get("get_rename_preview")!({ series_id: 3 });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/rename?seriesId=3");
    expect(payload(res).count).toBe(1);
  });
});
