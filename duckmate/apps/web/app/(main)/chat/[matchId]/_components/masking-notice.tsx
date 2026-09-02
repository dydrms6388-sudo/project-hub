// =============================================================================
// E3 · 마스킹 안내 바 (12_flows §4.2 · D4 §6.4-2)
//
// ⚠ 이 컴포넌트가 받는 contactUnlocked 는 **표시용 값일 뿐**이다.
//   해제 판정(matched_at + 72h && 양측 verify_level ≥ 2)은 서버(send-message Edge
//   Function)가 단독으로 수행하며(D4-7), 클라이언트가 이 값을 true 로 바꿔도
//   마스킹은 풀리지 않는다 — masked_body 는 이미 마스킹된 결과라 화면이 되돌릴 수
//   없기 때문이다. 여기서 하는 일은 문구 분기뿐이다.
// =============================================================================

export function MaskingNotice({ contactUnlocked }: { contactUnlocked: boolean }) {
  return (
    <p
      data-testid="chat-masking-notice"
      data-unlocked={contactUnlocked ? "true" : "false"}
      className={
        contactUnlocked
          ? "rounded-2xl bg-success-tint px-4 py-3 text-body-sm text-success"
          : "rounded-2xl bg-primary-tint px-4 py-3 text-body-sm text-primary-tint-fg"
      }
    >
      {contactUnlocked
        ? "연락처·메신저 아이디를 주고받을 수 있어요. 이메일·링크·계좌번호는 계속 가려져요."
        : "연락처·링크는 매칭 3일 후 양측 인증이 끝나면 열려요. 그때까지는 자동으로 가려져요."}
    </p>
  );
}
