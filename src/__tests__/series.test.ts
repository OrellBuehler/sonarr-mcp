import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerSeriesTools } from "../tools/series.js";
import { collectTools, mockJson, mockError, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(registerSeriesTools);

const SERIES = [
  {
    id: 1,
    title: "Breaking Bad",
    year: 2008,
    monitored: true,
    tvdbId: 81189,
    qualityProfileId: 1,
    overview: "long",
    statistics: { seasonCount: 5, episodeFileCount: 62 },
  },
  { id: 2, title: "The Wire", year: 2002, monitored: false, tvdbId: 79126, statistics: {} },
];

describe("series tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list_series summarizes and filters by title and monitored state", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(SERIES));
    const res = await tools.get("list_series")!({ search: "wire" });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/series");
    const body = payload(res);
    expect(body.count).toBe(1);
    expect(body.series[0]).toMatchObject({ id: 2, title: "The Wire" });
    expect(body.series[0].overview).toBeUndefined();

    mockFetch.mockResolvedValueOnce(mockJson(SERIES));
    expect(payload(await tools.get("list_series")!({ monitored: true })).count).toBe(1);
  });

  it("list_series passes tvdb_id through and can return full objects", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([SERIES[0]]));
    const res = await tools.get("list_series")!({ tvdb_id: 81189, detailed: true });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/series?tvdbId=81189");
    expect(payload(res).series[0].overview).toBe("long");
  });

  it("add_series resolves the lookup and posts the merged resource", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson([{ title: "Breaking Bad", tvdbId: 81189, seasons: [] }]))
      .mockResolvedValueOnce(mockJson({ id: 9, title: "Breaking Bad", statistics: {} }));
    const res = await tools.get("add_series")!({
      tvdb_id: 81189,
      quality_profile_id: 4,
      root_folder_path: "/tv",
      monitor: "future",
      search_for_missing_episodes: true,
      tags: [3],
    });
    expect(callAt(mockFetch, 0).url).toBe(
      "http://sonarr:8989/api/v3/series/lookup?term=tvdb%3A81189",
    );
    const post = callAt(mockFetch, 1);
    expect(post.method).toBe("POST");
    expect(post.body).toMatchObject({
      tvdbId: 81189,
      qualityProfileId: 4,
      rootFolderPath: "/tv",
      monitored: true,
      seasonFolder: true,
      tags: [3],
      addOptions: {
        monitor: "future",
        searchForMissingEpisodes: true,
        searchForCutoffUnmetEpisodes: false,
      },
    });
    expect(payload(res).id).toBe(9);
  });

  it("add_series errors when the lookup finds nothing", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    const res = await tools.get("add_series")!({
      tvdb_id: 1,
      quality_profile_id: 1,
      root_folder_path: "/tv",
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("No series found");
  });

  it("update_series merges onto the current resource and only changes given fields", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson({ id: 1, title: "Breaking Bad", monitored: true, tags: [1] }))
      .mockResolvedValueOnce(mockJson({ id: 1, title: "Breaking Bad", statistics: {} }));
    await tools.get("update_series")!({ id: 1, monitored: false, move_files: true });
    const put = callAt(mockFetch, 1);
    expect(put.method).toBe("PUT");
    expect(put.url).toBe("http://sonarr:8989/api/v3/series/1?moveFiles=true");
    expect(put.body).toEqual({ id: 1, title: "Breaking Bad", monitored: false, tags: [1] });
  });

  it("delete_series passes the destructive flags explicitly", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("delete_series")!({ id: 5, delete_files: true });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/series/5?deleteFiles=true");
    expect(callAt(mockFetch).method).toBe("DELETE");
  });

  it("edit_series_bulk defaults applyTags to add only when tags are given", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await tools.get("edit_series_bulk")!({ series_ids: [1, 2], tags: [7] });
    expect(callAt(mockFetch).body).toEqual({ seriesIds: [1, 2], tags: [7], applyTags: "add" });

    mockFetch.mockResolvedValueOnce(mockJson([]));
    await tools.get("edit_series_bulk")!({ series_ids: [1], monitored: false });
    expect(callAt(mockFetch, 1).body).toEqual({ seriesIds: [1], monitored: false });
  });

  it("set_season_monitored only touches the requested seasons", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJson({
          id: 1,
          title: "Show",
          seasons: [
            { seasonNumber: 0, monitored: true },
            { seasonNumber: 1, monitored: true },
            { seasonNumber: 2, monitored: true },
          ],
        }),
      )
      .mockResolvedValueOnce(
        mockJson({
          id: 1,
          title: "Show",
          seasons: [
            { seasonNumber: 0, monitored: false },
            { seasonNumber: 1, monitored: true },
            { seasonNumber: 2, monitored: true },
          ],
        }),
      );
    const res = await tools.get("set_season_monitored")!({
      series_id: 1,
      monitored: false,
      season_numbers: [0],
    });
    expect(callAt(mockFetch, 1).body.seasons).toEqual([
      { seasonNumber: 0, monitored: false },
      { seasonNumber: 1, monitored: true },
      { seasonNumber: 2, monitored: true },
    ]);
    expect(payload(res).seasons[0].monitored).toBe(false);
  });

  it("surfaces API errors as tool errors", async () => {
    mockFetch.mockResolvedValueOnce(mockError(404, "not found"));
    const res = await tools.get("get_series")!({ id: 99 });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("404");
  });
});
