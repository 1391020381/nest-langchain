import type { NextConfig } from "next";

const deepAgentApiInternalUrl = (
  process.env.DEEPAGENT_API_INTERNAL_URL ?? "http://localhost:4100"
).replace(/\/$/u, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@autix/deepagent-contracts"],
  // 开发机通过局域网/容器地址访问时，允许 Next 的 HMR、字体和开发资源。
  // 生产构建不使用这个开发白名单。
  allowedDevOrigins: (
    process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "172.5.204.37"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${deepAgentApiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
