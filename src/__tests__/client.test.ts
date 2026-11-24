import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SonarrClient } from "../sonarr/client.js";
import { mockJson, mockText, mockError, stubFetch, callAt } from "./helpers.js";

describe("SonarrClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the X-Api-Key header against the trimmed base URL", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ ok: 1 }));
    const client = new SonarrClient("http://sonarr:8989//", "secret-key");
    await client.get("/api/v3/series");
    const call = callAt(mockFetch);
    expect(call.url).toBe("http://sonarr:8989/api/v3/series");
    expect(call.headers["X-Api-Key"]).toBe("secret-key");
    expect(call.headers["Content-Type"]).toBeUndefined();
  });

  it("refuses to follow redirects so the API key is never forwarded", async () => {
    mockFetch.mockResolvedValue(mockJson({ ok: 1 }));
    const client = new SonarrClient("http://sonarr:8989", "secret-key");
    await client.get("/api/v3/series");
    await client.post("/api/v3/tag", { label: "x" });
    await client.fetch("/api/v3/series", { redirect: "follow" });
    await client.fetchText("/api/v3/log/file/sonarr.txt");
    expect(mockFetch).toHaveBeenCalledTimes(4);
    for (const [, options] of mockFetch.mock.calls) {
      expect(options.redirect).toBe("error");
    }
  });

  it("sets Content-Type only when there is a JSON body", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1 }));
    const client = new SonarrClient("http://sonarr:8989", "k");
    await client.post("/api/v3/tag", { label: "anime" });
    const call = callAt(mockFetch);
    expect(call.method).toBe("POST");
    expect(call.headers["Content-Type"]).toBe("application/json");
    expect(call.body).toEqual({ label: "anime" });
  });

  it("throws with the status and response body on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce(mockError(400, '{"message":"nope"}'));
    const client = new SonarrClient("http://sonarr:8989", "k");
    await expect(client.get("/api/v3/series")).rejects.toThrow(
      '400 Bad Request: {"message":"nope"}',
    );
  });

  it("redacts api keys from error bodies", async () => {
    mockFetch.mockResolvedValueOnce(
      mockError(
        400,
        '[{"errorMessage":"failed: [GET] at [http://prowlarr:9696/4/api?t=tvsearch\\u0026apikey=88ef17\\u0026offset=0]. echo sonarr-key"}]',
      ),
    );
    const client = new SonarrClient("http://sonarr:8989", "sonarr-key");
    const error = await client.get("/api/v3/indexer/test").catch((e: Error) => e);
    expect(String(error)).not.toContain("88ef17");
    expect(String(error)).not.toContain("sonarr-key");
    expect(String(error)).toContain("\\u0026apikey=[redacted]\\u0026offset=0");
  });

  it("returns success for 204 and for an empty JSON body", async () => {
    const client = new SonarrClient("http://sonarr:8989", "k");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: "No Content",
      headers: new Headers(),
      text: () => Promise.resolve(""),
    });
    expect(await client.delete("/api/v3/tag/1")).toEqual({ success: true });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(""),
    });
    expect(await client.post("/api/v3/queue/grab/1")).toEqual({ success: true });
  });

  it("returns raw text for non-JSON responses", async () => {
    mockFetch.mockResolvedValueOnce(mockText("log line"));
    const client = new SonarrClient("http://sonarr:8989", "k");
    expect(await client.fetchText("/api/v3/log/file/sonarr.txt")).toBe("log line");
  });

  it("wraps a request timeout in a readable error", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    const client = new SonarrClient("http://sonarr:8989", "k", 5);
    await expect(client.get("/api/v3/series")).rejects.toThrow(
      "Sonarr request timed out after 5ms",
    );
  });
});
