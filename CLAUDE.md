# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A STDIO MCP server that exposes the Sonarr v3 REST API as tools for AI agents: series and episode
management, the download queue, interactive release search, quality profiles, provider configuration
and system diagnostics. Published to npm as `@orellbuehler/sonarr-mcp` and run via `npx`; the compiled
`dist/index.js` is the `bin` entry. See `README.md` for the tool catalog and env-var reference.

## Commands

```bash
npm run build         # tsc -> dist/
npm test              # vitest run (all tests)
npm run test:watch    # vitest watch
npm run lint          # eslint src
npm run typecheck     # tsc --noEmit
npm run format        # prettier --write .
npm run format:check  # prettier --check . (what CI runs)
npm run spec:update   # refresh sonarr-openapi.json from the Sonarr repo
```

Run a single test file or pattern:

```bash
npx vitest run src/__tests__/series.test.ts
npx vitest run -t "set_season_monitored"
```

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `typecheck`, and `test` in that order —
all must pass. Run them locally before committing.

## Architecture

Request flow: `index.ts` reads config, builds the server via `server.ts:createServer(client)`, and
connects it over stdio. Every tool goes through the one REST `client`.

- **`src/index.ts`** — entry point. Stdio transport only (single-user).
- **`src/config.ts`** — reads env at import time and **exits the process** if `SONARR_URL`/
  `SONARR_SERVER` or `SONARR_API_KEY` is missing. Normalizes the base URL (adds `http://`, strips
  trailing slashes) and exports `client`.
- **`src/sonarr/client.ts`** — `SonarrClient`, a thin `fetch` wrapper. Auth is the `X-Api-Key`
  header. `get`/`post`/`put`/`delete` are thin wrappers over `fetch()`, which returns parsed JSON
  (or text for non-JSON responses) and `{ success: true }` for 204 and empty bodies. `fetchText()`
  is used for log files. Throws on non-2xx with the response body in the message.
- **`src/sonarr/format.ts`** — shared helpers: `buildQS` (arrays are **repeated** as separate query
  params, which is what ASP.NET model binding expects), `ok`/`err` (MCP content envelopes; `ok`
  passes strings through unquoted), `pruneUndefined`, `summarizeSeries`/`summarizeEpisode`/
  `summarizeRelease`, and `summarizeList` (maps a bare array or a paged `{ records }` envelope).
- **`src/tools/*.ts`** — each exports a `register*Tools(server, client)` function that `server.ts`
  calls: `series`, `episodes`, `calendar`, `queue`, `history`, `wanted`, `blocklist`, `commands`,
  `releases`, `profiles`, `providers`, `organization`, `settings`, `system`.
- **`sonarr-openapi.json`** — vendored copy of the Sonarr v3 OpenAPI spec, the reference for paths,
  query params and body schemas. Not used at runtime. Refresh with `npm run spec:update`.

`providers.ts` and `settings.ts` generate their tools from a table (`kinds`) rather than repeating
near-identical handlers: providers get the same 7 tools each (list/get/schema/create/update/delete/
test), config sections get `get_*` plus `update_*` when writable.

## Conventions

- **ESM with Node16 module resolution: all relative imports must end in `.js`** (e.g.
  `import { ok } from "../sonarr/format.js"`), even though the source is `.ts`.
- **Tool handler shape:** `server.tool(name, description, zodShape, async (args) => { try { return
ok(await client.get(...)); } catch (e) { return err(e); } })`. The third argument is a raw Zod shape
  object (`{}` when there are no params). Match this try/catch-`ok`/`err` style exactly.
- **Tool params are `snake_case`; Sonarr's JSON is `camelCase`.** Handlers translate at the boundary.
- **List tools summarize by default.** Sonarr resources are very large (images, overviews, alternate
  titles, per-season statistics). Any tool that can return many objects must summarize and offer
  `detailed: true` for the raw payload.
- **Partial updates are read-modify-write.** Sonarr's PUT endpoints replace the whole resource, so
  `update_series` and `set_season_monitored` GET the current object, merge the given fields with
  `pruneUndefined`, and PUT it back. Do the same for any new update tool.
- **Complex provider bodies are passthrough.** Indexers, download clients, import lists,
  notifications, quality profiles, custom formats and config sections take a `z.record(z.unknown())`
  object rather than an enumerated schema — their shape is implementation-specific and comes from the
  matching `/schema` endpoint.
- **Don't add comments, docstrings, or type annotations** unless they already exist in the file
  you're editing (per global preference).
- **Destructive defaults are safe.** File deletion and download-client removal must be opt-in
  parameters that default to the non-destructive choice, and the tool description must say so. Do not
  add tools for shutdown, backup restore or update installation.
- **Secrets:** the repo is public. Never log the API key; only read it from env. Tests use fake
  credentials.

## Tests

Tests live in `src/__tests__/*.test.ts`, with shared fixtures in `src/__tests__/helpers.ts` (not a
test file itself, so vitest's `src/**/*.test.ts` glob skips it). `collectTools(...registrars)` passes
a fake `{ tool: (name, desc, schema, handler) => ... }` server to the `register*Tools` functions to
capture handlers, then `stubFetch()` stubs global `fetch` and `callAt(mockFetch, i)` asserts the exact
URL, method and parsed body of each request. Assert both the outgoing request and the output shaping.
`config.ts` reads env at import time and exits if it's missing, so `config.test.ts` `vi.stubEnv(...)`
then dynamically `import()`s it. `server.test.ts` guards against duplicate tool names across groups.
