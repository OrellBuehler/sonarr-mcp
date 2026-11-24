export function buildQS(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        sp.append(k, String(item));
      }
    } else {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function ok(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text" as const, text }] };
}

export function err(e: unknown) {
  return { content: [{ type: "text" as const, text: String(e) }], isError: true as const };
}

export function pruneUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export interface Paged<T = unknown> {
  page: number;
  pageSize: number;
  sortKey?: string;
  sortDirection?: string;
  totalRecords: number;
  records: T[];
}

export interface SonarrSeries {
  id: number;
  title?: string;
  year?: number;
  status?: string;
  ended?: boolean;
  monitored?: boolean;
  path?: string;
  rootFolderPath?: string;
  qualityProfileId?: number;
  seriesType?: string;
  seasonFolder?: boolean;
  network?: string;
  tvdbId?: number;
  imdbId?: string;
  runtime?: number;
  nextAiring?: string;
  previousAiring?: string;
  tags?: number[];
  seasons?: { seasonNumber: number; monitored: boolean }[];
  statistics?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SonarrEpisode {
  id: number;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisodeNumber?: number | null;
  title?: string;
  airDateUtc?: string;
  hasFile?: boolean;
  monitored?: boolean;
  episodeFileId?: number;
  finaleType?: string | null;
  series?: SonarrSeries;
  [key: string]: unknown;
}

export function summarizeSeries(s: SonarrSeries): Record<string, unknown> {
  const stats = (s.statistics ?? {}) as Record<string, unknown>;
  return pruneUndefined({
    id: s.id,
    title: s.title,
    year: s.year,
    status: s.status,
    monitored: s.monitored,
    seriesType: s.seriesType,
    network: s.network,
    qualityProfileId: s.qualityProfileId,
    path: s.path,
    tvdbId: s.tvdbId,
    tags: s.tags,
    nextAiring: s.nextAiring,
    seasonCount: stats.seasonCount,
    episodeFileCount: stats.episodeFileCount,
    episodeCount: stats.episodeCount,
    totalEpisodeCount: stats.totalEpisodeCount,
    sizeOnDisk: stats.sizeOnDisk,
    percentOfEpisodes: stats.percentOfEpisodes,
  });
}

export function summarizeEpisode(e: SonarrEpisode): Record<string, unknown> {
  return pruneUndefined({
    id: e.id,
    seriesId: e.seriesId,
    seriesTitle: e.series?.title,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
    absoluteEpisodeNumber: e.absoluteEpisodeNumber ?? undefined,
    title: e.title,
    airDateUtc: e.airDateUtc,
    hasFile: e.hasFile,
    monitored: e.monitored,
    episodeFileId: e.episodeFileId || undefined,
    finaleType: e.finaleType ?? undefined,
  });
}

export function summarizeRelease(r: Record<string, unknown>): Record<string, unknown> {
  const quality = (r.quality as { quality?: { name?: string } } | undefined)?.quality?.name;
  const languages = (r.languages as { name?: string }[] | undefined)?.map((l) => l.name);
  return pruneUndefined({
    guid: r.guid,
    title: r.title,
    indexer: r.indexer,
    indexerId: r.indexerId,
    protocol: r.protocol,
    quality,
    languages,
    customFormatScore: r.customFormatScore,
    size: r.size,
    ageHours: r.ageHours,
    publishDate: r.publishDate,
    seeders: r.seeders,
    leechers: r.leechers,
    seasonNumber: r.seasonNumber,
    episodeNumbers: r.episodeNumbers,
    fullSeason: r.fullSeason,
    approved: r.approved,
    rejected: r.rejected,
    rejections: r.rejections,
    downloadAllowed: r.downloadAllowed,
    releaseWeight: r.releaseWeight,
  });
}

export function summarizeList<T>(
  data: unknown,
  fn: (item: T) => Record<string, unknown>,
  detailed?: boolean,
): unknown {
  if (detailed) return data;
  if (Array.isArray(data)) return data.map((item) => fn(item as T));
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.records)) {
      return { ...obj, records: obj.records.map((item) => fn(item as T)) };
    }
  }
  return data;
}

export const READ = { readOnlyHint: true };
export const WRITE = { readOnlyHint: false, destructiveHint: false };
export const UPDATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };
export const DELETE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true };
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true };

export const REDACTED = "[redacted]";

const SECRET = /api_?key|passw|passkey|passphrase|token|secret|cookie|credential|webhook/i;
const URL_USERINFO = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/?#@]+@/gi;
const URL_SECRET_PARAM =
  /((?:[?&]|\\u0026)(?:api_?key|passw(?:or)?d|passkey|token|secret|auth|sig(?:nature)?)=)[^&#\s\\"]+/gi;

export function redactUrls(value: string): string {
  return value.replace(URL_USERINFO, `$1${REDACTED}@`).replace(URL_SECRET_PARAM, `$1${REDACTED}`);
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

export function redactSecrets<T>(data: T): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      out[key] = SECRET.test(key) && value !== "" ? REDACTED : redactUrls(value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function redactField(field: unknown): unknown {
  if (!field || typeof field !== "object") return field;
  const f = field as Record<string, unknown>;
  if (!isSet(f.value)) return f;
  const isPrivate = typeof f.privacy === "string" && f.privacy !== "normal";
  if (isPrivate) return { ...f, value: REDACTED };
  if (typeof f.value !== "string") return f;
  if (SECRET.test(String(f.name ?? ""))) return { ...f, value: REDACTED };
  return { ...f, value: redactUrls(f.value) };
}

export function redactProvider<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => redactProvider(item)) as T;
  if (!data || typeof data !== "object") return data;
  const out = redactSecrets(data) as Record<string, unknown>;
  if (Array.isArray(out.fields)) out.fields = out.fields.map(redactField);
  if (Array.isArray(out.presets)) out.presets = out.presets.map((p) => redactProvider(p));
  return out as T;
}

export function hasRedacted(data: unknown): boolean {
  if (typeof data === "string") return data.includes(REDACTED);
  if (Array.isArray(data)) return data.some(hasRedacted);
  if (data && typeof data === "object") return Object.values(data).some(hasRedacted);
  return false;
}

export function restoreRedacted(
  incoming: Record<string, unknown>,
  stored: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (key !== "fields" && hasRedacted(value)) {
      if (!(key in stored)) throw new Error(`'${key}' is redacted and has no stored value`);
      out[key] = stored[key];
    } else {
      out[key] = value;
    }
  }
  if (Array.isArray(incoming.fields)) {
    const current = (Array.isArray(stored.fields) ? stored.fields : []) as Record<
      string,
      unknown
    >[];
    out.fields = incoming.fields.map((field) => {
      if (!hasRedacted(field)) return field;
      const f = field as Record<string, unknown>;
      const match = current.find((c) => c.name === f.name);
      if (!match) throw new Error(`Field '${String(f.name)}' is redacted and has no stored value`);
      return { ...f, value: match.value };
    });
  }
  return out;
}
