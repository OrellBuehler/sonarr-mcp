import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ok, err } from "../sonarr/format.js";
import type { SonarrClient } from "../sonarr/client.js";

export function registerProfileTools(server: McpServer, client: SonarrClient) {
  server.tool(
    "list_quality_profiles",
    "List quality profiles with their id, name, cutoff and the qualities each one allows. Series are assigned a profile by id.",
    {
      detailed: z
        .boolean()
        .optional()
        .describe("Include the full items and formatItems arrays (large payload)"),
    },
    async ({ detailed }) => {
      try {
        const data = (await client.get("/api/v3/qualityprofile")) as Record<string, unknown>[];
        if (detailed) return ok({ count: data.length, profiles: data });
        return ok({
          count: data.length,
          profiles: data.map((p) => ({
            id: p.id,
            name: p.name,
            upgradeAllowed: p.upgradeAllowed,
            cutoff: p.cutoff,
            minFormatScore: p.minFormatScore,
            cutoffFormatScore: p.cutoffFormatScore,
            allowedQualities: ((p.items ?? []) as Record<string, unknown>[])
              .filter((i) => i.allowed)
              .map(
                (i) =>
                  (i.name as string) ?? (i.quality as { name?: string } | undefined)?.name ?? "",
              ),
          })),
        });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_quality_profile",
    "Get one quality profile in full, including every quality item and custom format score.",
    { id: z.number().describe("Quality profile id") },
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/qualityprofile/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_quality_profile_schema",
    "Get a blank quality profile with every quality Sonarr knows about — the template for create_quality_profile.",
    {},
    async () => {
      try {
        return ok(await client.get("/api/v3/qualityprofile/schema"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_quality_profile",
    "Create a quality profile. Start from get_quality_profile_schema, set name, cutoff and which items are allowed.",
    { profile: z.record(z.unknown()).describe("Full quality profile object") },
    async ({ profile }) => {
      try {
        return ok(await client.post("/api/v3/qualityprofile", profile));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_quality_profile",
    "Update a quality profile. Fetch it with get_quality_profile, change what you need and send the whole object back.",
    {
      id: z.number().describe("Quality profile id"),
      profile: z.record(z.unknown()).describe("Full quality profile object including id"),
    },
    async ({ id, profile }) => {
      try {
        return ok(await client.put(`/api/v3/qualityprofile/${id}`, { ...profile, id }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_quality_profile",
    "Delete a quality profile. It must not be in use by any series.",
    { id: z.number().describe("Quality profile id") },
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/qualityprofile/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_quality_definitions",
    "List quality definitions — the size limits (min, max, preferred MB per minute) Sonarr applies to each quality.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/qualitydefinition")) as unknown[];
        return ok({ count: data.length, definitions: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_quality_definitions",
    "Update the size limits of one or more quality definitions. Send the full definition objects from list_quality_definitions with minSize, maxSize or preferredSize changed.",
    {
      definitions: z
        .array(z.record(z.unknown()))
        .describe("Full quality definition objects including id"),
    },
    async ({ definitions }) => {
      try {
        return ok(await client.put("/api/v3/qualitydefinition/update", definitions));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_custom_formats",
    "List custom formats with their specifications. Custom format scores in a quality profile decide which releases are preferred.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/customformat")) as unknown[];
        return ok({ count: data.length, customFormats: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_custom_format",
    "Get one custom format with its full specification list.",
    { id: z.number().describe("Custom format id") },
    async ({ id }) => {
      try {
        return ok(await client.get(`/api/v3/customformat/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "get_custom_format_schema",
    "List the specification types a custom format can use (release title regex, size, language, quality modifier, ...) with their fields.",
    {},
    async () => {
      try {
        return ok(await client.get("/api/v3/customformat/schema"));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_custom_format",
    "Create a custom format. Build the specifications from get_custom_format_schema.",
    { custom_format: z.record(z.unknown()).describe("Full custom format object") },
    async ({ custom_format }) => {
      try {
        return ok(await client.post("/api/v3/customformat", custom_format));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_custom_format",
    "Update a custom format. Fetch it first and send the whole object back.",
    {
      id: z.number().describe("Custom format id"),
      custom_format: z.record(z.unknown()).describe("Full custom format object including id"),
    },
    async ({ id, custom_format }) => {
      try {
        return ok(await client.put(`/api/v3/customformat/${id}`, { ...custom_format, id }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_custom_format",
    "Delete a custom format.",
    { id: z.number().describe("Custom format id") },
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/customformat/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_release_profiles",
    "List release profiles — the required, ignored and preferred term rules applied to release titles.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/releaseprofile")) as unknown[];
        return ok({ count: data.length, releaseProfiles: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "create_release_profile",
    "Create a release profile, e.g. { name, enabled: true, required: [], ignored: ['x265'], indexerId: 0, tags: [] }.",
    { release_profile: z.record(z.unknown()).describe("Full release profile object") },
    async ({ release_profile }) => {
      try {
        return ok(await client.post("/api/v3/releaseprofile", release_profile));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "update_release_profile",
    "Update a release profile. Fetch it from list_release_profiles and send the whole object back.",
    {
      id: z.number().describe("Release profile id"),
      release_profile: z.record(z.unknown()).describe("Full release profile object including id"),
    },
    async ({ id, release_profile }) => {
      try {
        return ok(await client.put(`/api/v3/releaseprofile/${id}`, { ...release_profile, id }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "delete_release_profile",
    "Delete a release profile.",
    { id: z.number().describe("Release profile id") },
    async ({ id }) => {
      try {
        return ok(await client.delete(`/api/v3/releaseprofile/${id}`));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_delay_profiles",
    "List delay profiles — how long Sonarr waits for a better release before grabbing, per protocol and tag.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/delayprofile")) as unknown[];
        return ok({ count: data.length, delayProfiles: data });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.tool(
    "list_languages",
    "List the languages Sonarr knows, with the ids used in language profiles and episode file edits.",
    {},
    async () => {
      try {
        const data = (await client.get("/api/v3/language")) as unknown[];
        return ok({ count: data.length, languages: data });
      } catch (e) {
        return err(e);
      }
    },
  );
}
