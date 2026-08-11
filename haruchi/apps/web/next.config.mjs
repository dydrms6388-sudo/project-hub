/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // packages/* 는 빌드 산출물 없이 소스를 그대로 쓴다. Next 가 트랜스파일한다.
  transpilePackages: ['@haruchi/categorizer', '@haruchi/parser', '@haruchi/schema'],
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
  // packages/* 는 ESM 규약대로 상대 import 에 .js 확장자를 쓴다.
  // 소스(.ts)를 그대로 트랜스파일하므로 번들러에게 매핑을 알려줘야 한다.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
