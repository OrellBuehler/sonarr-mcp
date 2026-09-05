import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerSettingsTools } from "../tools/settings.js";
import { collectTools, mockJson, stubFetch, callAt } from "./helpers.js";

const { tools } = collectTools(registerSettingsTools);

describe("settings tools", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = stubFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes read-only tools for host and ui config", () => {
    expect(tools.has("get_host_config")).toBe(true);
    expect(tools.has("update_host_config")).toBe(false);
    expect(tools.has("get_ui_config")).toBe(true);
    expect(tools.has("update_ui_config")).toBe(false);
  });

  it("get_media_management_config hits the config endpoint", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({ id: 1 }));
    await tools.get("get_media_management_config")!({});
    expect(callAt(mockFetch).url).toBe("http://sonarr:8989/api/v3/config/mediamanagement");
  });

  it("update_naming_config puts to the id from the config, defaulting to 1", async () => {
    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("update_naming_config")!({ config: { renameEpisodes: true } });
    const call = callAt(mockFetch);
    expect(call.method).toBe("PUT");
    expect(call.url).toBe("http://sonarr:8989/api/v3/config/naming/1");
    expect(call.body).toEqual({ renameEpisodes: true, id: 1 });

    mockFetch.mockResolvedValueOnce(mockJson({}));
    await tools.get("update_naming_config")!({ config: { id: 7, renameEpisodes: false } });
    expect(callAt(mockFetch, 1).url).toBe("http://sonarr:8989/api/v3/config/naming/7");
  });

  it("get_naming_examples loads the saved config when no draft is given", async () => {
    mockFetch
      .mockResolvedValueOnce(mockJson({ id: 1, renameEpisodes: true }))
      .mockResolvedValueOnce(mockJson({ singleEpisodeExample: "x" }));
    await tools.get("get_naming_examples")!({});
    expect(callAt(mockFetch, 0).url).toBe("http://sonarr:8989/api/v3/config/naming");
    expect(callAt(mockFetch, 1).url).toBe(
      "http://sonarr:8989/api/v3/config/naming/examples?id=1&renameEpisodes=true",
    );
  });
});
