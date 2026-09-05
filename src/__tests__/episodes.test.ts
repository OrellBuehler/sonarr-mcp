import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerEpisodeTools } from "../tools/episodes.js";
import { collectTools, mockJson, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(registerEpisodeTools);

const EPISODES = [
  { id: 1, seriesId: 5, seasonNumber: 1, episodeNumber: 1, hasFile: true, monitored: true },
  { id: 2, seriesId: 5, seasonNumber: 1, episodeNumber: 2, hasFile: false, monitored: true },
  { id: 3, seriesId: 5, seasonNumber: 1, episodeNumber: 3, hasFile: false, monitored: false },
];

describe("episode tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list_episodes builds the query and filters locally", async () => {
    mockFetch.mockResolvedValueOnce(mockJson(EPISODES));
    const res = await tools.get("list_episodes")!({
      series_id: 5,
      season_number: 1,
      missing_only: true,
      monitored: true,
    });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/episode?seriesId=5&seasonNumber=1",
    );
    const body = payload(res);
    expect(body.count).toBe(1);
    expect(body.episodes[0].id).toBe(2);
  });

  it("list_episodes repeats episode_ids as separate query parameters", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([]));
    await tools.get("list_episodes")!({ episode_ids: [1, 2] });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/episode?episodeIds=1&episodeIds=2",
    );
  });

  it("set_episodes_monitored puts the monitor payload", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("set_episodes_monitored")!({ episode_ids: [1, 2], monitored: false });
    const call = callAt(mockFetch);
    expect(call.method).toBe("PUT");
    expect(call.url).toBe("http://sonarr:8989/api/v3/episode/monitor");
    expect(call.body).toEqual({ episodeIds: [1, 2], monitored: false });
  });

  it("delete_episode_files sends the id list in the body", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("delete_episode_files")!({ episode_file_ids: [8, 9] });
    const call = callAt(mockFetch);
    expect(call.method).toBe("DELETE");
    expect(call.url).toBe("http://sonarr:8989/api/v3/episodefile/bulk");
    expect(call.body).toEqual({ episodeFileIds: [8, 9] });
  });

  it("update_episode_files omits fields that were not given", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("update_episode_files")!({ episode_file_ids: [1], release_group: "GRP" });
    expect(callAt(mockFetch).body).toEqual({ episodeFileIds: [1], releaseGroup: "GRP" });
  });
});
