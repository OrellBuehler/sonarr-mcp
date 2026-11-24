import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerCalendarTools } from "../tools/calendar.js";
import { registerWantedTools } from "../tools/wanted.js";
import { registerHistoryTools } from "../tools/history.js";
import { registerBlocklistTools } from "../tools/blocklist.js";
import { registerOrganizationTools } from "../tools/organization.js";
import { registerProfileTools } from "../tools/profiles.js";
import { collectTools, mockJson, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(
  registerCalendarTools,
  registerWantedTools,
  registerHistoryTools,
  registerBlocklistTools,
  registerOrganizationTools,
  registerProfileTools,
);

describe("calendar, wanted, history and library tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get_calendar includes the series by default and comma-joins tags", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([{ id: 1, seasonNumber: 1, episodeNumber: 1, series: { title: "Show" } }]),
    );
    const res = await tools.get("get_calendar")!({
      start: "2026-09-01",
      end: "2026-09-08",
      tags: [1, 2],
    });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/calendar?start=2026-09-01&end=2026-09-08&includeSeries=true&tags=1%2C2",
    );
    expect(payload(res).episodes[0].seriesTitle).toBe("Show");
  });

  it("get_missing_episodes summarizes the paged records", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson({
        page: 1,
        totalRecords: 2,
        records: [
          { id: 1, seasonNumber: 1, episodeNumber: 1, overview: "long" },
          { id: 2, seasonNumber: 1, episodeNumber: 2, overview: "long" },
        ],
      }),
    );
    const res = await tools.get("get_missing_episodes")!({ page: 1, page_size: 20 });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/wanted/missing?page=1&pageSize=20&includeSeries=true",
    );
    const body = payload(res);
    expect(body.totalRecords).toBe(2);
    expect(body.records[0].overview).toBeUndefined();
  });

  it("get_history sends event types as their numeric ids and repeats series ids", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ records: [] }));
    await tools.get("get_history")!({
      event_type: ["grabbed", "downloadFailed"],
      series_ids: [1, 2],
    });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/history?eventType=1&eventType=4&seriesIds=1&seriesIds=2",
    );
  });

  it("mark_history_item_failed posts to the failed endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("mark_history_item_failed")!({ id: 42 });
    const call = callAt(mockFetch);
    expect(call.method).toBe("POST");
    expect(call.url).toBe("http://sonarr:8989/api/v3/history/failed/42");
  });

  it("remove_blocklist_items sends the ids in the body", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("remove_blocklist_items")!({ ids: [3, 4] });
    const call = callAt(mockFetch);
    expect(call.method).toBe("DELETE");
    expect(call.body).toEqual({ ids: [3, 4] });
  });

  it("list_root_folders reports the unmapped folder count instead of the list", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([{ id: 1, path: "/tv", accessible: true, unmappedFolders: [{}, {}] }]),
    );
    const body = payload(await tools.get("list_root_folders")!({}));
    expect(body.rootFolders[0]).toEqual({
      id: 1,
      path: "/tv",
      accessible: true,
      freeSpace: undefined,
      unmappedFolderCount: 2,
    });
  });

  it("list_import_list_exclusions switches to the paged endpoint when paging is requested", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([{ id: 1 }]));
    await tools.get("list_import_list_exclusions")!({});
    expect(callAt(mockFetch, 0).url).toBe("http://sonarr:8989/api/v3/importlistexclusion");

    mockFetch.mockResolvedValueOnce(mockJson({ records: [] }));
    await tools.get("list_import_list_exclusions")!({ page: 2 });
    expect(callAt(mockFetch, 1).url).toBe(
      "http://sonarr:8989/api/v3/importlistexclusion/paged?page=2",
    );
  });

  it("list_quality_profiles reduces items to the allowed quality names", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([
        {
          id: 1,
          name: "HD",
          cutoff: 9,
          items: [
            { allowed: true, quality: { name: "WEBDL-1080p" } },
            { allowed: false, quality: { name: "SDTV" } },
            { allowed: true, name: "HD Group" },
          ],
        },
      ]),
    );
    const body = payload(await tools.get("list_quality_profiles")!({}));
    expect(body.profiles[0].allowedQualities).toEqual(["WEBDL-1080p", "HD Group"]);
  });

  it("create_tag posts the label", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 3, label: "anime" }));
    await tools.get("create_tag")!({ label: "anime" });
    expect(callAt(mockFetch).body).toEqual({ label: "anime" });
  });
});
