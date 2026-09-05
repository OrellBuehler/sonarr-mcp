import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

interface ProviderKind {
  path: string;
  singular: string;
  plural: string;
  label: string;
  extra: string;
}

const kinds: ProviderKind[] = [
  {
    path: "indexer",
    singular: "indexer",
    plural: "indexers",
    label: "indexer",
    extra: "enableRss, enableAutomaticSearch, enableInteractiveSearch, priority, protocol",
  },
  {
    path: "downloadclient",
    singular: "download_client",
    plural: "download_clients",
    label: "download client",
    extra: "enable, protocol, priority, removeCompletedDownloads, removeFailedDownloads",
  },
  {
    path: "importlist",
    singular: "import_list",
    plural: "import_lists",
    label: "import list",
    extra: "enableAutomaticAdd, shouldMonitor, rootFolderPath, qualityProfileId, seriesType",
  },
  {
    path: "notification",
    singular: "notification",
    plural: "notifications",
    label: "notification connection",
    extra: "onGrab, onDownload, onUpgrade, onHealthIssue and the other event toggles",
  },
];

function summarizeProvider(p: Record<string, unknown>): Record<string, unknown> {
  const { fields: _fields, presets: _presets, ...rest } = p;
  return rest;
}

export function registerProviderTools(server: McpServer, client: SonarrClient) {
  for (const kind of kinds) {
    server.tool(
      `list_${kind.plural}`,
      `List the configured ${kind.label}s. Secret field values are masked by Sonarr; the 'fields' array is omitted here — use get_${kind.singular} for it.`,
      {},
      async () => {
        try {
          const data = (await client.get(`/api/v3/${kind.path}`)) as Record<string, unknown>[];
          return ok({ count: data.length, [kind.plural]: data.map(summarizeProvider) });
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `get_${kind.singular}`,
      `Get one ${kind.label} including its full 'fields' array (the implementation-specific settings).`,
      { id: z.number().describe(`${kind.label} id`) },
      async ({ id }) => {
        try {
          return ok(await client.get(`/api/v3/${kind.path}/${id}`));
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `get_${kind.singular}_schema`,
      `List every ${kind.label} implementation Sonarr supports, with the fields each one takes. Use this as the template for create_${kind.singular}.`,
      {
        implementation: z
          .string()
          .optional()
          .describe("Only the schema for this implementation, e.g. 'Newznab' or 'QBittorrent'"),
      },
      async ({ implementation }) => {
        try {
          const data = (await client.get(`/api/v3/${kind.path}/schema`)) as Record<
            string,
            unknown
          >[];
          if (implementation) {
            const q = implementation.toLowerCase();
            const match = data.filter(
              (s) =>
                String(s.implementation ?? "").toLowerCase() === q ||
                String(s.implementationName ?? "").toLowerCase() === q,
            );
            return ok({ count: match.length, schemas: match });
          }
          return ok({
            count: data.length,
            implementations: data.map((s) => ({
              implementation: s.implementation,
              implementationName: s.implementationName,
              configContract: s.configContract,
              infoLink: s.infoLink,
            })),
          });
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `create_${kind.singular}`,
      `Add a new ${kind.label}. Build the body from get_${kind.singular}_schema: it needs name, implementation, configContract and the fields array, plus ${kind.extra}.`,
      {
        config: z
          .record(z.unknown())
          .describe(`Full ${kind.label} resource object, based on the schema`),
      },
      async ({ config }) => {
        try {
          return ok(await client.post(`/api/v3/${kind.path}`, config));
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `update_${kind.singular}`,
      `Update an existing ${kind.label}. Fetch it with get_${kind.singular} first, change what you need and send the whole object back.`,
      {
        id: z.number().describe(`${kind.label} id`),
        config: z.record(z.unknown()).describe(`Full ${kind.label} resource object including id`),
      },
      async ({ id, config }) => {
        try {
          return ok(await client.put(`/api/v3/${kind.path}/${id}`, { ...config, id }));
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `delete_${kind.singular}`,
      `Delete a ${kind.label}.`,
      { id: z.number().describe(`${kind.label} id`) },
      async ({ id }) => {
        try {
          return ok(await client.delete(`/api/v3/${kind.path}/${id}`));
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `test_${kind.singular}`,
      `Test a ${kind.label} configuration without saving it. Pass a config object to test a draft, or an id to test an existing one.`,
      {
        id: z.number().optional().describe(`Existing ${kind.label} id to test`),
        config: z.record(z.unknown()).optional().describe("Draft resource object to test instead"),
      },
      async ({ id, config }) => {
        try {
          if (!config && id === undefined) throw new Error("Pass either id or config");
          const body = config ?? (await client.get(`/api/v3/${kind.path}/${id}`));
          return ok(await client.post(`/api/v3/${kind.path}/test`, body));
        } catch (e) {
          return err(e);
        }
      },
    );
  }
}
