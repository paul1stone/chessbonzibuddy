import type { NextConfig } from "next";

const IMMUTABLE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // The engine lives in a VERSIONED directory (/stockfish/18-lite/) because of this
      // header: a year of immutable means a bumped engine must ship under a new path or
      // returning visitors keep the old one. Next serves public/ with max-age=0 otherwise.
      { source: "/stockfish/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE }] },
      // The 39 MB rootfs is content-addressed (rootfs-flat/<sha>.bin.zst), so a rebuilt image
      // writes new names and can never collide with what a browser already holds.
      //
      // Deliberately NOT the rest of /terminal: fs.json and state.bin.zst keep stable names
      // across regens, and a year-old fs.json points at blobs a new deploy no longer has.
      // They stay on the default revalidating policy — a 304 per open, not 20 MB.
      { source: "/terminal/rootfs-flat/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE }] },
    ];
  },
};

export default nextConfig;
