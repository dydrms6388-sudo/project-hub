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
  const uid = c.get(UID_COOKIE)?.value ?? "no-cookie";
  return createHash("sha256").update(`${ip}|${uid}|${process.env.USAGE_SALT ?? "stocklab"}`).digest("hex").slice(0, 32);
}

/** 스크리너 실행 1회를 소비. 제한 초과 시 allowed=false */
export async function consumeScreenerUsage(feature: "value" | "dividend"): Promise<UsageResult> {
  const key = await anonKey();
  return getDataSource().consumeUsage(key, `screener:${feature}`, ANON_DAILY_LIMIT, kstDateString());
}
