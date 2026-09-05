import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildQS,
  ok,
  err,
  pruneUndefined,
  summarizeEpisode,
  type SonarrEpisode,
} from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

export function registerEpisodeTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "list_episodes",
    "List episodes as compact summaries (id, season/episode number, title, air date, hasFile, monitored). Filter by series, season or episode file. Use get_episode for the full object.",
    {
      series_id: z.number().optional().describe("Only episodes of this Sonarr series id"),
      season_number: z
        .number()
        .optional()
        .describe("Only this season number (0 is specials); requires series_id"),
      episode_ids: z.array(z.number()).optional().describe("Fetch these specific episode ids"),
      episode_file_id: z
        .number()
        .optional()
        .describe("Only episodes linked to this episode file id"),
      include_series: z.boolean().optional().describe("Include the parent series object"),
      include_episode_file: z.boolean().optional().describe("Include the episode file object"),
      missing_only: z.boolean().optional().describe("Only episodes without a file (hasFile false)"),
      monitored: z.boolean().optional().describe("Only monitored (true) or unmonitored (false)"),
      detailed: z.boolean().optional().describe("Return full episode objects instead of summaries"),
    },
    async ({
      series_id,
      season_number,
      episode_ids,
      episode_file_id,
      include_series,
      include_episode_file,
      missing_only,
      monitored,
      detailed,
    }) => {
      try {
        const qs = buildQS({
          seriesId: series_id,
          seasonNumber: season_number,
          episodeIds: episode_ids,
          episodeFileId: episode_file_id,
          includeSeries: include_series,
          includeEpisodeFile: include_episode_file,
        });
        let rows = (await client.get(`/api/v3/episode${qs}`)) as SonarrEpisode[];
        if (missing_only) rows = rows.filter((e) => !e.hasFile);
        if (monitored !== undefined) rows = rows.filter((e) => e.monitored === monitored);
        return ok({
          count: rows.length,
          episodes: detailed ? rows : rows.map(summarizeEpisode),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_episode",
    "Get the full episode object, including the overview and the linked episode file with its quality and media info.",
    { id: z.number().describe("Sonarr episode id") },
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/episode/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "set_episodes_monitored",
    "Monitor or unmonitor individual episodes. Use set_season_monitored for whole seasons.",
    {
      episode_ids: z.array(z.number()).describe("Sonarr episode ids"),
      monitored: z.boolean().describe("true to monitor, false to unmonitor"),
    },
    async ({ episode_ids, monitored }) => {
      try {
        return ok(
          await client.put("/api/v3/episode/monitor", { episodeIds: episode_ids, monitored }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_episode_files",
    "List episode files on disk for a series, with path, size, quality, languages and release group.",
    {
      series_id: z.number().optional().describe("Sonarr series id"),
      episode_file_ids: z.array(z.number()).optional().describe("Fetch these specific file ids"),
    },
    async ({ series_id, episode_file_ids }) => {
      try {
        const data = (await client.get(
          `/api/v3/episodefile${buildQS({
            seriesId: series_id,
            episodeFileIds: episode_file_ids,
          })}`,
        )) as unknown[];
        return ok({ count: data.length, files: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_episode_file",
    "Get a single episode file, including its full media info.",
    { id: z.number().describe("Episode file id") },
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/episodefile/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_episode_file",
    "Delete one episode file from disk. The episode stays in the library and becomes missing.",
    { id: z.number().describe("Episode file id") },
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/episodefile/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_episode_files",
    "Delete several episode files from disk in one call.",
    { episode_file_ids: z.array(z.number()).describe("Episode file ids to delete") },
    async ({ episode_file_ids }) => {
      try {
        return ok(
          await client.delete("/api/v3/episodefile/bulk", { episodeFileIds: episode_file_ids }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_episode_files",
    "Change the recorded quality, languages, release group or scene name of existing episode files (the file editor). Does not touch the files on disk.",
    {
      episode_file_ids: z.array(z.number()).describe("Episode file ids to update"),
      quality: z
        .record(z.unknown())
        .optional()
        .describe("QualityModel object, e.g. { quality: { id: 9 }, revision: { version: 1 } }"),
      languages: z
        .array(z.record(z.unknown()))
        .optional()
        .describe("Language objects, e.g. [{ id: 1, name: 'English' }] — see list_languages"),
      release_group: z.string().optional().describe("Release group to record"),
      scene_name: z.string().optional().describe("Scene name to record"),
    },
    async ({ episode_file_ids, quality, languages, release_group, scene_name }) => {
      try {
        const body = pruneUndefined({
          episodeFileIds: episode_file_ids,
          quality,
          languages,
          releaseGroup: release_group,
          sceneName: scene_name,
        });
        return ok(await client.put("/api/v3/episodefile/editor", body));
      } catch (e) {
        return err(e);
      }
    },
  );
}
