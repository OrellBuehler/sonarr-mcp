import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, DELETE, READ, UPDATE, WRITE } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

export function registerOrganizationTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "list_root_folders",
    "List root folders with their free space and any unmapped folders sitting in them. add_series needs one of these paths.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/rootfolder")) as Record<string, unknown>[];
        return ok({
          count: data.length,
          rootFolders: data.map((f) => ({
            id: f.id,
            path: f.path,
            accessible: f.accessible,
            freeSpace: f.freeSpace,
            unmappedFolderCount: ((f.unmappedFolders ?? []) as unknown[]).length,
          })),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_root_folder",
    "Get one root folder including the full list of unmapped folders — series folders on disk that are not in the library.",
    { id: z.number().int().positive().describe("Root folder id") },
    READ,
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/rootfolder/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "add_root_folder",
    "Add a root folder. The path must exist and be writable by Sonarr.",
    { path: z.string().describe("Absolute path as Sonarr sees it, e.g. '/tv'") },
    WRITE,
    async ({ path }) => {
      try {
        return ok(await client.post("/api/v3/rootfolder", { path }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_root_folder",
    "Remove a root folder from Sonarr. Files on disk are not touched.",
    { id: z.number().int().positive().describe("Root folder id") },
    DELETE,
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/rootfolder/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_tags",
    "List tags with their ids and labels. Tags link series to delay profiles, release profiles, indexers and notifications.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/tag")) as unknown[];
        return ok({ count: data.length, tags: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_tag_details",
    "List tags together with everything using them — series ids, indexer ids, notification ids and profile ids.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/tag/detail")) as unknown[];
        return ok({ count: data.length, tags: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_tag",
    "Create a tag.",
    { label: z.string().describe("Tag label, e.g. 'anime'") },
    WRITE,
    async ({ label }) => {
      try {
        return ok(await client.post("/api/v3/tag", { label }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_tag",
    "Rename a tag.",
    {
      id: z.number().int().positive().describe("Tag id"),
      label: z.string().describe("New tag label"),
    },
    UPDATE,
    async ({ id, label }) => {
      try {
        return ok(await client.put(`/api/v3/tag/${id}`, { id, label }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_tag",
    "Delete a tag. It is removed from every series and provider using it.",
    { id: z.number().int().positive().describe("Tag id") },
    DELETE,
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/tag/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_import_list_exclusions",
    "List series excluded from import lists — series that lists will never re-add.",
    {
      page: z.number().optional().describe("Page number; unpaged when omitted"),
      page_size: z.number().optional().describe("Items per page"),
    },
    READ,
    async ({ page, page_size }) => {
      try {
        if (page !== undefined || page_size !== undefined) {
          return ok(
            await client.get(
              `/api/v3/importlistexclusion/paged${buildQS({ page, pageSize: page_size })}`,
            ),
          );
        }
        const data = (await client.get("/api/v3/importlistexclusion")) as unknown[];
        return ok({ count: data.length, exclusions: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "add_import_list_exclusion",
    "Exclude a series from import lists by TVDB id, so lists stop re-adding it.",
    {
      tvdb_id: z.number().describe("TVDB id of the series to exclude"),
      title: z.string().describe("Series title, for display in the Sonarr UI"),
    },
    WRITE,
    async ({ tvdb_id, title }) => {
      try {
        return ok(await client.post("/api/v3/importlistexclusion", { tvdbId: tvdb_id, title }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_import_list_exclusion",
    "Remove an import list exclusion so lists may add the series again.",
    { id: z.number().int().positive().describe("Import list exclusion id") },
    DELETE,
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/importlistexclusion/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_remote_path_mappings",
    "List remote path mappings — how paths reported by a download client on another host translate to paths Sonarr can read.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/remotepathmapping")) as unknown[];
        return ok({ count: data.length, mappings: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "add_remote_path_mapping",
    "Add a remote path mapping for a download client host.",
    {
      host: z.string().describe("Download client host as configured in Sonarr"),
      remote_path: z.string().describe("Path as the download client reports it"),
      local_path: z.string().describe("Matching path as Sonarr sees it"),
    },
    WRITE,
    async ({ host, remote_path, local_path }) => {
      try {
        return ok(
          await client.post("/api/v3/remotepathmapping", {
            host,
            remotePath: remote_path,
            localPath: local_path,
          }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_remote_path_mapping",
    "Delete a remote path mapping.",
    { id: z.number().int().positive().describe("Remote path mapping id") },
    DELETE,
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/remotepathmapping/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );
}
