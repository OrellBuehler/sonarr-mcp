import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildQS, ok, err, DESTRUCTIVE, READ } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

export function registerSystemTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "get_system_status",
    "Get version, branch, runtime, install source, OS and the paths Sonarr is using. Start here when diagnosing anything.",
    {},
    READ,
    async () => {
      try {
        return ok(await client.get("/api/v3/system/status"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_health",
    "Get the active health check warnings and errors, with the wiki link explaining each one.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/health")) as unknown[];
        return ok({ count: data.length, issues: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_disk_space",
    "Get free and total space for every drive and root folder Sonarr can see.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/diskspace")) as unknown[];
        return ok({ count: data.length, disks: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_updates",
    "List available Sonarr updates for the current branch, with changelogs and whether each is installed or installable.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/update")) as unknown[];
        return ok({ count: data.length, updates: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_logs",
    "Page through Sonarr's log entries, newest first by default. Filter by level to find errors quickly.",
    {
      page: z.number().optional().describe("Page number (default 1)"),
      page_size: z.number().optional().describe("Entries per page (default 10 on the Sonarr side)"),
      sort_key: z.string().optional().describe("Field to sort by, e.g. 'time'"),
      sort_direction: z
        .enum(["default", "ascending", "descending"])
        .optional()
        .describe("Sort direction"),
      level: z
        .enum(["trace", "debug", "info", "warn", "error", "fatal"])
        .optional()
        .describe("Only entries at this level"),
    },
    READ,
    async ({ page, page_size, sort_key, sort_direction, level }) => {
      try {
        const qs = buildQS({
          page,
          pageSize: page_size,
          sortKey: sort_key ?? "time",
          sortDirection: sort_direction ?? "descending",
          level,
        });
        return ok(await client.get(`/api/v3/log${qs}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_log_files",
    "List the log files on disk with their names, sizes and download paths.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/log/file")) as unknown[];
        return ok({ count: data.length, files: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_log_file",
    "Download the contents of one log file as text.",
    {
      filename: z
        .string()
        .regex(/^(?!\.+$)[\w.-]+$/, "Must be a plain file name")
        .describe("Log file name from list_log_files, e.g. 'sonarr.txt'"),
    },
    READ,
    async ({ filename }) => {
      try {
        return ok(await client.fetchText(`/api/v3/log/file/${encodeURIComponent(filename)}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_backups",
    "List the database backups Sonarr has taken, with their type, size and date. Run the Backup command to create a new one.",
    {},
    READ,
    async () => {
      try {
        const data = (await client.get("/api/v3/system/backup")) as unknown[];
        return ok({ count: data.length, backups: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "restart_sonarr",
    "Restart the Sonarr application. It is unreachable for a few seconds afterwards.",
    {},
    DESTRUCTIVE,
    async () => {
      try {
        return ok(await client.post("/api/v3/system/restart"));
      } catch (e) {
        return err(e);
      }
    },
  );
}
