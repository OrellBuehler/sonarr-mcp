import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerQueueTools } from "../tools/queue.js";
import { collectTools, mockJson, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(registerQueueTools);

describe("queue tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get_queue forwards paging and repeated filters", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ page: 1, records: [] }));
    await tools.get("get_queue")!({
      page: 2,
      page_size: 50,
      series_ids: [3, 4],
      status: ["warning"],
      protocol: "torrent",
    });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/queue?page=2&pageSize=50&seriesIds=3&seriesIds=4&protocol=torrent&status=warning",
    );
  });

  it("remove_queue_item defaults removeFromClient true and blocklist false", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("remove_queue_item")!({ id: 12 });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/queue/12?removeFromClient=true&blocklist=false&skipRedownload=false",
    );
  });

  it("remove_queue_items sends ids in the body and flags in the query", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("remove_queue_items")!({ ids: [1, 2], blocklist: true });
    const call = callAt(mockFetch);
    expect(call.url).toBe(
      "http://sonarr:8989/api/v3/queue/bulk?removeFromClient=true&blocklist=true&skipRedownload=false",
    );
    expect(call.body).toEqual({ ids: [1, 2] });
  });

  it("get_queue_details counts the returned items", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([{ id: 1 }, { id: 2 }]));
    const res = await tools.get("get_queue_details")!({ series_id: 5 });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/queue/details?seriesId=5");
    expect(payload(res).count).toBe(2);
  });

  it("grab_queue_item posts without a body", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("grab_queue_item")!({ id: 7 });
    const call = callAt(mockFetch);
    expect(call.method).toBe("POST");
    expect(call.url).toBe("http://sonarr:8989/api/v3/queue/grab/7");
    expect(call.body).toBeUndefined();
  });
});
