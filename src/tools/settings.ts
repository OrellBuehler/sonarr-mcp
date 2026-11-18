import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err, redactSecrets, hasRedacted, READ, UPDATE, REDACTED } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

interface ConfigKind {
  path: string;
  name: string;
  label: string;
  writable: boolean;
}

const kinds: ConfigKind[] = [
  { path: "naming", name: "naming_config", label: "file and folder naming", writable: true },
  {
    path: "mediamanagement",
    name: "media_management_config",
    label: "media management (import, file handling, permissions)",
    writable: true,
  },
  {
    path: "indexer",
    name: "indexer_config",
    label: "indexer (RSS interval, retention, availability delay)",
    writable: true,
  },
  {
    path: "downloadclient",
    name: "download_client_config",
    label: "download client (completed and failed download handling)",
    writable: true,
  },
  { path: "importlist", name: "import_list_config", label: "import list", writable: true },
  {
    path: "host",
    name: "host_config",
    label: "host (port, URL base, proxy, logging)",
    writable: false,
  },
  { path: "ui", name: "ui_config", label: "UI (date format, first day of week)", writable: false },
];

const configId = z.number().int().positive();

export function registerSettingsTools(server: McpServer, client: SonarrClient) {
  for (const kind of kinds) {
    server.tool(
      `get_${kind.name}`,
      `Get the ${kind.label} configuration. Secret values (API key, passwords) are returned as '${REDACTED}'.`,
      {},
      READ,
      async () => {
        try {
          return ok(redactSecrets(await client.get(`/api/v3/config/${kind.path}`)));
        } catch (e) {
          return err(e);
        }
      },
    );

    if (!kind.writable) continue;

    server.tool(
      `update_${kind.name}`,
      `Update the ${kind.label} configuration. Fetch it with get_${kind.name} first, change what you need and send the whole object back.`,
      {
        config: z
          .record(z.string(), z.unknown())
          .describe("Full configuration object including id"),
      },
      UPDATE,
      async ({ config }) => {
        try {
          const id = config.id ?? 1;
          if (!configId.safeParse(id).success) {
            throw new Error("config.id must be a positive integer");
          }
          if (hasRedacted(config)) {
            throw new Error(`The config contains ${REDACTED} placeholders; refusing to save them.`);
          }
          return ok(
            redactSecrets(await client.put(`/api/v3/config/${kind.path}/${id}`, { ...config, id })),
          );
        } catch (e) {
          return err(e);
        }
      },
    );
  }

  server.tool(
    "get_naming_examples",
    "Preview the filenames a naming format would produce, without saving it. Pass a naming config object to try a draft format.",
    {
      config: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Draft naming config; the saved one is used when omitted"),
    },
    READ,
    async ({ config }) => {
      try {
        const body = config ?? ((await client.get("/api/v3/config/naming")) as object);
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
          if (v === undefined || v === null) continue;
          qs.set(k, String(v));
        }
        return ok(await client.get(`/api/v3/config/naming/examples?${qs.toString()}`));
      } catch (e) {
        return err(e);
      }
    },
  );
}
