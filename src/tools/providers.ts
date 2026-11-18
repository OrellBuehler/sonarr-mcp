import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ok,
  err,
  redactProvider,
  hasRedacted,
  restoreRedacted,
  READ,
  WRITE,
  UPDATE,
  DELETE,
  REDACTED,
} from "../sonarr/format.js";
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
  return redactProvider(rest);
}

const providerId = z.number().int().positive();

async function withStoredSecrets(
  client: SonarrClient,
  path: string,
  config: Record<string, unknown>,
  id: unknown,
): Promise<Record<string, unknown>> {
  if (!hasRedacted(config)) return config;
  if (!providerId.safeParse(id).success) {
    throw new Error(
      `The config contains ${REDACTED} placeholders and there is no saved provider to take the values from. Replace them with the real values.`,
    );
  }
  const stored = (await client.get(`/api/v3/${path}/${id}`)) as Record<string, unknown>;
  return restoreRedacted(config, stored);
}

export function registerProviderTools(server: McpServer, client: SonarrClient) {
  for (const kind of kinds) {
    server.tool(
      `list_${kind.plural}`,
      `List the configured ${kind.label}s. The 'fields' array is omitted here — use get_${kind.singular} for it.`,
      {},
      READ,
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
      `Get one ${kind.label} including its full 'fields' array (the implementation-specific settings). Secret values (API keys, passwords, tokens, credentials inside URLs) are returned as '${REDACTED}'.`,
      { id: providerId.describe(`${kind.label} id`) },
      READ,
      async ({ id }) => {
        try {
          return ok(redactProvider(await client.get(`/api/v3/${kind.path}/${id}`)));
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
      READ,
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
            return ok({ count: match.length, schemas: redactProvider(match) });
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
      `Add a new ${kind.label}. Build the body from get_${kind.singular}_schema: it needs name, implementation, configContract and the fields array, plus ${kind.extra}. Secrets must be real values — '${REDACTED}' placeholders are rejected.`,
      {
        config: z
          .record(z.string(), z.unknown())
          .describe(`Full ${kind.label} resource object, based on the schema`),
      },
      WRITE,
      async ({ config }) => {
        try {
          if (hasRedacted(config)) {
            throw new Error(
              `The config contains ${REDACTED} placeholders. Replace them with the real values.`,
            );
          }
          return ok(redactProvider(await client.post(`/api/v3/${kind.path}`, config)));
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `update_${kind.singular}`,
      `Update an existing ${kind.label}. Fetch it with get_${kind.singular} first, change what you need and send the whole object back. Leave '${REDACTED}' values untouched to keep the stored secret; they are replaced with the stored value before saving.`,
      {
        id: providerId.describe(`${kind.label} id`),
        config: z
          .record(z.string(), z.unknown())
          .describe(`Full ${kind.label} resource object including id`),
      },
      UPDATE,
      async ({ id, config }) => {
        try {
          const body = await withStoredSecrets(client, kind.path, config, id);
          return ok(
            redactProvider(await client.put(`/api/v3/${kind.path}/${id}`, { ...body, id })),
          );
        } catch (e) {
          return err(e);
        }
      },
    );

    server.tool(
      `delete_${kind.singular}`,
      `Delete a ${kind.label}.`,
      { id: providerId.describe(`${kind.label} id`) },
      DELETE,
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
      `Test a ${kind.label} configuration without saving it. Pass a config object to test a draft, or an id to test an existing one. A draft may keep '${REDACTED}' values only when it carries the id of a saved ${kind.label}.`,
      {
        id: providerId.optional().describe(`Existing ${kind.label} id to test`),
        config: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Draft resource object to test instead"),
      },
      WRITE,
      async ({ id, config }) => {
        try {
          if (!config && id === undefined) throw new Error("Pass either id or config");
          const body = config
            ? await withStoredSecrets(client, kind.path, config, config.id ?? id)
            : await client.get(`/api/v3/${kind.path}/${id}`);
          return ok(redactProvider(await client.post(`/api/v3/${kind.path}/test`, body)));
        } catch (e) {
          return err(e);
        }
      },
    );
  }
}
