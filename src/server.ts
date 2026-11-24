import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SonarrClient } from "./sonarr/client.js";
import { registerSeriesTools } from "./tools/series.js";
import { registerEpisodeTools } from "./tools/episodes.js";
import { registerCalendarTools } from "./tools/calendar.js";
import { registerQueueTools } from "./tools/queue.js";
import { registerHistoryTools } from "./tools/history.js";
import { registerWantedTools } from "./tools/wanted.js";
import { registerBlocklistTools } from "./tools/blocklist.js";
import { registerCommandTools } from "./tools/commands.js";
import { registerReleaseTools } from "./tools/releases.js";
import { registerProfileTools } from "./tools/profiles.js";
import { registerProviderTools } from "./tools/providers.js";
import { registerOrganizationTools } from "./tools/organization.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerSystemTools } from "./tools/system.js";

export function createServer(client: SonarrClient): McpServer {
  const server = new McpServer({ name: "sonarr-mcp", version: "0.2.2" });
  registerSeriesTools(server, client);
  registerEpisodeTools(server, client);
  registerCalendarTools(server, client);
  registerQueueTools(server, client);
  registerHistoryTools(server, client);
  registerWantedTools(server, client);
  registerBlocklistTools(server, client);
  registerCommandTools(server, client);
  registerReleaseTools(server, client);
  registerProfileTools(server, client);
  registerProviderTools(server, client);
  registerOrganizationTools(server, client);
  registerSettingsTools(server, client);
  registerSystemTools(server, client);
  return server;
}
