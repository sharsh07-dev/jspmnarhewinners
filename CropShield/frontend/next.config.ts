import type { NextConfig } from "next";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";


dotenvConfig({ path: resolve(process.cwd(), "..", "..", ".env") });

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
