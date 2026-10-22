import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BETWEEN",
    short_name: "BETWEEN",
    description: "가입 없이 익명으로 시작하는 성인 남성 소개팅·친구찾기",
    start_url: "/explore",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151419",
    theme_color: "#151419",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
