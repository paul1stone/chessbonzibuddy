"use client";

import { FatalPanel } from "@/components/retro/fatal-panel";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <FatalPanel reset={reset} digest={error.digest} />;
}
