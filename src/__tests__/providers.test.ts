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

  it("get_indexer redacts private and secret-looking fields", async () => {
    mockFetch.mockResolvedValueOnce(
      mockJson({
        id: 1,
        name: "NZBgeek",
        fields: [
          { name: "baseUrl", value: "https://api.nzbgeek.info", privacy: "normal" },
          { name: "apiKey", value: "geek-key", privacy: "apiKey" },
          { name: "username", value: "bob", privacy: "userName" },
          { name: "password", value: "********", privacy: "password" },
          { name: "passkey", value: "pass-key" },
          { name: "cookie", value: "uid=1; pass=abc", privacy: "normal" },
          { name: "accessToken", value: "tok-1" },
          { name: "webHookUrl", value: "https://discord.com/api/webhooks/1/abc" },
          { name: "feedUrl", value: "https://u:p@tracker.example/rss?apikey=qs-key&t=tv" },
          { name: "categories", value: [5030, 5040], privacy: "normal" },
          { name: "additionalParameters", privacy: "normal" },
          { name: "emptySecret", value: "", privacy: "password" },
        ],
      }),
    );
    const res = await tools.get("get_indexer")!({ id: 1 });
    const text = res.content[0].text;
    for (const secret of [
      "geek-key",
      "bob",
      "pass-key",
      "pass=abc",
      "tok-1",
      "webhooks/1/abc",
      "u:p@",
      "qs-key",
    ]) {
      expect(text).not.toContain(secret);
    }
    const fields = Object.fromEntries(
      payload(res).fields.map((f: { name: string; value: unknown }) => [f.name, f.value]),
    );
    expect(fields).toEqual({
      baseUrl: "https://api.nzbgeek.info",
      apiKey: "[redacted]",
      username: "[redacted]",
      password: "[redacted]",
      passkey: "[redacted]",
      cookie: "[redacted]",
      accessToken: "[redacted]",
      webHookUrl: "[redacted]",
      feedUrl: "https://[redacted]@tracker.example/rss?apikey=[redacted]&t=tv",
      categories: [5030, 5040],
      additionalParameters: undefined,
      emptySecret: "",
    });
  });

  it("schema, create, update and test output is redacted too", async () => {
    const resource = { id: 3, fields: [{ name: "apiKey", value: "leak", privacy: "apiKey" }] };
    const cases: [string, unknown, unknown][] = [
      [
        "get_notification_schema",
        { implementation: "Discord" },
        [{ implementation: "Discord", presets: [resource], fields: resource.fields }],
      ],
      ["create_notification", { config: { name: "n" } }, resource],
      ["update_notification", { id: 3, config: { name: "n" } }, resource],
      ["test_notification", { config: { name: "n" } }, resource],
    ];
    for (const [tool, args, response] of cases) {
      mockFetch.mockResolvedValueOnce(mockJson(response));
      const res = await tools.get(tool)!(args);
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).not.toContain("leak");
      expect(res.content[0].text).toContain("[redacted]");
    }
  });

  it("update_indexer swaps redacted placeholders for the stored values", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJson({
          id: 1,
          name: "old",
          fields: [
            { name: "baseUrl", value: "https://old.example" },
            { name: "apiKey", value: "stored-key", privacy: "apiKey" },
            { name: "feedUrl", value: "https://u:p@tracker.example/rss" },
          ],
        }),
      )
      .mockResolvedValueOnce(mockJson({ id: 1 }));
    await tools.get("update_indexer")!({
      id: 1,
      config: {
        id: 1,
        name: "new",
        fields: [
          { name: "baseUrl", value: "https://new.example" },
          { name: "apiKey", value: "[redacted]", privacy: "apiKey" },
          { name: "feedUrl", value: "https://[redacted]@tracker.example/rss" },
        ],
      },
    });
    expect(callAt(mockFetch, 0).url).toBe("http://sonarr:8989/api/v3/indexer/1");
    const put = callAt(mockFetch, 1);
    expect(put.method).toBe("PUT");
    expect(put.body).toEqual({
      id: 1,
      name: "new",
      fields: [
        { name: "baseUrl", value: "https://new.example" },
        { name: "apiKey", value: "stored-key", privacy: "apiKey" },
        { name: "feedUrl", value: "https://u:p@tracker.example/rss" },
      ],
    });
  });

  it("update_indexer sends new secrets through unchanged without an extra read", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1 }));
    const config = { id: 1, fields: [{ name: "apiKey", value: "brand-new" }] };
    await tools.get("update_indexer")!({ id: 1, config });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(callAt(mockFetch).body).toEqual(config);
  });

  it("never writes a placeholder that has no stored value", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1, fields: [] }));
    const update = await tools.get("update_indexer")!({
      id: 1,
      config: { fields: [{ name: "apiKey", value: "[redacted]" }] },
    });
    expect(update.isError).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(callAt(mockFetch).method).toBe("GET");

    mockFetch.mockClear();
    const create = await tools.get("create_indexer")!({
      config: { fields: [{ name: "apiKey", value: "[redacted]" }] },
    });
    expect(create.isError).toBe(true);
    const draft = await tools.get("test_indexer")!({
      config: { fields: [{ name: "apiKey", value: "[redacted]" }] },
    });
    expect(draft.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("test_indexer resolves placeholders in a draft of a saved provider", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson({ id: 5, fields: [{ name: "apiKey", value: "stored" }] }))
      .mockResolvedValueOnce(mockJson({}));
    await tools.get("test_indexer")!({
      config: { id: 5, fields: [{ name: "apiKey", value: "[redacted]" }] },
    });
    expect(callAt(mockFetch, 0).url).toBe("http://sonarr:8989/api/v3/indexer/5");
    expect(callAt(mockFetch, 1).body).toEqual({
      id: 5,
      fields: [{ name: "apiKey", value: "stored" }],
    });
  });

  it("test_import_list requires an id or a config", async () => {
    const res = await tools.get("test_import_list")!({});
    expect(res.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
