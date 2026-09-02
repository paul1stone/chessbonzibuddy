import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENGINE_WASM_URL,
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
