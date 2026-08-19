// =============================================================================
// E3 · 채팅 화면 공용 포맷 헬퍼 (서버/클라 공용 — "use client" 아님)
// 카피 규칙: 재촉·죄책감 금지(C1 D-6). 시간 표기는 사실만, 경고성 표현 금지.
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/** 7일 무응답 방 판정 (12_flows §4.1 — 조용히 하단 정렬, 재촉 카피 금지) */
export const STALE_AFTER_MS = 7 * DAY_MS;

/** 목록용 상대 시간: "방금", "3시간 전", "어제", "3월 4일" */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);

  if (diff < 60_000) return "방금";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < DAY_MS) return `${Math.floor(diff / (60 * 60_000))}시간 전`;
  if (diff < 2 * DAY_MS) return "어제";
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}일 전`;

  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 말풍선 옆 시각: "오후 3:07" */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${m}`;
}

/** 날짜 구분선: "2026년 8월 19일" */
export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/** 목록 미리보기 — 이미지 전용 메시지는 본문이 비어 있다 */
export function previewText(body: string, imagePath: string | null): string {
  const trimmed = body.trim();
  if (trimmed.length > 0) return trimmed;
  return imagePath ? "사진을 보냈어요" : "";
}
