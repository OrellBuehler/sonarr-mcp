import { vi } from "vitest";
import { SonarrClient } from "../sonarr/client.js";

export type ToolHandler = (
  args: any,
) => Promise<{ content: { text: string }[]; isError?: boolean }>;

export type Register = (server: any, client: SonarrClient) => void;

export function collectTools(...registrars: Register[]) {
  const tools = new Map<string, ToolHandler>();
  const schemas = new Map<string, unknown>();
  const server = {
    tool: (name: string, _desc: string, schema: unknown, handler: ToolHandler) => {
      tools.set(name, handler);
      schemas.set(name, schema);
    },
  };
  const client = new SonarrClient("http://sonarr:8989", "test-key");
  for (const register of registrars) register(server as any, client);
  return { tools, schemas };
}

export function mockJson(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

export function mockText(body: string, contentType = "text/plain") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": contentType }),
    text: () => Promise.resolve(body),
  };
}

export function mockError(status: number, body: string) {
  return {
    ok: false,
    status,
    statusText: "Bad Request",
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(body),
  };
}

export function stubFetch() {
  const mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

export function callAt(mockFetch: ReturnType<typeof vi.fn>, index = 0) {
  const [url, options] = mockFetch.mock.calls[index];
  return {
    url: url as string,
    method: (options?.method as string) ?? "GET",
    headers: (options?.headers ?? {}) as Record<string, string>,
    body: options?.body ? JSON.parse(options.body as string) : undefined,
  };
}

export function payload(res: { content: { text: string }[] }) {
  return JSON.parse(res.content[0].text);
}
