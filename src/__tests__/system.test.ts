import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerSystemTools } from "../tools/system.js";
import { collectTools, mockJson, mockText, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(registerSystemTools);

describe("system tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("get_health wraps the issue list with a count", async () => {
    mockFetch.mockResolvedValueOnce(mockJson([{ source: "IndexerStatusCheck", type: "warning" }]));
    const body = payload(await tools.get("get_health")!({}));
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/health");
    expect(body.count).toBe(1);
  });

  it("list_logs defaults to newest first", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ records: [] }));
    await tools.get("list_logs")!({ level: "error" });
    expect(callAt(mockFetch).url).toBe(
      "http://sonarr:8989/api/v3/log?sortKey=time&sortDirection=descending&level=error",
    );
  });

  it("get_log_file returns the raw text unquoted", async () => {
    mockFetch.mockResolvedValueOnce(mockText("2026-09-05 error boom"));
    const res = await tools.get("get_log_file")!({ filename: "sonarr.txt" });
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/log/file/sonarr.txt");
    expect(res.content[0].text).toBe("2026-09-05 error boom");
  });

  it("restart_sonarr posts to the restart endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("restart_sonarr")!({});
    const call = callAt(mockFetch);
    expect(call.method).toBe("POST");
    expect(call.url).toBe("http://sonarr:8989/api/v3/system/restart");
  });
});
