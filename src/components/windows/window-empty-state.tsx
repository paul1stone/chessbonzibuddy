import { RetroButton } from "@/components/retro";

interface WindowEmptyStateProps {
  /** One specific sentence: what the window is for, and what is missing. */
  message: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * A1: an empty Review or Practice window is 600k px² of bare face, and a 12px sentence in the
 * middle of it reads as a bug. Big art, one sentence and the single action that ends the state.
 */
export function WindowEmptyState({ message, actionLabel, onAction }: WindowEmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      {/* object-contain: the gif is 360x450, so a square box would stretch it 25% wide. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/coolmonkey.gif" alt="" className="h-[120px] w-[120px] object-contain" />
      <p className="max-w-[40ch] text-balance">{message}</p>
      <RetroButton onClick={onAction}>{actionLabel}</RetroButton>
    </div>
  );
}
