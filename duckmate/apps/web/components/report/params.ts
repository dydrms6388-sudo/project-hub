/**
 * /report 쿼리 파라미터 파싱 (순수). `?target=<uuid>&match=<uuid>&surface=profile|chat&reason=<code>`
 * surface 생략 시 match 가 있으면 chat, 없으면 profile (18_moderation submitReport 와 동일 규칙).
 */
import { REPORT_REASON_CODES, type Enums } from "@duckmate/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReportParams = {
  targetId: string | null;
  matchId: string | null;
  surface: "profile" | "chat";
  presetReason: Enums["report_reason"] | null;
};

type SP = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : null;
}

export function parseReportParams(sp: SP): ReportParams {
  const target = one(sp.target);
  const match = one(sp.match);
  const surfaceRaw = one(sp.surface);
  const reason = one(sp.reason);
  const matchId = match && UUID.test(match) ? match : null;
  return {
    targetId: target && UUID.test(target) ? target : null,
    matchId,
    surface: surfaceRaw === "chat" || surfaceRaw === "profile" ? surfaceRaw : matchId ? "chat" : "profile",
    presetReason: reason && (REPORT_REASON_CODES as readonly string[]).includes(reason) ? (reason as Enums["report_reason"]) : null,
  };
}

/** 신고 완료 후 이동: 채팅 진입이면 /chat, 프로필이면 /reco (18_moderation 결정 5) */
export function afterReportHref(surface: "profile" | "chat"): string {
  return surface === "chat" ? "/chat" : "/reco";
}
