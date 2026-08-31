"use client";

import { useState, useCallback, useEffect } from "react";
import { RetroButton, RetroPanel } from "@/components/retro";
import { useProfileStore } from "@/stores/profile-store";
import { fetchChessComRatings, fetchLichessRatings } from "@/lib/ratings";
import { toast } from "sonner";

function RatingBadge({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  return (
    <span className="r-badge r-badge--flat">
      {label}: {value}
    </span>
  );
}

export function ProfileWindow() {
  const chessComUsername = useProfileStore((s) => s.chessComUsername);
  const lichessUsername = useProfileStore((s) => s.lichessUsername);
  const chessComRatings = useProfileStore((s) => s.chessComRatings);
  const lichessRatings = useProfileStore((s) => s.lichessRatings);
  const setChessComUsername = useProfileStore((s) => s.setChessComUsername);
  const setLichessUsername = useProfileStore((s) => s.setLichessUsername);
  const setChessComRatings = useProfileStore((s) => s.setChessComRatings);
  const setLichessRatings = useProfileStore((s) => s.setLichessRatings);

  const [chessComInput, setChessComInput] = useState(chessComUsername);
  const [lichessInput, setLichessInput] = useState(lichessUsername);
  const [loadingChessCom, setLoadingChessCom] = useState(false);
  const [loadingLichess, setLoadingLichess] = useState(false);

  // Sync inputs when store changes
  useEffect(() => {
    setChessComInput(chessComUsername);
  }, [chessComUsername]);
  useEffect(() => {
    setLichessInput(lichessUsername);
  }, [lichessUsername]);

  const handleLinkChessCom = useCallback(async () => {
    const username = chessComInput.trim();
    if (!username) return;

    setLoadingChessCom(true);
    try {
      const ratings = await fetchChessComRatings(username);
      setChessComUsername(username);
      setChessComRatings(ratings);
      toast.success(`Linked Chess.com account: ${username}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch Chess.com ratings"
      );
    } finally {
      setLoadingChessCom(false);
    }
  }, [chessComInput, setChessComUsername, setChessComRatings]);

  const handleLinkLichess = useCallback(async () => {
    const username = lichessInput.trim();
    if (!username) return;

    setLoadingLichess(true);
    try {
      const ratings = await fetchLichessRatings(username);
      setLichessUsername(username);
      setLichessRatings(ratings);
      toast.success(`Linked Lichess account: ${username}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch Lichess ratings"
      );
    } finally {
      setLoadingLichess(false);
    }
  }, [lichessInput, setLichessUsername, setLichessRatings]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <RetroPanel caption="Chess.com">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              placeholder="Username"
              value={chessComInput}
              onChange={(e) => setChessComInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLinkChessCom();
                }
              }}
              className="r-input min-w-0 flex-1"
              disabled={loadingChessCom}
              aria-label="Chess.com username"
            />
            <RetroButton
              className="shrink-0"
              onClick={handleLinkChessCom}
              disabled={loadingChessCom || !chessComInput.trim()}
            >
              {loadingChessCom ? "Linking..." : "Link"}
            </RetroButton>
          </div>
          {chessComRatings && (
            <div className="flex flex-wrap gap-1.5">
              <RatingBadge label="Rapid" value={chessComRatings.rapid} />
              <RatingBadge label="Blitz" value={chessComRatings.blitz} />
              <RatingBadge label="Bullet" value={chessComRatings.bullet} />
            </div>
          )}
        </div>
      </RetroPanel>

      <RetroPanel caption="Lichess">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              placeholder="Username"
              value={lichessInput}
              onChange={(e) => setLichessInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLinkLichess();
                }
              }}
              className="r-input min-w-0 flex-1"
              disabled={loadingLichess}
              aria-label="Lichess username"
            />
            <RetroButton
              className="shrink-0"
              onClick={handleLinkLichess}
              disabled={loadingLichess || !lichessInput.trim()}
            >
              {loadingLichess ? "Linking..." : "Link"}
            </RetroButton>
          </div>
          {lichessRatings && (
            <div className="flex flex-wrap gap-1.5">
              <RatingBadge label="Rapid" value={lichessRatings.rapid} />
              <RatingBadge label="Blitz" value={lichessRatings.blitz} />
              <RatingBadge label="Bullet" value={lichessRatings.bullet} />
            </div>
          )}
        </div>
      </RetroPanel>
    </div>
  );
}
