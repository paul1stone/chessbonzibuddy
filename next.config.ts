import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/games/\\[id\\]/analyze": ["./.stockfish/**/*"],
  },
};

export default nextConfig;
