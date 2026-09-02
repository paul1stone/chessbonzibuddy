import type { Metadata } from "next";
import "./globals.css";

// Absolute base for og:image/og:url — crawlers reject relative ones, so this must be a real origin.
const SITE_URL = "https://chessbonzibuddy.vercel.app";

const DESCRIPTION =
  "Play chess against Bonzi Buddy, a purple gorilla from 1999 who runs on Stockfish and talks trash. Then import your games and find out where they went wrong.";

const OG_ALT =
  "A Windows 98 window on a teal desktop reading “Play chess against a purple gorilla from 1999”, with Bonzi Buddy waving beside it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Chess Bonzi Buddy",
    template: "%s | Chess Bonzi Buddy",
  },
  description: DESCRIPTION,
  applicationName: "Chess Bonzi Buddy",
  icons: {
    icon: [{ url: "/favicon-32.png", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "Chess Bonzi Buddy",
    title: "Chess Bonzi Buddy",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chess Bonzi Buddy",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
