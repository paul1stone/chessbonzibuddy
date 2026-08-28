import type { ReactNode } from "react";
import { RetroButton, RetroWindow } from "@/components/retro";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-[min(92vw,760px)] py-10">
      <RetroWindow title={`${title} - Chess Bonzi Buddy`} statusBar={`Last updated ${updated}`} aria-labelledby="legal-heading">
        <article className="r-body r-paper r-bevel-in p-5 [&_h1]:mb-4 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[16px] [&_h2]:font-bold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
          <h1 id="legal-heading">{title}</h1>
          {children}
        </article>
        <div className="mt-4 flex justify-end">
          <RetroButton href="/">Back to desktop</RetroButton>
        </div>
      </RetroWindow>
    </main>
  );
}
