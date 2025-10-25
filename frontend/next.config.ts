import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Amplify Hostingでの最適化
  output: 'standalone',

  // 環境変数の設定(ビルド時に必要な場合)
  env: {
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2',
  },
};

export default nextConfig;
