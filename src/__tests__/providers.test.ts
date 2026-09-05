import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerProviderTools } from "../tools/providers.js";
import { collectTools, mockJson, stubFetch, callAt, payload } from "./helpers.js";

const { tools } = collectTools(registerProviderTools);

describe("provider tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the same seven tools for every provider kind", () => {
    for (const [singular, plural] of [
      ["indexer", "indexers"],
      ["download_client", "download_clients"],
      ["import_list", "import_lists"],
      ["notification", "notifications"],
    ]) {
      expect(tools.has(`list_${plural}`)).toBe(true);
      for (const verb of ["get", "create", "update", "delete", "test"]) {
        expect(tools.has(`${verb}_${singular}`)).toBe(true);
      }
      expect(tools.has(`get_${singular}_schema`)).toBe(true);
    }
  });

  it("list_indexers strips the fields and presets arrays", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson([{ id: 1, name: "NZBgeek", fields: [{ name: "apiKey" }], presets: [{}] }]),
    );
    const res = await tools.get("list_indexers")!({});
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/indexer");
    const body = payload(res);
    expect(body.indexers[0]).toEqual({ id: 1, name: "NZBgeek" });
  });

  it("get_indexer_schema lists implementations, or one schema when filtered", async () => {
    const schema = [
      { implementation: "Newznab", implementationName: "Newznab", fields: [{ name: "baseUrl" }] },
      { implementation: "Torznab", implementationName: "Torznab", fields: [] },
    ];
    mockFetch.mockResolvedValueOnce(mockJson(schema));
    expect(payload(await tools.get("get_indexer_schema")!({})).count).toBe(2);

    mockFetch.mockResolvedValueOnce(mockJson(schema));
    const filtered = payload(await tools.get("get_indexer_schema")!({ implementation: "newznab" }));
    expect(filtered.count).toBe(1);
    expect(filtered.schemas[0].fields).toEqual([{ name: "baseUrl" }]);
  });

  it("update_download_client forces the id into the body", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("update_download_client")!({ id: 4, config: { name: "sab", id: 99 } });
    const call = callAt(mockFetch);
    expect(call.method).toBe("PUT");
    expect(call.url).toBe("http://sonarr:8989/api/v3/downloadclient/4");
    expect(call.body).toEqual({ name: "sab", id: 4 });
  });

  it("test_notification fetches the saved config when only an id is given", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson({ id: 2, name: "discord" }))
      .mockResolvedValueOnce(mockJson({}));
    await tools.get("test_notification")!({ id: 2 });
    expect(callAt(mockFetch, 0).url).toBe("http://sonarr:8989/api/v3/notification/2");
    const post = callAt(mockFetch, 1);
    expect(post.url).toBe("http://sonarr:8989/api/v3/notification/test");
    expect(post.body).toEqual({ id: 2, name: "discord" });
  });

  it("test_import_list requires an id or a config", async () => {
    const res = await tools.get("test_import_list")!({});
    expect(res.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
