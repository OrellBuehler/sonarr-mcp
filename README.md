# sonarr-mcp

[![npm version](https://img.shields.io/npm/v/@orellbuehler/sonarr-mcp)](https://www.npmjs.com/package/@orellbuehler/sonarr-mcp)
[![CI](https://github.com/OrellBuehler/sonarr-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/OrellBuehler/sonarr-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@orellbuehler/sonarr-mcp)](LICENSE)
[![node](https://img.shields.io/node/v/@orellbuehler/sonarr-mcp)](package.json)

Connect AI agents to [Sonarr](https://sonarr.tv/). This [Model Context Protocol](https://modelcontextprotocol.io/) server exposes the Sonarr v3 API as 136 tools, so assistants like Claude can manage your TV library — add series, chase missing episodes, unstick the download queue, tune quality profiles, and diagnose health issues.

Works with any MCP client: Claude Code, Claude Desktop, or your own agent.

## Highlights

- **Library management** — search TVDB, add and remove series, edit them one at a time or in bulk, and monitor or unmonitor whole seasons
- **Episodes and files** — list episodes, find what is missing, delete or re-tag episode files, preview renames
- **Downloads** — inspect the queue, remove or blocklist stuck grabs, force imports, and diagnose files needing manual interaction
- **Interactive search** — query indexers live, see why releases were rejected, and grab the one you want by hand
- **Quality tuning** — quality profiles and definitions, custom formats, release and delay profiles
- **Configuration** — indexers, download clients, import lists, notifications, root folders, tags, naming, and media management
- **Diagnostics** — system status, health checks, disk space, scheduled tasks, command history, and log files
- **Compact by default** — list tools return summaries instead of Sonarr's very large objects, with `detailed: true` when you need everything

Things you can ask once it's connected:

> "What's airing this week, and is anything already missing?"
>
> "Add Severance, 1080p profile, into /tv and search for the whole thing"
>
> "The queue is stuck — what's wrong and can you fix it?"
>
> "Find me a release for the season finale that isn't x265"
>
> "Which of my series are still below their quality cutoff?"

## Quick start

The package is published as [`@orellbuehler/sonarr-mcp`](https://www.npmjs.com/package/@orellbuehler/sonarr-mcp) and runs directly with `npx` — no clone or build needed.

1. Get your API key from Sonarr: **Settings > General > Security > API Key**
2. Register the server with your MCP client. With Claude Code:

```bash
claude mcp add sonarr \
  --env SONARR_URL=http://your-sonarr-host:8989 \
  --env SONARR_API_KEY=your-api-key \
  -- npx -y @orellbuehler/sonarr-mcp
```

Or as JSON config (Claude Desktop and most other MCP clients use the same shape):

```json
{
  "mcpServers": {
    "sonarr": {
      "command": "npx",
      "args": ["-y", "@orellbuehler/sonarr-mcp"],
      "env": {
        "SONARR_URL": "http://your-sonarr-host:8989",
        "SONARR_API_KEY": "your-api-key"
      }
    }
  }
}
```

3. Restart your MCP client. The tools are available immediately.

If Sonarr runs behind a reverse proxy with a URL base, include it in `SONARR_URL` (e.g. `https://media.example.com/sonarr`).

## Environment variables

| Variable         | Required | Description                                                                                                    |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `SONARR_URL`     | yes      | Base URL of your Sonarr instance, e.g. `http://192.168.1.10:8989`. `http://` is assumed if no scheme is given. |
| `SONARR_SERVER`  | –        | Accepted as an alias for `SONARR_URL`.                                                                         |
| `SONARR_API_KEY` | yes      | API key from Settings > General > Security.                                                                    |

The server speaks stdio only — it is a single-user, single-instance server. It is never asked for your key over the network; the key is read from the environment and sent to Sonarr as the `X-Api-Key` header.

## Available tools

| Category           | Tools                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Series             | `list_series`, `get_series`, `lookup_series`, `add_series`, `update_series`, `delete_series`, `edit_series_bulk`, `delete_series_bulk`, `get_series_folder`, `set_season_monitored`                                                                                                                                                          |
| Episodes           | `list_episodes`, `get_episode`, `set_episodes_monitored`                                                                                                                                                                                                                                                                                     |
| Episode files      | `list_episode_files`, `get_episode_file`, `delete_episode_file`, `delete_episode_files`, `update_episode_files`                                                                                                                                                                                                                              |
| Calendar & wanted  | `get_calendar`, `get_missing_episodes`, `get_cutoff_unmet_episodes`                                                                                                                                                                                                                                                                          |
| Queue              | `get_queue`, `get_queue_details`, `get_queue_status`, `remove_queue_item`, `remove_queue_items`, `grab_queue_item`, `grab_queue_items`                                                                                                                                                                                                       |
| History            | `get_history`, `get_history_since`, `get_series_history`, `mark_history_item_failed`                                                                                                                                                                                                                                                         |
| Blocklist          | `get_blocklist`, `remove_blocklist_item`, `remove_blocklist_items`                                                                                                                                                                                                                                                                           |
| Search & releases  | `search_releases`, `grab_release`, `get_manual_import_candidates`, `get_rename_preview`, `parse_release_title`                                                                                                                                                                                                                               |
| Commands           | `run_command`, `list_commands`, `get_command`, `cancel_command`, `refresh_series`, `rescan_series`, `search_series`, `search_season`, `search_episodes`, `list_scheduled_tasks`, `get_scheduled_task`                                                                                                                                        |
| Quality profiles   | `list_quality_profiles`, `get_quality_profile`, `get_quality_profile_schema`, `create_quality_profile`, `update_quality_profile`, `delete_quality_profile`                                                                                                                                                                                   |
| Quality & formats  | `list_quality_definitions`, `update_quality_definitions`, `list_custom_formats`, `get_custom_format`, `get_custom_format_schema`, `create_custom_format`, `update_custom_format`, `delete_custom_format`                                                                                                                                     |
| Release rules      | `list_release_profiles`, `create_release_profile`, `update_release_profile`, `delete_release_profile`, `list_delay_profiles`, `list_languages`                                                                                                                                                                                               |
| Indexers           | `list_indexers`, `get_indexer`, `get_indexer_schema`, `create_indexer`, `update_indexer`, `delete_indexer`, `test_indexer`                                                                                                                                                                                                                   |
| Download clients   | `list_download_clients`, `get_download_client`, `get_download_client_schema`, `create_download_client`, `update_download_client`, `delete_download_client`, `test_download_client`                                                                                                                                                           |
| Import lists       | `list_import_lists`, `get_import_list`, `get_import_list_schema`, `create_import_list`, `update_import_list`, `delete_import_list`, `test_import_list`                                                                                                                                                                                       |
| Notifications      | `list_notifications`, `get_notification`, `get_notification_schema`, `create_notification`, `update_notification`, `delete_notification`, `test_notification`                                                                                                                                                                                |
| Root folders       | `list_root_folders`, `get_root_folder`, `add_root_folder`, `delete_root_folder`                                                                                                                                                                                                                                                              |
| Tags               | `list_tags`, `list_tag_details`, `create_tag`, `update_tag`, `delete_tag`                                                                                                                                                                                                                                                                    |
| Exclusions & paths | `list_import_list_exclusions`, `add_import_list_exclusion`, `delete_import_list_exclusion`, `list_remote_path_mappings`, `add_remote_path_mapping`, `delete_remote_path_mapping`                                                                                                                                                             |
| Configuration      | `get_naming_config`, `update_naming_config`, `get_naming_examples`, `get_media_management_config`, `update_media_management_config`, `get_indexer_config`, `update_indexer_config`, `get_download_client_config`, `update_download_client_config`, `get_import_list_config`, `update_import_list_config`, `get_host_config`, `get_ui_config` |
| System             | `get_system_status`, `get_health`, `get_disk_space`, `get_updates`, `list_logs`, `list_log_files`, `get_log_file`, `list_backups`, `restart_sonarr`                                                                                                                                                                                          |

### Notes

- **List tools return summaries.** `list_series`, `list_episodes`, `get_calendar`, `search_releases` and the wanted lists strip images, overviews and alternate titles so a large library still fits in context. Pass `detailed: true`, or use the matching `get_*` tool, when you need the full object.
- **Ids.** Sonarr series ids are not TVDB ids. `lookup_series` returns `tvdbId` (what `add_series` takes); everything else takes the Sonarr `id` from `list_series`.
- **Searching.** `search_series`, `search_season` and `search_episodes` queue Sonarr's own automatic search and return a command id — poll it with `get_command`. `search_releases` instead queries indexers live and returns the candidate releases for you to pick from, which you then send with `grab_release`.
- **Provider configuration.** Indexers, download clients, import lists and notifications are configured through an implementation-specific `fields` array. Call `get_*_schema` for the template, then pass the whole object to `create_*`; for updates, fetch with `get_*`, change what you need, and send it back. Sonarr masks secrets in responses, so re-sending a fetched object keeps the stored secret.
- **Destructive operations are explicit.** `delete_series`, `delete_series_bulk` and the queue tools only touch files on disk when you pass `delete_files` / `remove_from_client`, and both default to the safe choice. `restart_sonarr` is included; there is deliberately no shutdown, restore-backup or update-install tool.
- **Sonarr v4.** The v3 API paths are what Sonarr v4 serves, so this works against both v3 and v4. A handful of endpoints in the published spec (language profiles) exist only on v3 and are not exposed.

## Development

```bash
npm install
npm run build         # tsc -> dist/
npm test              # vitest run
npm run lint          # eslint src
npm run typecheck     # tsc --noEmit
npm run format        # prettier --write .
npm run spec:update   # refresh sonarr-openapi.json from the Sonarr repo
```

`sonarr-openapi.json` is a vendored copy of the [Sonarr v3 OpenAPI spec](https://sonarr.tv/docs/api/) and is the reference for tool parameters — it is not used at runtime.

## License

MIT
