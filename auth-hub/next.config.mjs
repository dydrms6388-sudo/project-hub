/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 토스/Stripe 웹훅은 raw body 가 필요하므로 해당 라우트에서 직접 req.text() 사용.
  // App Router 에서는 route handler 별로 body 파싱을 직접 제어한다.
};

export default nextConfig;
