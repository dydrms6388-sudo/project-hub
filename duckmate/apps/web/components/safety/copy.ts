/**
 * 안전 가이드 카피 단일 소스 — 05_trust_safety §10 확정본. (지시어 없음: 서버 페이지 `/safety-guide` 와 클라이언트 모달·배너가 같이 import)
 *  §10.1 첫 매칭 모달(SafetyGuideModal) · §10.2 오프라인 만남 배너(ChatBanners.OfflineMeetingBanner) · 정적 페이지 `/safety-guide`(H2).
 */
export const SAFETY_GUIDE = {
  title: "매칭을 축하해요! 대화 전에 3가지만 기억해 주세요.",
  items: [
    "연락처는 매칭 3일 후부터 주고받을 수 있어요. 그 전엔 여기서 충분히 대화해 보세요.",
    "돈 이야기(송금, 투자, 상품권)가 나오면 그건 대화가 아니라 신호예요. 바로 신고해 주세요.",
    "불편하면 언제든 차단할 수 있어요. 상대에게 알림이 가지 않아요.",
  ],
  footer: "신고는 24시간 안에 확인해요.",
  confirm: "확인했어요",
} as const;

/** §10.2 오프라인 만남 제안 감지 시 (채팅 인라인 배너, 매칭당 1회) */
export const OFFLINE_MEETING_GUIDE = {
  title: "처음 만나는 날, 이렇게 해요.",
  items: [
    "사람 많은 공개 장소에서, 낮이나 이른 저녁에 만나요.",
    "친구에게 누구를 어디서 만나는지 알려 두세요.",
    "이동은 각자, 첫 만남에 술은 가볍게.",
    "뭔가 이상하면 그냥 나와도 괜찮아요. 이유를 설명할 필요 없어요.",
  ],
  more: "만남 안전 가이드 전체 보기",
  href: "/safety-guide",
} as const;
