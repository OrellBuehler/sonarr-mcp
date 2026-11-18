import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, summarizeEpisode, type SonarrEpisode, READ } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

export function registerCalendarTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "get_calendar",
    "List episodes airing in a date range — what aired recently and what is coming up. Defaults to today and tomorrow on the Sonarr side.",
    {
      start: z.string().optional().describe("ISO 8601 start date, e.g. '2026-09-01'"),
      end: z.string().optional().describe("ISO 8601 end date, e.g. '2026-09-08'"),
      unmonitored: z
        .boolean()
        .optional()
        .describe("Include unmonitored episodes (default false on the Sonarr side)"),
      include_series: z
        .boolean()
        .optional()
        .describe("Include the parent series object; the summary shows seriesTitle either way"),
      include_episode_file: z.boolean().optional().describe("Include the episode file object"),
      tags: z.array(z.number()).optional().describe("Only series carrying these tag ids"),
      detailed: z.boolean().optional().describe("Return full episode objects instead of summaries"),
    },
    READ,
    async ({ start, end, unmonitored, include_series, include_episode_file, tags, detailed }) => {
      try {
        const qs = buildQS({
          start,
          end,
          unmonitored,
          includeSeries: include_series ?? true,
          includeEpisodeFile: include_episode_file,
          tags: tags?.join(","),
        });
        const rows = (await client.get(`/api/v3/calendar${qs}`)) as SonarrEpisode[];
        return ok({
          count: rows.length,
          episodes: detailed ? rows : rows.map(summarizeEpisode),
        });
      } catch (e) {
        return err(e);
      }
    },
  );
}
