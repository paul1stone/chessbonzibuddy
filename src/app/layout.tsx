import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Chess Bonzi Buddy",
    template: "%s | Chess Bonzi Buddy",
  },
  description:
    "Play chess against Bonzi Buddy, a purple gorilla from 1999 who runs on Stockfish and talks trash. Then import your games and find out where they went wrong.",
  icons: { icon: "/coolmonkey.gif" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
