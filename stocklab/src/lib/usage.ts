import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getDataSource } from "@/lib/data";
import { kstDateString } from "@/lib/kst";
import type { UsageResult } from "@/lib/types";

export const ANON_DAILY_LIMIT = 5;
export const UID_COOKIE = "sl_uid"; // middleware.ts 에서 발급

/** ip + 쿠키 uid 해시 → 비로그인 사용자 식별 키 (원문 저장 안 함) */
export async function anonKey(): Promise<string> {
  const h = await headers();
  const c = await cookies();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "0.0.0.0").split(",")[0]?.trim() ?? "0.0.0.0";
  // 이 요청에서 방금 발급된 uid(쿠키 미지참)는 신뢰하지 않고 IP 단독으로 집계 → 쿠키 폐기 우회 차단
  const fresh = h.get("x-sl-anon-fresh") === "1";
  const uid = fresh ? "no-cookie" : (c.get(UID_COOKIE)?.value ?? "no-cookie");
  return createHash("sha256").update(`${ip}|${uid}|${process.env.USAGE_SALT ?? "stocklab"}`).digest("hex").slice(0, 32);
}

/** 스크리너 실행 1회를 소비. 제한 초과 시 allowed=false */
export async function consumeScreenerUsage(feature: "value" | "dividend"): Promise<UsageResult> {
  const key = await anonKey();
  return getDataSource().consumeUsage(key, `screener:${feature}`, ANON_DAILY_LIMIT, kstDateString());
}
