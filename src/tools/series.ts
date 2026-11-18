import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildQS,
  ok,
  err,
  pruneUndefined,
  summarizeSeries,
  type SonarrSeries,
  DELETE,
  READ,
  UPDATE,
  WRITE,
} from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

const monitorTypes = [
  "unknown",
  "all",
  "future",
  "missing",
  "existing",
  "firstSeason",
  "lastSeason",
  "latestSeason",
  "pilot",
  "recent",
  "monitorSpecials",
  "unmonitorSpecials",
  "none",
  "skip",
] as const;

const seriesTypes = ["standard", "daily", "anime"] as const;

export function registerSeriesTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "list_series",
    "List all series in the Sonarr library as compact summaries (id, title, year, status, monitored, quality profile, path, statistics). Use get_series for the full object with seasons, images and alternate titles.",
    {
      search: z
        .string()
        .optional()
        .describe("Case-insensitive substring matched against the series title"),
      monitored: z.boolean().optional().describe("Only monitored (true) or unmonitored (false)"),
      tvdb_id: z.number().optional().describe("Look up a single series by its TVDB id"),
      detailed: z
        .boolean()
        .optional()
        .describe("Return the full series objects instead of summaries (large payload)"),
    },
    READ,
    async ({ search, monitored, tvdb_id, detailed }) => {
      try {
        const data = (await client.get(
          `/api/v3/series${buildQS({ tvdbId: tvdb_id })}`,
        )) as SonarrSeries[];
        let rows = data;
        if (search) {
          const q = search.toLowerCase();
          rows = rows.filter((s) =>
            String(s.title ?? "")
              .toLowerCase()
              .includes(q),
          );
        }
        if (monitored !== undefined) rows = rows.filter((s) => s.monitored === monitored);
        return ok({ count: rows.length, series: detailed ? rows : rows.map(summarizeSeries) });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_series",
    "Get the full series object for one series, including seasons with their per-season statistics and monitored flags.",
    {
      id: z.number().int().positive().describe("Sonarr series id (not the TVDB id)"),
      include_season_images: z.boolean().optional().describe("Include per-season image URLs"),
    },
    READ,
    async ({ id, include_season_images }) => {
      try {
        return ok(
          await client.get(
            `/api/v3/series/${id}${buildQS({ includeSeasonImages: include_season_images })}`,
          ),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "lookup_series",
    "Search TVDB for series to add, by title or by an id term such as 'tvdb:121361' or 'imdb:tt0944947'. Returns candidates with tvdbId, title, year and overview — pass the tvdbId to add_series.",
    { term: z.string().describe("Search term, e.g. 'Breaking Bad' or 'tvdb:81189'") },
    READ,
    async ({ term }) => {
      try {
        const data = (await client.get(
          `/api/v3/series/lookup${buildQS({ term })}`,
        )) as SonarrSeries[];
        return ok({
          count: data.length,
          results: data.map((s) =>
            pruneUndefined({
              title: s.title,
              year: s.year,
              tvdbId: s.tvdbId,
              imdbId: s.imdbId,
              status: s.status,
              network: s.network,
              seriesType: s.seriesType,
              runtime: s.runtime,
              overview: s.overview,
              seasonCount: s.seasons?.length,
              alreadyAdded: s.id ? s.id : undefined,
            }),
          ),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "add_series",
    "Add a new series to the library by TVDB id. Resolves the series metadata via lookup, then posts it with the given root folder and quality profile. Use list_root_folders and list_quality_profiles first to get valid ids.",
    {
      tvdb_id: z.number().describe("TVDB id of the series, from lookup_series"),
      quality_profile_id: z.number().describe("Quality profile id, from list_quality_profiles"),
      root_folder_path: z.string().describe("Root folder path, from list_root_folders"),
      monitored: z.boolean().optional().describe("Monitor the series (default true)"),
      monitor: z
        .enum(monitorTypes)
        .optional()
        .describe("Which episodes to monitor when adding (default 'all')"),
      season_folder: z.boolean().optional().describe("Use season folders (default true)"),
      series_type: z.enum(seriesTypes).optional().describe("Series type (default 'standard')"),
      search_for_missing_episodes: z
        .boolean()
        .optional()
        .describe("Start a search for missing episodes right after adding (default false)"),
      search_for_cutoff_unmet_episodes: z
        .boolean()
        .optional()
        .describe("Start a search for cutoff unmet episodes right after adding"),
      tags: z.array(z.number()).optional().describe("Tag ids to apply, from list_tags"),
    },
    WRITE,
    async ({
      tvdb_id,
      quality_profile_id,
      root_folder_path,
      monitored,
      monitor,
      season_folder,
      series_type,
      search_for_missing_episodes,
      search_for_cutoff_unmet_episodes,
      tags,
    }) => {
      try {
        const found = (await client.get(
          `/api/v3/series/lookup${buildQS({ term: `tvdb:${tvdb_id}` })}`,
        )) as SonarrSeries[];
        const match = found.find((s) => s.tvdbId === tvdb_id) ?? found[0];
        if (!match) throw new Error(`No series found on TVDB for tvdbId ${tvdb_id}`);
        const body = {
          ...match,
          qualityProfileId: quality_profile_id,
          rootFolderPath: root_folder_path,
          monitored: monitored ?? true,
          seasonFolder: season_folder ?? true,
          ...(series_type ? { seriesType: series_type } : {}),
          ...(tags ? { tags } : {}),
          addOptions: {
            monitor: monitor ?? "all",
            searchForMissingEpisodes: search_for_missing_episodes ?? false,
            searchForCutoffUnmetEpisodes: search_for_cutoff_unmet_episodes ?? false,
          },
        };
        return ok(summarizeSeries((await client.post("/api/v3/series", body)) as SonarrSeries));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_series",
    "Update settings on an existing series. Fetches the current series, merges the given fields and puts it back — only the fields you pass are changed.",
    {
      id: z.number().int().positive().describe("Sonarr series id"),
      monitored: z.boolean().optional().describe("Monitor or unmonitor the series"),
      quality_profile_id: z.number().optional().describe("New quality profile id"),
      series_type: z.enum(seriesTypes).optional().describe("New series type"),
      season_folder: z.boolean().optional().describe("Use season folders"),
      monitor_new_items: z
        .enum(["all", "none"])
        .optional()
        .describe("Whether newly added seasons are monitored"),
      root_folder_path: z.string().optional().describe("New root folder path"),
      path: z.string().optional().describe("New series folder path"),
      tags: z.array(z.number()).optional().describe("Replace the tag ids on this series"),
      move_files: z
        .boolean()
        .optional()
        .describe("Move existing files when the path or root folder changes (default false)"),
    },
    UPDATE,
    async ({
      id,
      monitored,
      quality_profile_id,
      series_type,
      season_folder,
      monitor_new_items,
      root_folder_path,
      path,
      tags,
      move_files,
    }) => {
      try {
        const current = (await client.get(`/api/v3/series/${id}`)) as SonarrSeries;
        const body = {
          ...current,
          ...pruneUndefined({
            monitored,
            qualityProfileId: quality_profile_id,
            seriesType: series_type,
            seasonFolder: season_folder,
            monitorNewItems: monitor_new_items,
            rootFolderPath: root_folder_path,
            path,
            tags,
          }),
        };
        const res = await client.put(
          `/api/v3/series/${id}${buildQS({ moveFiles: move_files })}`,
          body,
        );
        return ok(summarizeSeries(res as SonarrSeries));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_series",
    "Remove a series from the library. Optionally delete its files from disk and add an import list exclusion so lists do not re-add it.",
    {
      id: z.number().int().positive().describe("Sonarr series id"),
      delete_files: z
        .boolean()
        .optional()
        .describe("Also delete the series folder and files from disk (default false)"),
      add_import_list_exclusion: z
        .boolean()
        .optional()
        .describe("Add an import list exclusion for this series (default false)"),
    },
    DELETE,
    async ({ id, delete_files, add_import_list_exclusion }) => {
      try {
        return ok(
          await client.delete(
            `/api/v3/series/${id}${buildQS({
              deleteFiles: delete_files,
              addImportListExclusion: add_import_list_exclusion,
            })}`,
          ),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "edit_series_bulk",
    "Apply the same change to many series at once (the series editor): monitoring, quality profile, series type, season folders, root folder or tags.",
    {
      series_ids: z.array(z.number()).describe("Sonarr series ids to edit"),
      monitored: z.boolean().optional().describe("Monitor or unmonitor all of them"),
      quality_profile_id: z.number().optional().describe("Quality profile id to set"),
      series_type: z.enum(seriesTypes).optional().describe("Series type to set"),
      season_folder: z.boolean().optional().describe("Use season folders"),
      monitor_new_items: z.enum(["all", "none"]).optional().describe("Monitoring for new seasons"),
      root_folder_path: z.string().optional().describe("Move all of them to this root folder"),
      tags: z.array(z.number()).optional().describe("Tag ids to add, remove or replace"),
      apply_tags: z
        .enum(["add", "remove", "replace"])
        .optional()
        .describe("How to apply 'tags' (default 'add')"),
      move_files: z
        .boolean()
        .optional()
        .describe("Move files when changing the root folder (default false)"),
    },
    UPDATE,
    async ({
      series_ids,
      monitored,
      quality_profile_id,
      series_type,
      season_folder,
      monitor_new_items,
      root_folder_path,
      tags,
      apply_tags,
      move_files,
    }) => {
      try {
        const body = pruneUndefined({
          seriesIds: series_ids,
          monitored,
          qualityProfileId: quality_profile_id,
          seriesType: series_type,
          seasonFolder: season_folder,
          monitorNewItems: monitor_new_items,
          rootFolderPath: root_folder_path,
          tags,
          applyTags: tags ? (apply_tags ?? "add") : undefined,
          moveFiles: move_files,
        });
        const res = (await client.put("/api/v3/series/editor", body)) as SonarrSeries[];
        return ok({ count: res.length, series: res.map(summarizeSeries) });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_series_bulk",
    "Remove many series from the library at once, optionally deleting their files and adding import list exclusions.",
    {
      series_ids: z.array(z.number()).describe("Sonarr series ids to delete"),
      delete_files: z.boolean().optional().describe("Also delete files from disk (default false)"),
      add_import_list_exclusion: z
        .boolean()
        .optional()
        .describe("Add import list exclusions (default false)"),
    },
    DELETE,
    async ({ series_ids, delete_files, add_import_list_exclusion }) => {
      try {
        return ok(
          await client.delete("/api/v3/series/editor", {
            seriesIds: series_ids,
            deleteFiles: delete_files ?? false,
            addImportListExclusion: add_import_list_exclusion ?? false,
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_series_folder",
    "Get the folder path Sonarr would use for a series, given the current naming configuration.",
    { id: z.number().int().positive().describe("Sonarr series id") },
    READ,
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/series/${id}/folder`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "set_season_monitored",
    "Monitor or unmonitor whole seasons of a series. Pass season numbers (0 is specials); omit them to apply to every season.",
    {
      series_id: z.number().int().positive().describe("Sonarr series id"),
      monitored: z.boolean().describe("true to monitor, false to unmonitor"),
      season_numbers: z
        .array(z.number())
        .optional()
        .describe("Season numbers to change; all seasons when omitted"),
    },
    UPDATE,
    async ({ series_id, monitored, season_numbers }) => {
      try {
        const current = (await client.get(`/api/v3/series/${series_id}`)) as SonarrSeries;
        const seasons = (current.seasons ?? []).map((s) =>
          season_numbers === undefined || season_numbers.includes(s.seasonNumber)
            ? { ...s, monitored }
            : s,
        );
        const res = (await client.put(`/api/v3/series/${series_id}`, {
          ...current,
          seasons,
        })) as SonarrSeries;
        return ok({
          id: res.id,
          title: res.title,
          seasons: (res.seasons ?? []).map((s) => ({
            seasonNumber: s.seasonNumber,
            monitored: s.monitored,
          })),
        });
      } catch (e) {
        return err(e);
      }
    },
  );
}
