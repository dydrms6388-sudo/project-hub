// =============================================================================
// E2 · 받은 관심 블러 티저 (F-DIS-07, 무료 티어)
// - 상대를 식별할 수 있는 정보(닉네임·사진·취미)를 아예 렌더하지 않는다.
//   블러는 CSS 효과일 뿐 보호 수단이 아니므로 데이터 자체를 보내지 않는 것이 원칙.
// - 실카운트만 노출한다. count 0 이면 호출부에서 아예 렌더하지 않을 것
//   (0명 배지 금지 — A4 §4-4).
// =============================================================================

export interface BlurredLikersProps {
  count: number;
  /** 썸네일 자리 개수 (기본 3, count 보다 많을 수 없음) */
  slots?: number;
}

export function BlurredLikers({ count, slots = 3 }: BlurredLikersProps) {
  const visible = Math.max(0, Math.min(slots, count));
  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">{`아직 공개되지 않은 프로필 ${visible}개`}</span>
      {Array.from({ length: visible }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="size-12 rounded-full bg-primary-tint blur-sm"
        />
      ))}
      {count > visible && (
        <span className="text-body-sm text-ink-muted">{`+${count - visible}`}</span>
      )}
    </div>
  );
}
