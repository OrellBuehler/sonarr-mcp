import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

function summarizeCommand(c: Record<string, unknown>): Record<string, unknown> {
  return {
    id: c.id,
    name: c.commandName ?? c.name,
    status: c.status,
    queued: c.queued,
    started: c.started,
    ended: c.ended,
    duration: c.duration,
    trigger: c.trigger,
    message: c.message,
    exception: c.exception,
  };
}

export function registerCommandTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "list_commands",
    "List commands Sonarr is currently running or has recently run, with their status and duration.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/command")) as Record<string, unknown>[];
        return ok({ count: data.length, commands: data.map(summarizeCommand) });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_command",
    "Get the status of a single command by id — poll this after starting a search or refresh.",
    { id: z.number().describe("Command id returned when the command was queued") },
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/command/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "run_command",
    "Queue any Sonarr command by name. Known names: RefreshSeries, RescanSeries, EpisodeSearch, SeasonSearch, SeriesSearch, MissingEpisodeSearch, CutoffUnmetEpisodeSearch, DownloadedEpisodesScan, RenameFiles, RenameSeries, RssSync, RefreshMonitoredDownloads, ImportListSync, ManualImport, ClearBlocklist, CheckHealth, Housekeeping, Backup, ApplicationUpdate. Prefer the dedicated tools (refresh_series, search_series, ...) where one exists.",
    {
      name: z.string().describe("Command name, e.g. 'RssSync'"),
      params: z
        .record(z.unknown())
        .optional()
        .describe("Extra command body fields, e.g. { seriesId: 12 } or { episodeIds: [1, 2] }"),
    },
    async ({ name, params }) => {
      try {
        const res = (await client.post("/api/v3/command", {
          name,
          ...(params ?? {}),
        })) as Record<string, unknown>;
        return ok(summarizeCommand(res));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "cancel_command",
    "Cancel a queued or running command.",
    { id: z.number().describe("Command id") },
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/command/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "refresh_series",
    "Refresh metadata from TVDB for one series, or for the whole library when no id is given.",
    { series_id: z.number().optional().describe("Sonarr series id; all series when omitted") },
    async ({ series_id }) => {
      try {
        const res = (await client.post("/api/v3/command", {
          name: "RefreshSeries",
          ...(series_id === undefined ? {} : { seriesId: series_id }),
        })) as Record<string, unknown>;
        return ok(summarizeCommand(res));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "rescan_series",
    "Rescan the folder of one series (or all series) to pick up files added or removed outside Sonarr.",
    { series_id: z.number().optional().describe("Sonarr series id; all series when omitted") },
    async ({ series_id }) => {
      try {
        const res = (await client.post("/api/v3/command", {
          name: "RescanSeries",
          ...(series_id === undefined ? {} : { seriesId: series_id }),
        })) as Record<string, unknown>;
        return ok(summarizeCommand(res));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "search_series",
    "Start an automatic search for all monitored missing episodes of a series.",
    { series_id: z.number().describe("Sonarr series id") },
    async ({ series_id }) => {
      try {
        const res = (await client.post("/api/v3/command", {
          name: "SeriesSearch",
          seriesId: series_id,
        })) as Record<string, unknown>;
        return ok(summarizeCommand(res));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "search_season",
    "Start an automatic search for one season of a series.",
    {
      series_id: z.number().describe("Sonarr series id"),
      season_number: z.number().describe("Season number (0 is specials)"),
    },
    async ({ series_id, season_number }) => {
      try {
        const res = (await client.post("/api/v3/command", {
          name: "SeasonSearch",
          seriesId: series_id,
          seasonNumber: season_number,
        })) as Record<string, unknown>;
        return ok(summarizeCommand(res));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "search_episodes",
    "Start an automatic search for specific episodes. Use search_releases first if you want to pick a release by hand.",
    { episode_ids: z.array(z.number()).describe("Sonarr episode ids") },
    async ({ episode_ids }) => {
      try {
        const res = (await client.post("/api/v3/command", {
          name: "EpisodeSearch",
          episodeIds: episode_ids,
        })) as Record<string, unknown>;
        return ok(summarizeCommand(res));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_scheduled_tasks",
    "List Sonarr's scheduled maintenance tasks with their interval and last and next execution times.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/system/task")) as unknown[];
        return ok({ count: data.length, tasks: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_scheduled_task",
    "Get a single scheduled task by id.",
    { id: z.number().describe("Scheduled task id") },
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/system/task/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );
}
