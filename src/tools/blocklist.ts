import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, DELETE, READ } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

const sortDirection = ["default", "ascending", "descending"] as const;

export function registerBlocklistTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "get_blocklist",
    "Page through blocklisted releases — releases Sonarr has been told never to grab again, with the reason they were blocked.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      page_size: z.number().optional().describe("Items per page (default 10 on the Sonarr side)"),
      sort_key: z.string().optional().describe("Field to sort by, e.g. 'date'"),
      sort_direction: z.enum(sortDirection).optional().describe("Sort direction"),
      series_ids: z.array(z.number()).optional().describe("Only entries for these series ids"),
      protocols: z
        .array(z.enum(["unknown", "usenet", "torrent"]))
        .optional()
        .describe("Only these download protocols"),
    },
    READ,
    async ({ page, page_size, sort_key, sort_direction, series_ids, protocols }) => {
      try {
        const qs = buildQS({
          page,
          pageSize: page_size,
          sortKey: sort_key,
          sortDirection: sort_direction,
          seriesIds: series_ids,
          protocols,
        });
        return ok(await client.get(`/api/v3/blocklist${qs}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "remove_blocklist_item",
    "Remove one release from the blocklist so Sonarr may grab it again.",
    { id: z.number().int().positive().describe("Blocklist entry id") },
    DELETE,
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/blocklist/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "remove_blocklist_items",
    "Remove several releases from the blocklist at once.",
    { ids: z.array(z.number()).describe("Blocklist entry ids") },
    DELETE,
    async ({ ids }) => {
      try {
        return ok(await client.delete("/api/v3/blocklist/bulk", { ids }));
      } catch (e) {
        return err(e);
      }
    },
  );
}
