// =============================================================================
// D7 · 푸시 카피 템플릿 — C1 브랜드 톤(10_brand §4) + A3 §3.2 카피 원칙 준수
//
// 하드 룰 (실험 대상 제외 — 고정 제약):
//   · 죄책감·조바심·손실공포 카피 금지 ("끊겨요", "사라져요", "기다리다 지쳤어요")
//   · 팩트만 / 유저가 얻는 것 중심 / "~해보세요"(초대형) OK, "~해야 해요" 금지
//   · 제목 이모지 0개, 본문 최대 1개 (여기서는 전부 0개로 고정)
//   · 해요체 고정
//   · 광고성(is_marketing=true)은 제목에 "(광고)" 접두 + 수신거부 딥링크 동반
//     (정보통신망법 §50 — B1 L6). 접두는 buildPayload 가 자동으로 붙인다.
//   · 미응답 상대를 대신한 재촉 금지 — new_message 는 "상대가 보냈다" 팩트만.
// =============================================================================

export type PushKind =
  | "daily_card"
  | "match_created"
  | "new_message"
  | "like_received"
  | "match_no_chat_24h"
  | "reminder_d3"
  | "reminder_d7";

export type PushSlot = "daily" | "event" | "reminder";

export interface CopyParams {
  /** 상대 닉네임 (매칭/메시지 계열) */
  nickname?: string;
  /** 딥링크 대상 매칭 id */
  matchId?: string;
  /** 오늘 추천 수 (슬롯1) */
  recoCount?: number;
}

interface CopySpec {
  slot: PushSlot;
  isMarketing: boolean;
  title: (p: CopyParams) => string;
  body: (p: CopyParams) => string;
  deeplink: (p: CopyParams) => string;
}

export const COPY: Record<PushKind, CopySpec> = {
  // 슬롯1 — 데일리 앵커 (Phase 1 카피. Phase 2 전환 시 "궁합 카드 도착" 으로 교체 — A3 부록 3)
  daily_card: {
    slot: "daily",
    isMarketing: true,
    title: (p) => `오늘의 추천 ${p.recoCount ?? 5}명이 도착했어요`,
    body: () => "취향이 겹치는 분들을 준비해뒀어요. 편할 때 확인해보세요.",
    deeplink: () => "/home",
  },

  // 슬롯2 ① — 매칭 성사 (기능성)
  match_created: {
    slot: "event",
    isMarketing: false,
    title: () => "매칭이 성사됐어요",
    body: (p) =>
      p.nickname
        ? `${p.nickname}님과 취향이 통했어요. 첫 대화 제안 카드를 준비해뒀어요.`
        : "취향이 통하는 분과 매칭됐어요. 첫 대화 제안 카드를 준비해뒀어요.",
    deeplink: (p) => (p.matchId ? `/chat/${p.matchId}` : "/matches"),
  },

  // 슬롯2 ② — 새 메시지 (기능성 · 상대 답장 시에만, 방별 하루 1회 집계는 발화자 D4 몫)
  new_message: {
    slot: "event",
    isMarketing: false,
    title: () => "새 메시지가 도착했어요",
    body: (p) => (p.nickname ? `${p.nickname}님이 메시지를 보냈어요.` : "메시지가 도착해 있어요."),
    deeplink: (p) => (p.matchId ? `/chat/${p.matchId}` : "/chat"),
  },

  // 슬롯2 ③ — 좋아요 수신 (기능성 · 블러, 가짜/부풀림 금지 — 실수신 1건 팩트만)
  like_received: {
    slot: "event",
    isMarketing: false,
    title: () => "새 관심이 도착했어요",
    body: () => "누군가 회원님의 덕질카드에 좋아요를 보냈어요.",
    deeplink: () => "/likes",
  },

  // 슬롯2 ④ — 매칭 후 24h 무대화 제안 카드 리마인드 (기능성 · 죄책감 카피 금지)
  match_no_chat_24h: {
    slot: "event",
    isMarketing: false,
    title: () => "첫 대화 제안 카드가 열려 있어요",
    body: (p) =>
      p.nickname
        ? `${p.nickname}님과의 공통 취미 이야기를 시작해보세요.`
        : "공통 취미로 시작하는 첫 대화 제안이 준비돼 있어요.",
    deeplink: (p) => (p.matchId ? `/chat/${p.matchId}` : "/matches"),
  },

  // 미접속 리마인더 — 팩트형만 (광고성 분류 · 스트릭/죄책감 언급 금지)
  reminder_d3: {
    slot: "reminder",
    isMarketing: true,
    title: () => "새 추천이 쌓여 있어요",
    body: () => "며칠 사이 도착한 추천이 기다리고 있어요. 편할 때 확인해보세요.",
    deeplink: () => "/home",
  },
  reminder_d7: {
    slot: "reminder",
    isMarketing: true,
    title: () => "이번 주 추천이 모여 있어요",
    body: () => "일주일 동안의 새 추천이 도착해 있어요. 편할 때 확인해보세요.",
    deeplink: () => "/home",
  },
};

/** 광고성 수신거부 경로 (설정 > 알림 — E4 화면) */
export const UNSUBSCRIBE_PATH = "/settings/notifications";

/**
 * 푸시 페이로드 스키마 v1 — sw.js 가 이 형태를 파싱한다.
 * {
 *   v: 1,
 *   kind, slot,
 *   title, body,             // 광고성은 title 에 "(광고) " 접두 포함
 *   deeplink,                // 경로 기반 상대 라우트 (B3 §5.1 — 해시/쿼리 전환 금지)
 *   tag,                     // 알림 병합 키 (같은 슬롯은 갱신)
 *   unsubscribePath?         // 광고성만 — 수신거부 딥링크
 * }
 */
export interface PushPayloadV1 {
  v: 1;
  kind: PushKind;
  slot: PushSlot;
  title: string;
  body: string;
  deeplink: string;
  tag: string;
  unsubscribePath?: string;
}

export function buildPayload(kind: PushKind, params: CopyParams = {}): PushPayloadV1 {
  const spec = COPY[kind];
  const title = spec.isMarketing ? `(광고) ${spec.title(params)}` : spec.title(params);
  return {
    v: 1,
    kind,
    slot: spec.slot,
    title,
    body: spec.body(params),
    deeplink: spec.deeplink(params),
    tag: `duckmate-${spec.slot}`,
    ...(spec.isMarketing ? { unsubscribePath: UNSUBSCRIBE_PATH } : {}),
  };
}
