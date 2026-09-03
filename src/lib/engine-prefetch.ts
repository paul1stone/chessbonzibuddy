/**
 * Fetches Stockfish's ~113 MB wasm up front, so the download the engine needs happens behind a
 * progress bar the user agreed to rather than inside a silent worker handshake.
 *
 * The request deliberately mirrors the worker's own — same URL, default options, body drained
 * to the end — so both land on one cache entry: verified in dev, the worker's streaming
 * instantiate reuses this response (~300 bytes on the wire against a 75 MB body) instead of
 * fetching the engine again.
 */

export const ENGINE_WASM_URL = "/stockfish/stockfish.wasm";

/**
 * Session flag only: the HTTP cache usually outlives the session, so a later visit that shows
 * the dialog again will often complete it instantly. The dialog copy says so.
 */
const SESSION_KEY = "cbb-engine-fetched";

/** Used when no usable size is declared, so the bar is still a bar. */
const APPROX_BYTES = 113_000_000;

export interface PrefetchProgress {
  /** Bytes drained so far. */
  received: number;
  /** Declared Content-Length, or the ~113 MB estimate when there is no usable one. */
  total: number;
  /** 0-100, held below 100 until the stream actually ends. */
  percent: number;
  /** True when `total` is the estimate rather than a declared length. */
  estimated: boolean;
}

export type ProgressListener = (progress: PrefetchProgress) => void;

let fetched = false;
let inFlight: Promise<void> | null = null;
let controller: AbortController | null = null;
const listeners = new Set<ProgressListener>();

// Reading the property itself throws when site data is blocked, so every call goes through this.
function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Whether this session has already primed the cache — the gate's "skip the dialog" test. */
export function isEngineFetched(): boolean {
  if (fetched) return true;
  fetched = sessionStore()?.getItem(SESSION_KEY) === "1";
  return fetched;
}

function markFetched(): void {
  fetched = true;
  try {
    sessionStore()?.setItem(SESSION_KEY, "1");
  } catch {
    // Quota or a private window: the in-memory latch still holds for this page.
  }
}

/** Aborts the download in flight. The pending `prefetchEngine` promises reject with AbortError. */
export function cancelEnginePrefetch(): void {
  controller?.abort();
}

export function isAbortError(err: unknown): boolean {
  // Not `instanceof Error`: an abort arrives as a DOMException, which some browsers do not
  // derive from Error.
  return (err as { name?: unknown } | null | undefined)?.name === "AbortError";
}

/** Test seam: drops the latch, the listeners, and any run in flight. */
export function resetEnginePrefetch(): void {
  fetched = false;
  inFlight = null;
  controller = null;
  listeners.clear();
}

/**
 * Downloads the engine wasm into the HTTP cache, reporting progress until it lands.
 *
 * Concurrent callers share one download (and one abort): the play gate and the analysis gate
 * are the same 113 MB.
 */
export function prefetchEngine(onProgress?: ProgressListener): Promise<void> {
  if (isEngineFetched()) {
    onProgress?.({ received: 0, total: 0, percent: 100, estimated: false });
    return Promise.resolve();
  }

  if (onProgress) listeners.add(onProgress);

  if (!inFlight) {
    controller = new AbortController();
    inFlight = download(controller.signal)
      .then(markFetched)
      .finally(() => {
        inFlight = null;
        controller = null;
        listeners.clear();
      });
  }

  return inFlight;
}

function emit(progress: PrefetchProgress): void {
  for (const listener of listeners) listener(progress);
}

async function download(signal: AbortSignal): Promise<void> {
  // Default options on purpose: a request that differs from the worker's own (a different
  // cache mode, say) would fill a cache entry the worker never reads.
  const res = await fetch(ENGINE_WASM_URL, { signal });
  if (!res.ok) {
    throw new Error(`Engine download failed (HTTP ${res.status})`);
  }

  // Content-Length counts ENCODED bytes while the reader hands back decoded ones, so on a
  // compressed response (the wasm gzips 113 MB down to ~76 MB) the declared length would run
  // out a third early and park the bar on its clamp. Estimate instead.
  const declared = Number(res.headers.get("Content-Length"));
  const estimated =
    Boolean(res.headers.get("Content-Encoding")) ||
    !(Number.isFinite(declared) && declared > 0);
  const total = estimated ? APPROX_BYTES : declared;

  let lastPercent = -1;
  const report = (received: number, done: boolean) => {
    // Clamped below 100 until the stream ends: an estimate that undershoots must never
    // park the bar at "done" while bytes are still arriving.
    const percent = done ? 100 : Math.min(99, Math.floor((received / total) * 100));
    // One emit per whole percent — the raw stream fires thousands of chunks, and each one
    // would otherwise re-render the dialog for a bar that cannot move.
    if (percent === lastPercent) return;
    lastPercent = percent;
    emit({ received, total, percent, estimated });
  };

  if (!res.body) {
    // No stream to read (a test double, or a browser without streaming responses): the cache
    // only needs the body drained, so drain it in one piece.
    await res.arrayBuffer();
    report(total, true);
    return;
  }

  const reader = res.body.getReader();
  let received = 0;
  report(0, false);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // The bytes are dropped as they arrive — the cache entry is the whole point, not the buffer.
    received += value.byteLength;
    report(received, false);
  }

  report(received, true);
}
