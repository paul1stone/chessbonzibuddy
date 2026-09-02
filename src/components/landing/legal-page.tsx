import Link from "next/link";
import type { ReactNode } from "react";
import { RetroButton, RetroWindow } from "@/components/retro";

// Both legal pages carry the same nav, so each cross-links to the other and neither is a dead end
// once the landing footer is gone. Vertical padding on the inline links buys a >=24px touch target
// without moving a single line of prose (padding on an inline box never grows the line box).
const NAV_LINK = "inline-flex min-h-[24px] items-center";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-[min(92vw,760px)] py-10">
      <RetroWindow title={`${title} - Chess Bonzi Buddy`} statusBar={`Last updated ${updated}`} aria-labelledby="legal-heading">
        <article className="r-body r-paper r-bevel-in wrap-anywhere p-5 [&_h1]:mb-4 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[16px] [&_h2]:font-bold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_a]:py-[5px]">
          <h1 id="legal-heading">{title}</h1>
          {children}
        </article>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <nav aria-label="Site" className="flex flex-wrap items-center gap-x-4 text-[11px]">
            <Link href="/privacy" className={NAV_LINK}>Privacy</Link>
            <Link href="/terms" className={NAV_LINK}>Terms</Link>
            <Link href="/app?view=play-bonzi" className={NAV_LINK}>Play Bonzi Buddy</Link>
          </nav>
          <RetroButton href="/">Back to home</RetroButton>
        </div>
      </RetroWindow>
    </main>
  );
}
