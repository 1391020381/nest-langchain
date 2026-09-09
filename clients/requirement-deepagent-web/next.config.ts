import type { NextConfig } from "next";

const apiInternalUrl = (
  process.env.REQUIREMENT_DEEPAGENT_API_INTERNAL_URL ??
  "http://localhost:4200"
).replace(/\/$/u, "");

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  transpilePackages: ["@autix/requirement-deepagent-contracts"],
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
