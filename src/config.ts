import { SonarrClient } from "./sonarr/client.js";

const rawUrl = (process.env.SONARR_URL || process.env.SONARR_SERVER || "").trim();
const apiKey = (process.env.SONARR_API_KEY || "").trim();

if (!rawUrl || !apiKey) {
  console.error(
    "SONARR_URL (or SONARR_SERVER) and SONARR_API_KEY environment variables are required. " +
      "The API key is in Sonarr under Settings > General > Security.",
  );
  process.exit(1);
}

export function normalizeBaseUrl(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `http://${url}`;
  return withScheme.replace(/\/+$/, "");
}

const baseUrl = normalizeBaseUrl(rawUrl);

export const config = {
  baseUrl,
  apiKey,
  transport: "stdio" as const,
};

export const client = new SonarrClient(baseUrl, apiKey);
