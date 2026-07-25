import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? "/swift-ghost" : undefined,
  assetPrefix: isGitHubPages ? "/swift-ghost/" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
