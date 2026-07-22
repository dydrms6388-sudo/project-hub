/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @ggu/ugc-core is consumed as built ESM from its dist/. The predev/prebuild
  // scripts build it first, so no transpilePackages entry is required.
};

export default nextConfig;
