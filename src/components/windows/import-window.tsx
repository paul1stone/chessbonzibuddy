"use client";

import { useState, type FormEvent } from "react";
import { RetroButton } from "@/components/retro";
import { RecentGames, type RecentGameData } from "@/components/import/recent-games";

export type { RecentGameData };

interface ImportWindowProps {
  onImportUrl: (url: string) => Promise<void>;
  onBulkImport: (games: RecentGameData[]) => Promise<void>;
  importing: boolean;
}

export function ImportWindow({
  onImportUrl,
  onBulkImport,
  importing,
}: ImportWindowProps) {
  const [tab, setTab] = useState<"recent" | "url">("recent");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      <div className="r-tabs shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "recent"}
          aria-controls="import-pane"
          className={`r-tab ${tab === "recent" ? "r-tab--active" : ""}`}
          onClick={() => setTab("recent")}
        >
          Recent games
        </button>
        <button
          role="tab"
          aria-selected={tab === "url"}
          aria-controls="import-pane"
          className={`r-tab ${tab === "url" ? "r-tab--active" : ""}`}
          onClick={() => setTab("url")}
        >
          Paste URL
        </button>
      </div>

      <div
        id="import-pane"
        role="tabpanel"
        className="r-face r-bevel-out flex min-h-0 flex-1 flex-col p-3"
      >
        {tab === "recent" ? (
          <RecentGames onImport={onBulkImport} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              Chess.com or Lichess game URL
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
    </div>
  );
}
