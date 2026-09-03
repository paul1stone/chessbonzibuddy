"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { RetroButton } from "@/components/retro";
import {
  acquireProgressCursor,
  releaseProgressCursor,
} from "@/components/ui/toast-helpers";
import {
  RecentGames,
  type ImportOne,
  type ImportProgress,
  type RecentGameData,
} from "@/components/import/recent-games";

export type { ImportOne, RecentGameData };

const TABS = [
  { id: "recent", label: "Recent games" },
  { id: "url", label: "Paste URL" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ImportWindowProps {
  onImportUrl: (url: string) => Promise<void>;
  onImportOne?: ImportOne;
  importing: boolean;
}

export function ImportWindow({
  onImportUrl,
  onImportOne,
  importing,
}: ImportWindowProps) {
  const [tab, setTab] = useState<TabId>("recent");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const runningRef = useRef(false);

  const busy = importing || progress !== null;

  // Hourglass while a POST is in flight, refcounted because the analysis queue
  // raises the same one.
  useEffect(() => {
    if (!busy) return;
    acquireProgressCursor();
    return releaseProgressCursor;
  }, [busy]);

  // The counter ticks per game but only the run's start and end are announced:
  // a live region on the counter itself queues one reading per import.
  const handleProgress = useCallback((next: ImportProgress | null) => {
    setProgress(next);
    if (next && !runningRef.current) {
      runningRef.current = true;
      setAnnouncement(
        `Importing ${next.total} game${next.total === 1 ? "" : "s"}.`
      );
    } else if (!next && runningRef.current) {
      runningRef.current = false;
      setAnnouncement("Import finished.");
    }
  }, []);

  const status = progress
    ? `Importing ${progress.done} of ${progress.total}…`
    : importing
      ? "Importing…"
      : "Ready";

  // Roving tablist: arrows move selection and focus together.
  function handleTabKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((t) => t.id === tab);
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;

    e.preventDefault();
    const nextId = TABS[next].id;
    setTab(nextId);
    tabRefs.current[nextId]?.focus();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Please enter a Chess.com game URL");
      return;
    }

    try {
      await onImportUrl(url.trim());
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import game");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="r-tabs shrink-0"
        role="tablist"
        aria-label="Import source"
        onKeyDown={handleTabKeyDown}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            id={`import-tab-${id}`}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            role="tab"
            aria-selected={tab === id}
            aria-controls="import-pane"
            tabIndex={tab === id ? 0 : -1}
            className={`r-tab ${tab === id ? "r-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="import-pane"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`import-tab-${tab}`}
        className="r-face r-bevel-out flex min-h-0 flex-1 flex-col p-3"
      >
        {tab === "recent" ? (
          <RecentGames onImportOne={onImportOne} onProgress={handleProgress} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              Chess.com game URL
              <input
                placeholder="https://www.chess.com/game/live/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={importing}
                className="r-input w-full"
              />
            </label>
            {error && <p className="text-[#800000]">{error}</p>}
            <div className="flex">
              <RetroButton type="submit" disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </RetroButton>
            </div>
          </form>
        )}
      </div>

      <div className="r-bevel-in r-statusbar shrink-0">{status}</div>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
