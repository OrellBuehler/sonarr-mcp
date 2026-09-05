import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

const sortDirection = ["default", "ascending", "descending"] as const;

export function registerQueueTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "get_queue",
    "List the download queue — everything Sonarr is currently downloading or waiting to import, with progress, status and any error messages.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      page_size: z.number().optional().describe("Items per page (default 10 on the Sonarr side)"),
      sort_key: z.string().optional().describe("Field to sort by, e.g. 'timeleft', 'progress'"),
      sort_direction: z.enum(sortDirection).optional().describe("Sort direction"),
      series_ids: z.array(z.number()).optional().describe("Only items for these series ids"),
      protocol: z.enum(["unknown", "usenet", "torrent"]).optional().describe("Filter by protocol"),
      status: z
        .array(z.string())
        .optional()
        .describe("Filter by queue status, e.g. ['downloading', 'completed', 'warning']"),
      include_unknown_series_items: z
        .boolean()
        .optional()
        .describe("Include downloads Sonarr could not map to a series"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode: z.boolean().optional().describe("Include the episode object"),
    },
    async ({
      page,
      page_size,
      sort_key,
      sort_direction,
      series_ids,
      protocol,
      status,
      include_unknown_series_items,
      include_series,
      include_episode,
    }) => {
      try {
        const qs = buildQS({
          page,
          pageSize: page_size,
          sortKey: sort_key,
          sortDirection: sort_direction,
          seriesIds: series_ids,
          protocol,
          status,
          includeUnknownSeriesItems: include_unknown_series_items,
          includeSeries: include_series,
          includeEpisode: include_episode,
        });
        return ok(await client.get(`/api/v3/queue${qs}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_queue_details",
    "Get the full, unpaged queue with per-episode detail. Useful for finding the queue item id of a specific episode.",
    {
      series_id: z.number().optional().describe("Only items for this series id"),
      episode_ids: z.array(z.number()).optional().describe("Only items for these episode ids"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode: z.boolean().optional().describe("Include the episode object"),
    },
    async ({ series_id, episode_ids, include_series, include_episode }) => {
      try {
        const qs = buildQS({
          seriesId: series_id,
          episodeIds: episode_ids,
          includeSeries: include_series,
          includeEpisode: include_episode,
        });
        const data = (await client.get(`/api/v3/queue/details${qs}`)) as unknown[];
        return ok({ count: data.length, items: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_queue_status",
    "Get queue counts by state — total, errors, warnings and how many items need manual interaction.",
    {},
    async () => {
      try {
        return ok(await client.get("/api/v3/queue/status"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "remove_queue_item",
    "Remove one item from the queue, optionally also removing it from the download client and blocklisting the release so it is not grabbed again.",
    {
      id: z.number().describe("Queue item id"),
      remove_from_client: z
        .boolean()
        .optional()
        .describe("Also remove the download from the download client (default true)"),
      blocklist: z
        .boolean()
        .optional()
        .describe("Blocklist the release so Sonarr does not grab it again (default false)"),
      skip_redownload: z
        .boolean()
        .optional()
        .describe("Do not immediately search for a replacement (default false)"),
      change_category: z
        .boolean()
        .optional()
        .describe("Move the download to the post-import category instead of deleting it"),
    },
    async ({ id, remove_from_client, blocklist, skip_redownload, change_category }) => {
      try {
        const qs = buildQS({
          removeFromClient: remove_from_client ?? true,
          blocklist: blocklist ?? false,
          skipRedownload: skip_redownload ?? false,
          changeCategory: change_category,
        });
        return ok(await client.delete(`/api/v3/queue/${id}${qs}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "remove_queue_items",
    "Remove several queue items at once, with the same options as remove_queue_item.",
    {
      ids: z.array(z.number()).describe("Queue item ids"),
      remove_from_client: z.boolean().optional().describe("Also remove from the download client"),
      blocklist: z.boolean().optional().describe("Blocklist the releases"),
      skip_redownload: z.boolean().optional().describe("Do not search for replacements"),
      change_category: z.boolean().optional().describe("Move to the post-import category"),
    },
    async ({ ids, remove_from_client, blocklist, skip_redownload, change_category }) => {
      try {
        const qs = buildQS({
          removeFromClient: remove_from_client ?? true,
          blocklist: blocklist ?? false,
          skipRedownload: skip_redownload ?? false,
          changeCategory: change_category,
        });
        return ok(await client.delete(`/api/v3/queue/bulk${qs}`, { ids }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "grab_queue_item",
    "Force Sonarr to import a queue item that is stuck pending or waiting on manual interaction.",
    { id: z.number().describe("Queue item id") },
    async ({ id }) => {
      try {
        return ok(await client.post(`/api/v3/queue/grab/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "grab_queue_items",
    "Force import of several stuck queue items at once.",
    { ids: z.array(z.number()).describe("Queue item ids") },
    async ({ ids }) => {
      try {
        return ok(await client.post("/api/v3/queue/grab/bulk", { ids }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
