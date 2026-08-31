import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="28 August 2026">
      <p>
        Chess Bonzi Buddy is a hobby project. This page describes what the site stores and why. There are no accounts and no passwords.
      </p>

      <h2>What stays in your browser</h2>
      <p>
        When you link a Chess.com or Lichess account, the site keeps the username you typed and your cached ratings in your browser&apos;s local storage under the key <code>chess-analyzer-profile</code>. Nothing else identifies you. You can remove it at any time by clearing this site&apos;s data in your browser.
      </p>

      <h2>What is stored on the server</h2>
      <p>
        When you import a game, the site stores that game in a Postgres database hosted by Neon in the United States: the source URL, the PGN, both player names, the result, the date played, and the Stockfish analysis with per-side accuracy scores once it runs. Imported games are not private: anyone using the site can view them. You can delete any game from the sidebar. Deletion is immediate and permanent.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li>Chess.com and Lichess public APIs are called with the username you enter to fetch ratings and recent games.</li>
        <li>Vercel hosts the site and keeps standard request logs, which can include your IP address, for a limited time.</li>
        <li>Stockfish runs inside your browser, for both analysis and play mode. No game data is sent anywhere else.</li>
      </ul>
      <p>The site sets no cookies, runs no analytics scripts, and shows no ads.</p>

      <h2>Requests</h2>
      <p>
        To ask for data to be removed or to report a problem, open an issue at{" "}
        <a href="https://github.com/paul1stone/chessbonzibuddy/issues" rel="noreferrer">
          github.com/paul1stone/chessbonzibuddy/issues
        </a>
        .
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the bottom of this window changes with it.</p>
    </LegalPage>
  );
}
