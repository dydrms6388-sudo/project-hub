import { getDataSource } from "@/lib/data";

/** Supabase 미연결(샘플 모드)일 때만 노출 — 실제 시세가 아님을 명시 */
export function SampleBanner() {
  if (getDataSource().mode !== "sample") return null;
  return (
    <div role="status" className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">
      <strong>샘플 데이터 모드</strong> — 표시되는 수치는 UI 확인용 합성 데이터이며 실제 재무·시세가 아닙니다. 데이터 파이프라인 연결 후 실데이터로 대체됩니다.
    </div>
  );
}
