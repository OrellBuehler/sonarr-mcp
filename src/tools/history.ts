import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, DESTRUCTIVE, READ } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

const eventTypes = [
  "unknown",
  "grabbed",
  "seriesFolderImported",
  "downloadFolderImported",
  "downloadFailed",
  "episodeFileDeleted",
  "episodeFileRenamed",
  "downloadIgnored",
] as const;

const sortDirection = ["default", "ascending", "descending"] as const;

export function registerHistoryTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "get_history",
    "Page through the grab and import history — what was grabbed, imported, failed, deleted or renamed, and from which indexer.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      page_size: z.number().optional().describe("Items per page (default 10 on the Sonarr side)"),
      sort_key: z.string().optional().describe("Field to sort by, e.g. 'date'"),
      sort_direction: z.enum(sortDirection).optional().describe("Sort direction"),
      event_type: z.array(z.enum(eventTypes)).optional().describe("Only these event types"),
      episode_id: z.number().optional().describe("Only history for this episode id"),
      series_ids: z.array(z.number()).optional().describe("Only history for these series ids"),
      download_id: z.string().optional().describe("Only history for this download client id"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode: z.boolean().optional().describe("Include the episode object"),
    },
    READ,
    async ({
      page,
      page_size,
      sort_key,
      sort_direction,
      event_type,
      episode_id,
      series_ids,
      download_id,
      include_series,
      include_episode,
    }) => {
      try {
        const qs = buildQS({
          page,
          pageSize: page_size,
          sortKey: sort_key,
          sortDirection: sort_direction,
          eventType: event_type?.map((t) => eventTypes.indexOf(t)),
          episodeId: episode_id,
          seriesIds: series_ids,
          downloadId: download_id,
          includeSeries: include_series,
          includeEpisode: include_episode,
        });
        return ok(await client.get(`/api/v3/history${qs}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_history_since",
    "Get every history record since a date, unpaged. Useful for 'what happened since yesterday' style questions.",
    {
      date: z.string().describe("ISO 8601 date or timestamp, e.g. '2026-09-01'"),
      event_type: z.enum(eventTypes).optional().describe("Only this event type"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode: z.boolean().optional().describe("Include the episode object"),
    },
    READ,
    async ({ date, event_type, include_series, include_episode }) => {
      try {
        const qs = buildQS({
          date,
          eventType: event_type,
          includeSeries: include_series,
          includeEpisode: include_episode,
        });
        const data = (await client.get(`/api/v3/history/since${qs}`)) as unknown[];
        return ok({ count: data.length, records: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_series_history",
    "Get the full history for one series, optionally narrowed to a single season.",
    {
      series_id: z.number().int().positive().describe("Sonarr series id"),
      season_number: z.number().optional().describe("Only this season number"),
      event_type: z.enum(eventTypes).optional().describe("Only this event type"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode: z.boolean().optional().describe("Include the episode object"),
    },
    READ,
    async ({ series_id, season_number, event_type, include_series, include_episode }) => {
      try {
        const qs = buildQS({
          seriesId: series_id,
          seasonNumber: season_number,
          eventType: event_type,
          includeSeries: include_series,
          includeEpisode: include_episode,
        });
        const data = (await client.get(`/api/v3/history/series${qs}`)) as unknown[];
        return ok({ count: data.length, records: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "mark_history_item_failed",
    "Mark a grabbed history item as failed. Sonarr blocklists the release and searches for a replacement.",
    { id: z.number().int().positive().describe("History record id") },
    DESTRUCTIVE,
    async ({ id }) => {
      try {
        return ok(await client.post(`/api/v3/history/failed/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );
}
