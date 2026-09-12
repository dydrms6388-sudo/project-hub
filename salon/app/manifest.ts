import type { MetadataRoute } from "next";

// 친구 폰 "홈 화면에 추가" 시 앱처럼 뜨도록.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "정화 머리방",
    short_name: "정화 머리방",
    description: "정화 머리방 고객 관리",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6f4",
    theme_color: "#b4637a",
    lang: "ko",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
