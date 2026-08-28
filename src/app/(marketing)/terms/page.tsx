import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="28 August 2026">
      <p>By using Chess Bonzi Buddy you agree to the following. They are short because the site is small.</p>

      <h2>What the site is</h2>
      <p>
        A free hobby project for playing chess against an engine with a talking mascot, and for analyzing your own games. It is provided as is, with no guarantee of availability or accuracy.
      </p>

      <h2>Analysis is approximate</h2>
      <p>
        Move classifications, accuracy scores, and estimated ratings come from Stockfish at limited depth plus formulas that are still being refined. They will not always match Chess.com or Lichess. Use them as a guide, not a verdict.
      </p>

      <h2>Your games</h2>
      <ul>
        <li>Only import games you have the right to share. Imported games are visible to anyone who enters the same username.</li>
        <li>Do not use the site to abuse the Chess.com or Lichess APIs, or to get around their terms.</li>
        <li>Do not try to break the site or access data that is not yours.</li>
      </ul>

      <h2>Bonzi</h2>
      <p>
        Bonzi Buddy&apos;s commentary is scripted humor. It is not advice, and he is not affiliated with Bonzi Software, Chess.com, or Lichess.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, the site&apos;s author is not liable for any loss arising from use of the site, including lost games, lost data, or a bruised ego.
      </p>

      <h2>Changes</h2>
      <p>These terms may change. The date at the bottom of this window shows the current version.</p>
    </LegalPage>
  );
}
