import { toast } from "sonner";

/**
 * Errors need a close button and time to read them. Sonner's global `toastOptions`
 * apply to every type, so the per-call options live here instead.
 */
export function toastError(message: string) {
  return toast.error(message, { closeButton: true, duration: 8000 });
}

// The hourglass is shared: the import loop and the analysis queue can both be
// running, and whichever finishes first would otherwise strip the other's cursor.
let progressCursorHolders = 0;

export function acquireProgressCursor() {
  progressCursorHolders += 1;
  if (progressCursorHolders === 1) {
    document.body.classList.add("cursor-progress");
  }
}

export function releaseProgressCursor() {
  progressCursorHolders = Math.max(0, progressCursorHolders - 1);
  if (progressCursorHolders === 0) {
    document.body.classList.remove("cursor-progress");
  }
}
