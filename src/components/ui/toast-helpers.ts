import { toast } from "sonner";

/**
 * Errors need a close button and time to read them. Sonner's global `toastOptions`
 * apply to every type, so the per-call options live here instead.
 */
export function toastError(message: string) {
  return toast.error(message, { closeButton: true, duration: 8000 });
}
