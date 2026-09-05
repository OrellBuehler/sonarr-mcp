import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, summarizeEpisode, summarizeList } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

const sortDirection = ["default", "ascending", "descending"] as const;

export function registerWantedTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "get_missing_episodes",
    "Page through monitored episodes that have already aired but have no file — the wanted/missing list.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      page_size: z.number().optional().describe("Items per page (default 10 on the Sonarr side)"),
      sort_key: z.string().optional().describe("Field to sort by, e.g. 'airDateUtc'"),
      sort_direction: z.enum(sortDirection).optional().describe("Sort direction"),
      monitored: z
        .boolean()
        .optional()
        .describe("Only monitored episodes (default true on the Sonarr side)"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      detailed: z.boolean().optional().describe("Return full episode objects instead of summaries"),
    },
    async ({ page, page_size, sort_key, sort_direction, monitored, include_series, detailed }) => {
      try {
        const qs = buildQS({
          page,
          pageSize: page_size,
          sortKey: sort_key,
          sortDirection: sort_direction,
          monitored,
          includeSeries: include_series ?? true,
        });
        const data = await client.get(`/api/v3/wanted/missing${qs}`);
        return ok(summarizeList(data, summarizeEpisode, detailed));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_cutoff_unmet_episodes",
    "Page through episodes that have a file but have not reached their quality profile cutoff — candidates for an upgrade.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      page_size: z.number().optional().describe("Items per page (default 10 on the Sonarr side)"),
      sort_key: z.string().optional().describe("Field to sort by, e.g. 'airDateUtc'"),
      sort_direction: z.enum(sortDirection).optional().describe("Sort direction"),
      monitored: z.boolean().optional().describe("Only monitored episodes"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode_file: z.boolean().optional().describe("Include the current episode file"),
      detailed: z.boolean().optional().describe("Return full episode objects instead of summaries"),
    },
    async ({
      page,
      page_size,
      sort_key,
      sort_direction,
      monitored,
      include_series,
      include_episode_file,
      detailed,
    }) => {
      try {
        const qs = buildQS({
          page,
          pageSize: page_size,
          sortKey: sort_key,
          sortDirection: sort_direction,
          monitored,
          includeSeries: include_series ?? true,
          includeEpisodeFile: include_episode_file,
        });
        const data = await client.get(`/api/v3/wanted/cutoff${qs}`);
        return ok(summarizeList(data, summarizeEpisode, detailed));
      } catch (e) {
        return err(e);
      }
    },
  );
}
