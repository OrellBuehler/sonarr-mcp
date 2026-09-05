import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exits when the URL or the API key is missing", async () => {
    vi.stubEnv("SONARR_URL", "");
    vi.stubEnv("SONARR_SERVER", "");
    vi.stubEnv("SONARR_API_KEY", "");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exited");
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(import("../config.js")).rejects.toThrow("exited");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("accepts SONARR_SERVER and adds a missing scheme", async () => {
    vi.stubEnv("SONARR_URL", "");
    vi.stubEnv("SONARR_SERVER", "sonarr.local:8989/");
    vi.stubEnv("SONARR_API_KEY", "abc");
    const { config, client } = await import("../config.js");
    expect(config.baseUrl).toBe("http://sonarr.local:8989");
    expect(client.apiKey).toBe("abc");
  });

  it("keeps an explicit https scheme and strips trailing slashes", async () => {
    vi.stubEnv("SONARR_URL", "https://sonarr.example.com///");
    vi.stubEnv("SONARR_API_KEY", "abc");
    const { config } = await import("../config.js");
    expect(config.baseUrl).toBe("https://sonarr.example.com");
  });
});
