import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, summarizeRelease, READ, WRITE } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

export function registerReleaseTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "search_releases",
    "Run an interactive indexer search and return the releases found, with quality, size, seeders, custom format score and any rejection reasons. Pass the guid and indexerId of the one you want to grab_release. This can take a while — indexers are queried live.",
    {
      episode_id: z.number().optional().describe("Search for a single episode"),
      series_id: z.number().optional().describe("Series id; combine with season_number"),
      season_number: z
        .number()
        .optional()
        .describe("Season number to search for; requires series_id"),
      include_rejected: z
        .boolean()
        .optional()
        .describe("Include releases Sonarr rejected (default true)"),
      detailed: z.boolean().optional().describe("Return full release objects instead of summaries"),
    },
    READ,
    async ({ episode_id, series_id, season_number, include_rejected, detailed }) => {
      try {
        const qs = buildQS({
          episodeId: episode_id,
          seriesId: series_id,
          seasonNumber: season_number,
        });
        let rows = (await client.get(`/api/v3/release${qs}`)) as Record<string, unknown>[];
        if (include_rejected === false) rows = rows.filter((r) => !r.rejected);
        return ok({
          count: rows.length,
          releases: detailed ? rows : rows.map(summarizeRelease),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "grab_release",
    "Send a release from search_releases to the download client.",
    {
      guid: z.string().describe("Release guid from search_releases"),
      indexer_id: z.number().describe("indexerId of the release from search_releases"),
    },
    WRITE,
    async ({ guid, indexer_id }) => {
      try {
        return ok(await client.post("/api/v3/release", { guid, indexerId: indexer_id }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_manual_import_candidates",
    "List files in a folder or a stuck download with the series and episodes Sonarr would map them to, plus any rejection reasons. Use this to diagnose imports that need manual interaction.",
    {
      folder: z.string().optional().describe("Absolute path of a folder to inspect"),
      download_id: z.string().optional().describe("Download client id of a stuck download"),
      series_id: z.number().optional().describe("Force mapping to this series id"),
      season_number: z.number().optional().describe("Force mapping to this season number"),
      filter_existing_files: z
        .boolean()
        .optional()
        .describe("Hide files that are already in the library (default true)"),
    },
    READ,
    async ({ folder, download_id, series_id, season_number, filter_existing_files }) => {
      try {
        const qs = buildQS({
          folder,
          downloadId: download_id,
          seriesId: series_id,
          seasonNumber: season_number,
          filterExistingFiles: filter_existing_files,
        });
        const data = (await client.get(`/api/v3/manualimport${qs}`)) as unknown[];
        return ok({ count: data.length, items: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_rename_preview",
    "Preview which existing files would be renamed under the current naming configuration, showing the old and new paths. Run the RenameFiles command to apply.",
    {
      series_id: z.number().int().positive().describe("Sonarr series id"),
      season_number: z.number().optional().describe("Only this season number"),
    },
    READ,
    async ({ series_id, season_number }) => {
      try {
        const qs = buildQS({ seriesId: series_id, seasonNumber: season_number });
        const data = (await client.get(`/api/v3/rename${qs}`)) as unknown[];
        return ok({ count: data.length, files: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "parse_release_title",
    "Parse a release title or file path the way Sonarr does, showing the series, season and episodes it maps to and the detected quality.",
    {
      title: z.string().optional().describe("Release title to parse"),
      path: z.string().optional().describe("File path to parse instead of a title"),
    },
    READ,
    async ({ title, path }) => {
      try {
        return ok(await client.get(`/api/v3/parse${buildQS({ title, path })}`));
      } catch (e) {
        return err(e);
      }
    },
  );
}
