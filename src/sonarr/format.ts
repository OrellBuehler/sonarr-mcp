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
