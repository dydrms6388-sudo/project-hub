/**
 * 푸시 템플릿 — 카피 단일 소스 (A3 §7 · C1 §4.4/§4.5 #33 · B1 §0-24).
 *
 * 이 파일은 **의존성 0** 이어야 한다: Deno Edge Function(`supabase/functions/push-send/lib/templates.ts`)이
 * 같은 파일을 그대로 복사해 쓴다(`templates.test.ts` 가 두 파일이 동일한지 검사).
 *
 * 규칙
 *  - 본문에 상대 메시지 원문·전화번호·닉네임 외 개인정보 금지. 가짜·추정 수치 금지(실제 count 만 바인딩).
 *  - 금지 표현(C1 §4.4)·이모지 0개(§4.3 푸시)·"님/회원님" 호칭 금지 → `FORBIDDEN_COPY` 로 vitest lint.
 *  - marketing 은 제목 앞 `(광고)` + 전송자 명칭 + 수신거부 경로("설정 > 알림에서 해제") 강제(정보통신망법 §50④).
 *  - 서비스명 리터럴은 C1 §0-1 에 따라 상수 1곳(`DEFAULT_SERVICE_NAME`)에만. E4/E5 는 `apps/web/config/site.ts` 의
 *    SERVICE_NAME 이 생기면 `renderPush(..., { serviceName })` 로 주입한다.
 */

export type PushKind = "transactional" | "service" | "marketing";
export type PushSlot = "A" | "B" | "instant";

export type PushTemplateKey =
  | "daily_reco_ready"
  | "unseen_match"
  | "unreplied_message"
  | "photo_reviewed"
  | "reco_remaining"
  | "reminder_d3"
  | "reminder_d7"
  | "new_match"
  | "new_message"
  | "suggestion_reply"
  | "report_resolved"
  | "sanction_issued"
  | "sanction_lifted"
  | "appeal_decided"
  | "reconsent_needed"
  | "marketing_event"
  | "marketing_benefit"
  | "admin_alert";

export type PushTemplateMeta = {
  key: PushTemplateKey;
  kind: PushKind;
  slot: PushSlot;
  /** 일 2건 예산 소비 여부 (transactional 은 항상 false) */
  consumesBudget: boolean;
  /** >0 이면 같은 템플릿을 N분 내 뭉침(큐 병합) */
  bundleMinutes: number;
  /** 야간(23:00~07:00 KST) 보류. marketing 은 무관(창 밖 = 폐기) */
  holdAtNight: boolean;
  /** 슬롯 B 우선순위(작을수록 우선). 슬롯 B 가 아니면 null */
  priorityRank: number | null;
  /** 딥링크 경로. `{match_id}` 등은 params 로 치환 */
  deeplink: string;
};

/** SQL push_templates 시드와 1:1 (0050). 바꾸면 마이그레이션도 같이 바꾼다 */
export const PUSH_TEMPLATES: Readonly<Record<PushTemplateKey, PushTemplateMeta>> = {
  daily_reco_ready: { key: "daily_reco_ready", kind: "service", slot: "A", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: null, deeplink: "/reco" },
  unseen_match: { key: "unseen_match", kind: "service", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: 1, deeplink: "/chat" },
  unreplied_message: { key: "unreplied_message", kind: "service", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: 2, deeplink: "/chat" },
  photo_reviewed: { key: "photo_reviewed", kind: "service", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: 3, deeplink: "/me/photos" },
  reco_remaining: { key: "reco_remaining", kind: "service", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: 4, deeplink: "/reco" },
  reminder_d3: { key: "reminder_d3", kind: "service", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: 5, deeplink: "/home" },
  reminder_d7: { key: "reminder_d7", kind: "service", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: true, priorityRank: 5, deeplink: "/home" },
  new_match: { key: "new_match", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 60, holdAtNight: true, priorityRank: null, deeplink: "/match/{match_id}" },
  new_message: { key: "new_message", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 60, holdAtNight: true, priorityRank: null, deeplink: "/chat/{match_id}" },
  suggestion_reply: { key: "suggestion_reply", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 60, holdAtNight: true, priorityRank: null, deeplink: "/chat/{match_id}" },
  report_resolved: { key: "report_resolved", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 0, holdAtNight: true, priorityRank: null, deeplink: "/settings" },
  sanction_issued: { key: "sanction_issued", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 0, holdAtNight: true, priorityRank: null, deeplink: "/suspended" },
  sanction_lifted: { key: "sanction_lifted", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 0, holdAtNight: true, priorityRank: null, deeplink: "/home" },
  appeal_decided: { key: "appeal_decided", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 0, holdAtNight: true, priorityRank: null, deeplink: "/appeal" },
  reconsent_needed: { key: "reconsent_needed", kind: "service", slot: "instant", consumesBudget: false, bundleMinutes: 0, holdAtNight: true, priorityRank: null, deeplink: "/settings/notifications" },
  marketing_event: { key: "marketing_event", kind: "marketing", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: false, priorityRank: null, deeplink: "/home" },
  marketing_benefit: { key: "marketing_benefit", kind: "marketing", slot: "B", consumesBudget: true, bundleMinutes: 0, holdAtNight: false, priorityRank: null, deeplink: "/home" },
  admin_alert: { key: "admin_alert", kind: "transactional", slot: "instant", consumesBudget: false, bundleMinutes: 60, holdAtNight: false, priorityRank: null, deeplink: "/admin/reports" },
};

export const PUSH_TEMPLATE_KEYS = Object.keys(PUSH_TEMPLATES) as PushTemplateKey[];

export function isPushTemplateKey(v: unknown): v is PushTemplateKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PUSH_TEMPLATES, v);
}

/** C1 §0-1: 리터럴은 여기 1곳. site.ts SERVICE_NAME 이 생기면 renderPush opts 로 주입 */
export const DEFAULT_SERVICE_NAME = "덕메이트";
export const MARKETING_PREFIX = "(광고)";
export const MARKETING_OPTOUT = "설정 > 알림에서 해제";

export type PushParams = Record<string, unknown>;

export type RenderedPush = {
  key: PushTemplateKey;
  kind: PushKind;
  slot: PushSlot;
  title: string;
  body: string;
  /** 앱 내 경로(딥링크). 서비스워커가 origin 을 붙인다 */
  url: string;
  /** 같은 tag 는 OS 알림 트레이에서 교체(뭉침 UX) */
  tag: string;
};

export type RenderOptions = { serviceName?: string };

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const str = (v: unknown, max = 40): string => {
  if (typeof v !== "string") return "";
  const s = v.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function fillDeeplink(base: string, params: PushParams): string {
  const out = base.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    return typeof v === "string" && /^[A-Za-z0-9-]+$/.test(v) ? v : "";
  });
  // 치환 실패(빈 세그먼트)면 상위 경로로 폴백
  return out.replace(/\/+$/, "") || "/home";
}

/**
 * 템플릿 렌더. `count` 는 큐 병합 횟수(뭉침) — 1 이면 단건 카피.
 * 어떤 params 가 와도 예외 없이 안전한 문자열을 돌려준다(Edge 에서 throw 금지).
 */
export function renderPush(key: PushTemplateKey, params: PushParams = {}, opts: RenderOptions = {}): RenderedPush {
  const meta = PUSH_TEMPLATES[key];
  const serviceName = opts.serviceName ?? DEFAULT_SERVICE_NAME;
  const count = Math.max(1, num(params.count, 1));
  const n = num(params.n);
  const nickname = str(params.nickname, 10);
  let title = "";
  let body = "";
  let url = fillDeeplink(meta.deeplink, params);

  switch (key) {
    case "daily_reco_ready": {
      const pending = num(params.pending);
      title = n > 0 ? `새 추천 ${n}명 도착` : "새 추천 도착";
      body = pending > 0 ? `결과 기다리는 중 ${pending}건` : "취미가 겹치는 순서예요. 내일 07:00에 또 와요.";
      break;
    }
    case "unseen_match":
      title = "확인하지 않은 매칭이 있어요";
      body = n > 1 ? `매칭 ${n}건이 첫 대화를 기다려요.` : "첫 대화 카드가 준비돼 있어요.";
      break;
    case "unreplied_message":
      title = "답장을 기다리는 대화가 있어요";
      body = n > 1 ? `대화 ${n}개에 새 메시지가 있어요.` : "새 메시지가 있어요.";
      break;
    case "photo_reviewed": {
      const approved = params.status === "approved" || params.approved === true;
      title = "사진을 확인했어요";
      body = approved ? "대표 사진으로 쓸 수 있어요." : "이 사진은 대표 사진으로 쓸 수 없어요. 다시 올려 주세요.";
      break;
    }
    case "reco_remaining":
      title = n > 0 ? `오늘 추천 ${n}명이 남아 있어요` : "오늘 추천이 남아 있어요";
      body = "내일 07:00에 새 추천으로 바뀌어요.";
      break;
    case "reminder_d3":
      title = "새 추천이 매일 07:00에 와요";
      body = n > 0 ? `오늘 추천 ${n}명이 준비돼 있어요.` : "오늘의 추천이 준비돼 있어요.";
      break;
    case "reminder_d7":
      title = "새 추천이 기다리고 있어요";
      body = n > 0 ? `오늘 추천 ${n}명이 준비돼 있어요. 내일 07:00에 또 와요.` : "내일 07:00에 새 추천이 와요.";
      break;
    case "new_match":
      if (count > 1) {
        title = `새 매칭 ${count}건`;
        body = "서로 좋아요예요. 첫 대화 카드가 준비돼 있어요.";
        url = "/chat";
      } else {
        title = "매칭됐어요";
        body = nickname ? `${nickname} · 서로 좋아요예요. 첫 대화 카드가 준비돼 있어요.` : "서로 좋아요예요. 첫 대화 카드가 준비돼 있어요.";
      }
      break;
    case "new_message":
      if (count > 1) {
        title = `새 메시지 ${count}개`;
        body = "답장이 왔어요.";
        url = "/chat";
      } else {
        title = "새 메시지";
        body = nickname ? `${nickname}에게서 답장이 왔어요.` : "답장이 왔어요.";
      }
      break;
    case "suggestion_reply":
      title = "첫 대화가 시작됐어요";
      body = nickname ? `${nickname}: 제안 카드로 대화를 시작했어요.` : "제안 카드로 대화가 시작됐어요.";
      if (count > 1) url = "/chat";
      break;
    case "report_resolved":
      title = "신고 처리가 완료됐어요";
      body = "조치가 완료되었어요. 알려 주셔서 고마워요.";
      break;
    case "sanction_issued": {
      const level = num(params.level);
      const duration = str(params.duration_label, 20);
      const category = str(params.reason_category ?? params.reason_label, 20);
      title = "계정 이용이 제한됐어요";
      const parts: string[] = [];
      if (category) parts.push(`${category} 사유예요.`);
      parts.push(duration ? `${duration} 동안 제한돼요.` : "자세한 내용은 앱에서 확인해 주세요.");
      if (level >= 3) parts.push("이의신청은 7일 안에 할 수 있어요.");
      body = parts.join(" ");
      url = level >= 3 ? "/suspended" : "/home";
      break;
    }
    case "sanction_lifted":
      title = "이용 제한이 해제됐어요";
      body = "다시 이용할 수 있어요.";
      break;
    case "appeal_decided":
      title = "이의신청 결과가 나왔어요";
      body = "결과를 확인해 주세요.";
      break;
    case "reconsent_needed": {
      const agreedOn = str(params.agreed_on, 10);
      title = "혜택·이벤트 알림 수신 확인";
      body = `${serviceName}에서 보내요. ${agreedOn ? `${agreedOn}에 ` : ""}동의한 수신 설정을 2년마다 확인해요. ${MARKETING_OPTOUT}할 수 있어요.`;
      break;
    }
    case "marketing_event":
    case "marketing_benefit": {
      const t = str(params.title, 30) || (key === "marketing_event" ? "이벤트 안내" : "혜택 안내");
      const b = str(params.body, 60);
      title = `${MARKETING_PREFIX} ${t}`;
      body = `${b ? `${b} ` : ""}${serviceName} · ${MARKETING_OPTOUT}`;
      const custom = typeof params.url === "string" && /^\/[A-Za-z0-9/_-]*$/.test(params.url) ? params.url : null;
      url = custom ?? url;
      break;
    }
    case "admin_alert": {
      const kind = str(params.kind, 30) || "alert";
      title = `[운영] ${kind}`;
      body = str(params.summary, 80) || (count > 1 ? `새 운영 알림 ${count}건` : "새 운영 알림이 있어요.");
      break;
    }
  }

  return { key, kind: meta.kind, slot: meta.slot, title, body, url, tag: `dm-${key}` };
}

/**
 * 금지 표현 사전 (C1 §4.4 + 푸시 특칙). 부분 문자열 매칭. 테스트가 모든 템플릿 렌더 결과를 검사한다.
 */
export const FORBIDDEN_COPY: ReadonlyArray<string> = [
  // 희소성·긴급
  "지금 안 하면", "마지막 기회", "곧 사라져요", "서두르세요", "놓치지 마세요", "카운트다운",
  // 죄책감·자책
  "아직도 안 했어요", "기록이 사라져요", "매칭이 안 되는 이유", "프로필 때문에", "노력이 부족",
  // 가짜 신호
  "누군가 당신을 좋아해요", "인기 급상승", "보는 중", "매칭률",
  // 외모·평가
  "매력 점수", "인기 회원", "상위 ", "잘생긴", "예쁜", "비주얼", "얼평", "등급",
  // 성별 고정관념
  "남자답게", "여자답게", "여성분", "남성분", "남자라면", "이상형 스펙",
  // 만남 압박
  "아직 안 만났어요", "만나야 진짜", "언제 만나요", "오프라인이 답",
  // 탈락·심사
  "탈락", "불합격", "심사 통과", "거절됨", "승인 거부",
  // 결제 압박
  "프리미엄 회원만", "무료는 여기까지", "지금 결제하면", "해지하면 손해",
  // 위치
  "근처", "500m", "지금 여기",
  // 호칭
  "회원님", "고객님", "님과", "님이", "님에게", "님의", "이성",
  // 결혼중개업법 회피(B1 §0-3)
  "결혼", "배우자", "혼인",
];

/** 이모지·기호 (C1 §4.3: 푸시 0개) */
export const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

export function lintCopy(text: string): string[] {
  const hits: string[] = [];
  for (const w of FORBIDDEN_COPY) if (text.includes(w)) hits.push(w);
  if (EMOJI_RE.test(text)) hits.push("<emoji>");
  return hits;
}

/** 큐 params → 알림 payload (서비스워커 sw.js 가 읽는 형태) */
export type PushPayload = {
  v: 1;
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: PushKind;
  slot: PushSlot;
  template: PushTemplateKey;
  /** push_queue.id — notificationclick 시 /api/push/opened 로 보고 */
  qid: number | null;
  icon?: string;
  badge?: string;
};

export function buildPayload(rendered: RenderedPush, queueId: number | null): PushPayload {
  return {
    v: 1,
    title: rendered.title,
    body: rendered.body,
    url: rendered.url,
    tag: rendered.tag,
    kind: rendered.kind,
    slot: rendered.slot,
    template: rendered.key,
    qid: queueId,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  };
}
