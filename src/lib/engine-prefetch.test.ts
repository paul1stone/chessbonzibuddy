import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelEnginePrefetch,
  ENGINE_WASM_URL,
  isAbortError,
  isEngineFetched,
  prefetchEngine,
  resetEnginePrefetch,
  type PrefetchProgress,
} from "./engine-prefetch";

/** A response whose body arrives in `chunks` byte-sized pieces. */
function streamedResponse(chunks: number[], headers: Record<string, string> = {}) {
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => headers[name] ?? null },
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: new Uint8Array(chunks[i++]) }
            : { done: true, value: undefined },
      }),
    },
  };
}

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  resetEnginePrefetch();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetEnginePrefetch();
});

describe("prefetchEngine", () => {
  it("drains the wasm from its own URL with default options", async () => {
    const fetchMock = vi.fn(async () =>
      streamedResponse([50, 50], { "Content-Length": "100" })
    );
    vi.stubGlobal("fetch", fetchMock);

    await prefetchEngine();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENGINE_WASM_URL);
    // Only the abort signal: any other option would fill a cache entry the worker never reads.
    expect(Object.keys(init)).toEqual(["signal"]);
  });

  it("reports percentages against Content-Length and ends at 100", async () => {
    vi.stubGlobal("fetch", async () =>
      streamedResponse([25, 25, 50], { "Content-Length": "100" })
    );

    const seen: PrefetchProgress[] = [];
    await prefetchEngine((p) => seen.push(p));

    expect(seen.map((p) => p.percent)).toEqual([0, 25, 50, 99, 100]);
    expect(seen.every((p) => !p.estimated)).toBe(true);
  });

  it("falls back to the ~113 MB estimate when no length is declared", async () => {
    vi.stubGlobal("fetch", async () => streamedResponse([1_130_000]));

    const seen: PrefetchProgress[] = [];
    await prefetchEngine((p) => seen.push(p));

    expect(seen[0].estimated).toBe(true);
    expect(seen[1].percent).toBe(1);
    expect(seen.at(-1)?.percent).toBe(100);
  });

  it("latches the session flag so the gate only asks once", async () => {
    const fetchMock = vi.fn(async () =>
      streamedResponse([10], { "Content-Length": "10" })
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(isEngineFetched()).toBe(false);
    await prefetchEngine();
    expect(isEngineFetched()).toBe(true);

    await prefetchEngine();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one download between concurrent callers", async () => {
    const fetchMock = vi.fn(async () =>
      streamedResponse([10, 10], { "Content-Length": "20" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const play: PrefetchProgress[] = [];
    const analysis: PrefetchProgress[] = [];
    await Promise.all([
      prefetchEngine((p) => play.push(p)),
      prefetchEngine((p) => analysis.push(p)),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(play.at(-1)?.percent).toBe(100);
    expect(analysis.at(-1)?.percent).toBe(100);
  });

  it("ignores Content-Length on a compressed response", async () => {
    // The header counts encoded bytes, the reader yields decoded ones — trusting it would
    // run the bar out early and park it on the clamp.
    vi.stubGlobal("fetch", async () =>
      streamedResponse([50, 50], {
        "Content-Length": "60",
        "Content-Encoding": "gzip",
      })
    );

    const seen: PrefetchProgress[] = [];
    await prefetchEngine((p) => seen.push(p));

    expect(seen.every((p) => p.estimated)).toBe(true);
    expect(seen.every((p) => p.total === 113_000_000)).toBe(true);
    expect(seen.at(-1)?.percent).toBe(100);
  });

  it("emits once per whole percent rather than once per chunk", async () => {
    // 200 single-byte chunks against a declared 100 bytes: each percent is reached twice.
    vi.stubGlobal("fetch", async () =>
      streamedResponse(Array(200).fill(1), { "Content-Length": "100" })
    );

    const seen: PrefetchProgress[] = [];
    await prefetchEngine((p) => seen.push(p));

    expect(seen.length).toBeLessThanOrEqual(101);
    expect(new Set(seen.map((p) => p.percent)).size).toBe(seen.length);
  });

  it("cancel aborts the download and leaves it retryable", async () => {
    const aborting = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );
    vi.stubGlobal("fetch", aborting);

    const settled = prefetchEngine().catch((err) => err);
    cancelEnginePrefetch();
    const err = await settled;

    expect(isAbortError(err)).toBe(true);
    expect(isEngineFetched()).toBe(false);

    // The next attempt starts a fresh request rather than reusing the aborted one.
    vi.stubGlobal("fetch", async () =>
      streamedResponse([10], { "Content-Length": "10" })
    );
    await prefetchEngine();
    expect(isEngineFetched()).toBe(true);
  });

  it("recognises an abort without requiring an Error subclass", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });

  it("leaves the flag unset when the download fails, so a retry re-runs it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: { get: () => null } })
      .mockResolvedValueOnce(streamedResponse([10], { "Content-Length": "10" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(prefetchEngine()).rejects.toThrow("503");
    expect(isEngineFetched()).toBe(false);

    await prefetchEngine();
    expect(isEngineFetched()).toBe(true);
  });
});
