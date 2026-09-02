/**
 * E4 카피 상수 (10_brand §4.5 확정본 · 07_legal · 09_store_policy). 해요체, 이모지 0. 서비스명 리터럴 금지.
 * 의존성 없음(서버·클라이언트 공용).
 */

/** 탈퇴 후 보존 항목 (A5 §11.1 · 07_legal §5 · 18_moderation §5). 계정 삭제 화면·/account/delete 공용 */
export const RETENTION_ITEMS: ReadonlyArray<{ label: string; period: string }> = [
  { label: "신고·제재 기록 (신고자 정보 제외, 가명 처리)", period: "정책 보존기간" },
  { label: "본인인증 결과 해시 (재가입 차단용)", period: "1년" },
  { label: "결제·환불 내역", period: "5년" },
  { label: "약관·마케팅 동의 이력 (가명 처리)", period: "5년" },
  { label: "감사 로그", period: "2년" },
];

export const DELETE_COPY = {
  title: "정말 탈퇴할까요?",
  body: "7일 안에 다시 로그인하면 취소돼요. 그 뒤엔 매칭·대화가 모두 삭제돼요.",
  graceNotice: "탈퇴를 요청하면 바로 로그아웃되고, 7일 뒤에 완전히 삭제돼요. 유예 기간 중 다시 로그인하면 취소돼요.",
  ack: "삭제 후 보관되는 항목과 7일 유예를 확인했어요",
  confirm: "탈퇴하기",
  cancel: "취소",
} as const;

export const PAUSE_COPY = {
  title: "계정을 잠시 쉴까요?",
  body: "추천·노출·알림이 멈추고 매칭은 그대로 보관돼요. 다시 로그인하면 바로 해제돼요.",
  confirm: "휴면하기",
} as const;

export const RESTORE_COPY = {
  title: "탈퇴 처리 중이에요",
  body: (dday: string) => `${dday}에 완전히 삭제돼요. 지금 취소하면 모든 것이 그대로 돌아와요.`,
  cancel: "탈퇴 취소",
  logout: "그대로 로그아웃",
} as const;

export const MODE_COPY = {
  friend: { label: "취미 친구", description: "같은 취미의 친구를 찾아요. 본인인증(L2)부터 이용할 수 있어요." },
  dating: { label: "데이팅", description: "본인인증 + 승인된 대표 사진 1장(L3)이 필요해요." },
  needL3: "본인인증 + 승인된 대표 사진 1장이 필요해요",
  previewTitle: "공개 범위 미리보기",
  previewRequired: "미리보기를 끝까지 확인해야 전환할 수 있어요",
  previewShown: ["닉네임·연령대·구", "취미 Top3·몰입도·최애·요즘 빠진 것", "승인된 사진"],
  previewHidden: ["전화번호·생년월일", "동 단위 주소", "실명·본인인증 정보"],
  keepFriend: "전환해도 친구 모드 매칭·채팅은 그대로 유지돼요. 교차 추천은 없어요.",
  toFriendNotice: "친구 모드로 돌아가면 사진은 매칭된 상대에게만 보여요.",
  seekingLabel: "찾고 싶은 성별",
  seeking: { female: "여성", male: "남성", any: "모두" },
  submit: (to: "friend" | "dating") => (to === "dating" ? "데이팅 모드로 전환하기" : "취미 친구 모드로 전환하기"),
  done: "모드를 바꿨어요",
} as const;

export const PHOTO_COPY = {
  pending: "대기 중 · 24시간 안에 확인해요",
  approved: "승인",
  held: "보류 · 확인 중이에요",
  rejectedPrefix: "반려",
  primary: "대표",
  setPrimary: "대표로 지정",
  onlyApprovedPrimary: "승인된 사진만 대표로 지정할 수 있어요",
  deleteLastApproved: "삭제하면 사진인증(L3)이 해제되고 데이팅 모드가 꺼져요",
  add: "사진 추가",
  max: "사진은 최대 6장까지 올릴 수 있어요",
  empty: "아직 사진이 없어요. 얼굴이 보이는 본인 사진 1장이면 사진인증(L3)을 받을 수 있어요.",
} as const;

export const NOTIFY_COPY = {
  unsupported: "이 브라우저는 푸시 알림을 지원하지 않아요. 인앱 배너로만 알려드려요.",
  denied: "알림 권한이 꺼져 있어요. 브라우저 설정에서 허용하면 다시 받을 수 있어요. 그동안은 인앱 배너로만 알려드려요.",
  noVapid: "푸시 알림은 준비 중이에요. 인앱 배너로만 알려드려요.",
  enable: "알림 켜기",
  enableHint: "하루 최대 2번, 밤에는 보내지 않아요",
  quietSystem: "23:00~07:00에는 알림을 보내지 않아요 (끌 수 없어요)",
  marketingConsent: "이벤트·혜택 알림을 받는 데 동의해요. 제목에 (광고)가 붙고, 08:00~21:00에만 보내요. 언제든 여기서 해제할 수 있어요.",
  marketingRecheck: "수신 동의는 2년마다 확인해요",
} as const;

export const SUBSCRIPTION_COPY = {
  preparing: "구독은 준비 중이에요",
  preparingBody: "지금은 무료로 모든 핵심 기능을 쓸 수 있어요. 유료 혜택이 열리면 여기서 안내할게요. 결제는 없어요.",
  priceTbd: "준비 중",
  free: "무료",
  plus: "플러스",
  pro: "프로",
} as const;

export const DATA_COPY = {
  title: "내 데이터",
  downloadTitle: "내 데이터 다운로드",
  downloadBody: "아래 항목을 JSON 파일로 바로 내려받아요. 상대의 메시지·사진, 추천 점수 내부값, 다른 사람이 낸 신고는 포함되지 않아요.",
  download: "JSON으로 다운로드",
  items: [
    "프로필 (닉네임·생년·성별·지역·소개)",
    "취미·최애·퀴즈 응답·활동 시간대",
    "사진 목록 (검수 상태)",
    "내가 보낸 좋아요",
    "매칭 목록 (상대는 닉네임만)",
    "내가 보낸 메시지 원문",
    "내가 제출한 신고 (결과 포함, 상대 정보 제외)",
    "내게 내려진 제재",
    "결제·구독 내역",
    "이벤트 참가·게임 기록",
    "약관·마케팅 동의 이력",
  ],
  rights: "열람·정정·삭제·처리정지·전송 요구는 이 화면에서 직접 하거나, 사업자 정보의 개인정보보호책임자에게 요청할 수 있어요(10일 이내 처리).",
} as const;
