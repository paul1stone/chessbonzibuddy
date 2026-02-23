"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, Check, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProfileStore } from "@/stores/profile-store";
import { fetchChessComRatings, fetchLichessRatings } from "@/lib/ratings";
import { toast } from "sonner";

function RatingBadge({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  return (
    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
      {label}: {value}
    </span>
  );
}

export function ProfileSettings() {
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
  const [isExpanded, setIsExpanded] = useState(false);
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

  const hasLinkedAccount = chessComUsername || lichessUsername;

  // Collapsed view: just show a summary
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-zinc-800/50"
      >
        <User className="h-4 w-4 text-zinc-500" />
        {hasLinkedAccount ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-zinc-300">
              {chessComUsername || lichessUsername}
            </span>
            <div className="flex gap-1.5">
              {chessComRatings && (
                <RatingBadge
                  label="Rapid"
                  value={chessComRatings.rapid}
                />
              )}
              {chessComRatings && (
                <RatingBadge
                  label="Blitz"
                  value={chessComRatings.blitz}
                />
              )}
              {lichessRatings && !chessComRatings && (
                <RatingBadge
                  label="Rapid"
                  value={lichessRatings.rapid}
                />
              )}
              {lichessRatings && !chessComRatings && (
                <RatingBadge
                  label="Blitz"
                  value={lichessRatings.blitz}
                />
              )}
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">Link your account</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-3 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">
          Linked Accounts
        </span>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          Done
        </button>
      </div>

      {/* Chess.com */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-zinc-500">
          Chess.com
        </label>
        <div className="flex gap-1.5">
          <Input
            placeholder="Username"
            value={chessComInput}
            onChange={(e) => setChessComInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLinkChessCom()}
            className="h-7 text-xs"
            disabled={loadingChessCom}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 shrink-0 px-0"
            onClick={handleLinkChessCom}
            disabled={loadingChessCom || !chessComInput.trim()}
          >
            {loadingChessCom ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : chessComUsername ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
        </div>
        {chessComRatings && (
          <div className="flex gap-1.5">
            <RatingBadge label="Rapid" value={chessComRatings.rapid} />
            <RatingBadge label="Blitz" value={chessComRatings.blitz} />
            <RatingBadge label="Bullet" value={chessComRatings.bullet} />
          </div>
        )}
      </div>

      {/* Lichess */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-zinc-500">
          Lichess
        </label>
        <div className="flex gap-1.5">
          <Input
            placeholder="Username"
            value={lichessInput}
            onChange={(e) => setLichessInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLinkLichess()}
            className="h-7 text-xs"
            disabled={loadingLichess}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 shrink-0 px-0"
            onClick={handleLinkLichess}
            disabled={loadingLichess || !lichessInput.trim()}
          >
            {loadingLichess ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : lichessUsername ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
        </div>
        {lichessRatings && (
          <div className="flex gap-1.5">
            <RatingBadge label="Rapid" value={lichessRatings.rapid} />
            <RatingBadge label="Blitz" value={lichessRatings.blitz} />
            <RatingBadge label="Bullet" value={lichessRatings.bullet} />
          </div>
        )}
      </div>
    </div>
  );
}
