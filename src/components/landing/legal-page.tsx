import Link from "next/link";
import type { ReactNode } from "react";
import { RetroButton, RetroWindow } from "@/components/retro";

// Both legal pages carry the same nav, so each cross-links to the other and neither is a dead end
// once the landing footer is gone. `self` marks the page you are already on; the link stays a link
// so the nav is identical on both, aria-current just stops it reading as somewhere new to go.
// The 24px min-height is the touch target — the visuals are unchanged.
const NAV_LINK = "inline-flex min-h-[24px] items-center";

interface LegalPageProps {
  title: string;
  updated: string;
  self: "privacy" | "terms";
  children: ReactNode;
}

export function LegalPage({ title, updated, self, children }: LegalPageProps) {
  return (
    <main className="mx-auto w-[min(92vw,760px)] py-10">
      <RetroWindow title={`${title} - Chess Bonzi Buddy`} statusBar={`Last updated ${updated}`} aria-labelledby="legal-heading">
        <article className="r-body r-paper r-bevel-in wrap-anywhere p-5 [&_h1]:mb-4 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[16px] [&_h2]:font-bold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_a]:py-[5px]">
          <h1 id="legal-heading">{title}</h1>
          {children}
        </article>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <nav aria-label="Site" className="flex flex-wrap items-center gap-x-4 text-[11px]">
            <Link href="/privacy" className={NAV_LINK} aria-current={self === "privacy" ? "page" : undefined}>
              Privacy
            </Link>
            <Link href="/terms" className={NAV_LINK} aria-current={self === "terms" ? "page" : undefined}>
              Terms
            </Link>
            <Link href="/app?view=play-bonzi" className={NAV_LINK}>Play Bonzi Buddy</Link>
          </nav>
          <RetroButton href="/">Back to home</RetroButton>
        </div>
      </RetroWindow>
    </main>
  );
}
