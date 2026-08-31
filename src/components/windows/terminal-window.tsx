"use client";

import dynamic from "next/dynamic";

// v86, its 2 MB wasm and xterm are fetched only when the window is opened.
const TerminalWindowInner = dynamic(() => import("./terminal-window-inner"), {
  ssr: false,
  loading: () => <div className="r-skeleton min-h-0 flex-1" aria-hidden="true" />,
});

export default function TerminalWindow() {
  return <TerminalWindowInner />;
}
