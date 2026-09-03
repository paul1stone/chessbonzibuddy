import type { NextConfig } from "next";

const IMMUTABLE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Stockfish is 113 MB and the gate makes the user agree to it once. Next serves
      // public/ with max-age=0, so without this every reload re-validates and any cache
      // eviction charges them the download again.
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
