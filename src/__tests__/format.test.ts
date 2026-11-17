import { describe, it, expect } from "vitest";
import {
  buildQS,
  ok,
  err,
  pruneUndefined,
  summarizeSeries,
  summarizeEpisode,
  summarizeRelease,
  summarizeList,
  redactSecrets,
  redactProvider,
  hasRedacted,
  restoreRedacted,
  REDACTED,
} from "../sonarr/format.js";

describe("buildQS", () => {
  it("returns an empty string when nothing is set", () => {
    expect(buildQS({ a: undefined, b: null })).toBe("");
  });

  it("repeats array values as separate parameters", () => {
    expect(buildQS({ seriesIds: [1, 2], page: 3 })).toBe("?seriesIds=1&seriesIds=2&page=3");
  });

  it("keeps false and zero", () => {
    expect(buildQS({ monitored: false, page: 0 })).toBe("?monitored=false&page=0");
  });
});

describe("ok / err", () => {
  it("passes strings through unquoted and stringifies objects", () => {
    expect(ok("plain").content[0].text).toBe("plain");
    expect(ok({ a: 1 }).content[0].text).toBe('{"a":1}');
  });

  it("marks errors", () => {
    const res = err(new Error("boom"));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("boom");
  });
});

describe("summaries", () => {
  it("pruneUndefined drops undefined but keeps null and false", () => {
    expect(pruneUndefined({ a: undefined, b: null, c: false })).toEqual({ b: null, c: false });
  });

  it("summarizeSeries flattens the statistics block", () => {
    const s = summarizeSeries({
      id: 7,
      title: "Show",
      year: 2020,
      monitored: true,
      overview: "long text",
      images: [{}],
      statistics: { seasonCount: 3, episodeFileCount: 20, sizeOnDisk: 123 },
    } as any);
    expect(s).toMatchObject({ id: 7, title: "Show", seasonCount: 3, sizeOnDisk: 123 });
    expect(s.overview).toBeUndefined();
    expect(s.images).toBeUndefined();
  });

  it("summarizeEpisode lifts the series title and drops the episode file object", () => {
    const e = summarizeEpisode({
      id: 3,
      seriesId: 7,
      seasonNumber: 1,
      episodeNumber: 2,
      title: "Pilot",
      hasFile: true,
      episodeFileId: 44,
      episodeFile: { path: "/tv/x.mkv" },
      series: { id: 7, title: "Show" },
    } as any);
    expect(e).toMatchObject({ id: 3, seriesTitle: "Show", episodeFileId: 44 });
    expect(e.episodeFile).toBeUndefined();
  });

  it("summarizeRelease flattens quality and languages", () => {
    const r = summarizeRelease({
      guid: "g",
      title: "Show.S01E01",
      indexerId: 2,
      quality: { quality: { name: "WEBDL-1080p" } },
      languages: [{ id: 1, name: "English" }],
      rejected: true,
      rejections: ["size"],
    });
    expect(r).toMatchObject({
      guid: "g",
      quality: "WEBDL-1080p",
      languages: ["English"],
      rejections: ["size"],
    });
  });

  it("summarizeList maps paged records and honours detailed", () => {
    const paged = { page: 1, totalRecords: 1, records: [{ id: 1, seasonNumber: 2 }] };
    const mapped = summarizeList(paged, summarizeEpisode) as any;
    expect(mapped.totalRecords).toBe(1);
    expect(mapped.records[0]).toEqual({ id: 1, seasonNumber: 2 });
    expect(summarizeList(paged, summarizeEpisode, true)).toBe(paged);
  });
});

describe("redaction", () => {
  it("redactSecrets masks secret-looking keys and credentials inside URLs", () => {
    expect(
      redactSecrets({
        apiKey: "k",
        api_key: "k",
        proxyPassword: "p",
        authToken: "t",
        clientSecret: "s",
        password: "",
        port: 8989,
        authenticationMethod: "forms",
        url: "http://a:b@host/path?token=abc&x=1",
      }),
    ).toEqual({
      apiKey: REDACTED,
      api_key: REDACTED,
      proxyPassword: REDACTED,
      authToken: REDACTED,
      clientSecret: REDACTED,
      password: "",
      port: 8989,
      authenticationMethod: "forms",
      url: `http://${REDACTED}@host/path?token=${REDACTED}&x=1`,
    });
    expect(redactSecrets([1])).toEqual([1]);
    expect(redactSecrets("text")).toBe("text");
  });

  it("redactProvider handles arrays, presets and non-string private values", () => {
    const out = redactProvider([
      {
        fields: [{ name: "pin", value: 1234, privacy: "password" }],
        presets: [{ fields: [{ name: "apiKey", value: "x" }] }],
      },
    ]) as any[];
    expect(out[0].fields[0].value).toBe(REDACTED);
    expect(out[0].presets[0].fields[0].value).toBe(REDACTED);
  });

  it("hasRedacted finds placeholders at any depth", () => {
    expect(hasRedacted({ a: [{ b: `x${REDACTED}y` }] })).toBe(true);
    expect(hasRedacted({ a: [{ b: "********" }], c: 1, d: null })).toBe(false);
  });

  it("restoreRedacted takes top-level values and fields from the stored object", () => {
    expect(
      restoreRedacted(
        { name: "n", url: `http://${REDACTED}@h`, fields: [{ name: "k", value: REDACTED }] },
        { url: "http://a:b@h", fields: [{ name: "k", value: "real" }] },
      ),
    ).toEqual({ name: "n", url: "http://a:b@h", fields: [{ name: "k", value: "real" }] });
    expect(() => restoreRedacted({ url: REDACTED }, {})).toThrow("no stored value");
    expect(() => restoreRedacted({ fields: [{ name: "k", value: REDACTED }] }, {})).toThrow(
      "no stored value",
    );
  });
});
