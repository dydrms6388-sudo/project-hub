import { ogCard, OG_SIZE } from "@/lib/og";

export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "PhotoLab — 사진 촬영 계산 레퍼런스";

export default async function OgImage() {
  return ogCard({
    badge: "계산기 18종 · 해설 27편",
    title: "감이 아니라 계산으로 찍는다",
    subtitle:
      "심도 · 과초점거리 · NPF · 골든아워 · 등가 노출 — 공식과 출처를 밝힌 촬영 계산 도구",
  });
}
