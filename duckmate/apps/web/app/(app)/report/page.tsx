import type { Metadata } from "next";
import Link from "next/link";
import { REPORT_EVIDENCE_MESSAGE_COUNT } from "@duckmate/db";
import { Button, EmptyState } from "@duckmate/ui";
import { getSession, requireProfile } from "@/lib/auth/session";
import { ReportScreen, type ReportContext } from "@/components/report/ReportScreen";
import { parseReportParams } from "@/components/report/params";

export const metadata: Metadata = { title: "신고하기", robots: { index: false, follow: false } };

const PREVIEW_COUNT = 5;

/**
 * 증거 미리보기(getReportContext): 대상 닉네임 + 최근 메시지 5개(마스킹 본문). 실제 첨부는 서버 create_report 가 최근 50개를 스냅샷한다.
 * 조회 실패(RLS·미매칭)는 빈 값으로 흡수 — 신고 자체는 막지 않는다.
 */
async function getReportContext(targetId: string, matchId: string | null): Promise<ReportContext> {
  const { supabase } = await getSession();
  let nickname: string | null = null;
  let recent: ReportContext["recentMessages"] = [];
  try {
    const { data } = await supabase.from("v_profile_public").select("nickname").eq("id", targetId).maybeSingle();
    nickname = data?.nickname ?? null;
  } catch {
    /* 비노출 */
  }
  if (matchId) {
    try {
      const { data } = await supabase.from("v_messages").select("id, display_body, is_mine, created_at, image_path").eq("match_id", matchId).order("created_at", { ascending: false }).limit(PREVIEW_COUNT);
      recent = (data ?? []).reverse().map((m) => ({ id: m.id, text: m.image_path ? "[이미지]" : m.display_body, isMine: m.is_mine, at: m.created_at }));
    } catch {
      /* 채팅 없음 */
    }
  }
  return { nickname, recentMessages: recent, evidenceCount: REPORT_EVIDENCE_MESSAGE_COUNT };
}

/** /report?target=&match=&surface=&reason= — 2단 사유 → 상세 → 증거 안내 → 제출 → 완료(차단 기본 체크) (12_flows §7, 18_moderation 결정 2~5) */
export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireProfile(1);
  const params = parseReportParams(await searchParams);
  if (!params.targetId) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pt-safe">
        <EmptyState
          className="mt-16"
          icon="🚩"
          title="신고할 대상을 찾을 수 없어요"
          description="프로필이나 대화방의 신고 버튼에서 다시 시작해 주세요."
          action={
            <Button asChild variant="outline">
              <Link href="/chat">채팅으로</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const context = await getReportContext(params.targetId, params.matchId);
  return <ReportScreen params={params} context={context} />;
}
