import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildPayload,
  FORBIDDEN_COPY,
  lintCopy,
  MARKETING_OPTOUT,
  MARKETING_PREFIX,
  PUSH_TEMPLATE_KEYS,
  PUSH_TEMPLATES,
  renderPush,
  type PushParams,
  type PushTemplateKey,
} from "./templates";

/** 템플릿별 대표 params (단건·뭉침·빈 값) */
const SAMPLES: Record<PushTemplateKey, PushParams[]> = {
  daily_reco_ready: [{ n: 5, pending: 2 }, { n: 5, pending: 0 }, {}],
  unseen_match: [{ n: 1 }, { n: 3 }],
  unreplied_message: [{ n: 1 }, { n: 2 }],
  photo_reviewed: [{ status: "approved" }, { status: "rejected" }, {}],
  reco_remaining: [{ n: 3 }, {}],
  reminder_d3: [{ n: 5 }, { n: 0 }],
  reminder_d7: [{ n: 5 }, {}],
  new_match: [{ nickname: "서윤", match_id: "11111111-1111-4111-8111-111111111111" }, { count: 3 }, {}],
  new_message: [{ nickname: "민재", match_id: "11111111-1111-4111-8111-111111111111" }, { count: 4 }, {}],
  suggestion_reply: [{ nickname: "도현", match_id: "11111111-1111-4111-8111-111111111111" }, { count: 2 }],
  report_resolved: [{}],
  sanction_issued: [{ level: 2, reason_category: "부적절한 대화", duration_label: "24시간" }, { level: 5 }, {}],
  sanction_lifted: [{}],
  appeal_decided: [{}],
  reconsent_needed: [{ agreed_on: "2024-09-02", due_on: "2026-09-02" }, {}],
  marketing_event: [{ title: "취미 이벤트 오픈", body: "이번 주 보드게임 모임을 열어요.", url: "/home" }, {}],
  marketing_benefit: [{ title: "슈퍼라이크 추가 지급", body: "이번 주 슈퍼라이크가 1개 더 들어와요." }, {}],
  admin_alert: [{ kind: "sla_overdue", summary: "P0 신고 1건 SLA 초과" }, { count: 3 }, {}],
};

describe("템플릿 카피 lint (C1 §4.4·§4.3)", () => {
  for (const key of PUSH_TEMPLATE_KEYS) {
    it(`${key}: 금지 표현·이모지 없음, 해요체, 길이 제한`, () => {
      for (const params of SAMPLES[key]) {
        const r = renderPush(key, params);
        const hits = lintCopy(`${r.title}\n${r.body}`);
        expect(hits, `${key} ${JSON.stringify(params)} → ${hits.join(",")}`).toEqual([]);
        expect(r.title.length).toBeGreaterThan(0);
        expect(r.title.length).toBeLessThanOrEqual(40);
        expect(r.body.length).toBeLessThanOrEqual(120);
        // 본문은 해요체("요." / "요")로 끝나거나 수신거부 문구로 끝난다
        expect(/(요\.?|요\)|해제)$/.test(r.body) || r.body.length === 0, `${key} body: ${r.body}`).toBe(true);
        expect(r.url.startsWith("/")).toBe(true);
        expect(r.url).not.toMatch(/\/\{/);
      }
    });
  }

  it("사전 자체가 리뷰 반려 3단어를 포함한다", () => {
    expect(FORBIDDEN_COPY).toContain("탈락");
    expect(FORBIDDEN_COPY).toContain("회원님");
    expect(FORBIDDEN_COPY).toContain("지금 안 하면");
    expect(lintCopy("회원님, 지금 안 하면 탈락이에요 🔥")).toEqual(expect.arrayContaining(["회원님", "지금 안 하면", "탈락", "<emoji>"]));
  });

  it("닉네임에 금지어가 섞여도 lint 가 잡는다(전송 전 폐기 근거)", () => {
    const r = renderPush("new_message", { nickname: "예쁜토끼" });
    expect(lintCopy(`${r.title} ${r.body}`)).toContain("예쁜");
  });
});

describe("kind 분류 · 예산 · 마케팅 표기", () => {
  it("transactional 은 예산 미소비, service/marketing 슬롯 A/B 는 소비", () => {
    for (const key of PUSH_TEMPLATE_KEYS) {
      const m = PUSH_TEMPLATES[key];
      if (m.kind === "transactional") expect(m.consumesBudget, key).toBe(false);
      if (m.slot === "A" || (m.slot === "B" && m.kind !== "transactional")) expect(m.consumesBudget, key).toBe(true);
      if (m.slot === "B" && m.kind === "service") expect(m.priorityRank, key).not.toBeNull();
      if (m.kind === "marketing") expect(m.holdAtNight, key).toBe(false); // 창 밖 = 폐기
    }
    expect(PUSH_TEMPLATES.new_match.bundleMinutes).toBe(60);
    expect(PUSH_TEMPLATES.new_message.bundleMinutes).toBe(60);
    expect(PUSH_TEMPLATES.reconsent_needed.kind).toBe("service"); // 재확인 안내는 광고성 아님
    expect(PUSH_TEMPLATES.reminder_d3.kind).toBe("service");
  });

  it("마케팅은 (광고) 접두어 + 전송자 명칭 + 수신거부 경로", () => {
    for (const key of ["marketing_event", "marketing_benefit"] as const) {
      for (const params of SAMPLES[key]) {
        const r = renderPush(key, params, { serviceName: "테스트서비스" });
        expect(r.title.startsWith(`${MARKETING_PREFIX} `)).toBe(true);
        expect(r.body).toContain("테스트서비스");
        expect(r.body).toContain(MARKETING_OPTOUT);
      }
    }
    // 서비스 알림에는 (광고) 가 붙지 않는다
    expect(renderPush("daily_reco_ready", { n: 5 }).title.includes(MARKETING_PREFIX)).toBe(false);
  });

  it("뭉침 카피: count>1 이면 건수 + 목록 딥링크", () => {
    const one = renderPush("new_message", { nickname: "민재", match_id: "abc-1", count: 1 });
    expect(one.url).toBe("/chat/abc-1");
    const many = renderPush("new_message", { nickname: "민재", match_id: "abc-1", count: 3 });
    expect(many.title).toBe("새 메시지 3개");
    expect(many.url).toBe("/chat");
    expect(many.body).not.toContain("민재"); // 여러 상대 → 닉네임 미노출
  });

  it("슬롯 A: 결과 대기 건수는 있을 때만(C1 #33)", () => {
    expect(renderPush("daily_reco_ready", { n: 5, pending: 2 })).toMatchObject({ title: "새 추천 5명 도착", body: "결과 기다리는 중 2건" });
    expect(renderPush("daily_reco_ready", { n: 5, pending: 0 }).body).not.toContain("결과");
  });

  it("딥링크 치환 실패 시 상위 경로 폴백 · 악성 값 무시", () => {
    expect(renderPush("new_match", {}).url).toBe("/match");
    expect(renderPush("new_match", { match_id: "../../etc" }).url).toBe("/match");
    expect(renderPush("marketing_event", { url: "https://evil.example" }).url).toBe("/home");
  });

  it("payload 는 원문·개인정보 없이 title/body/url/tag/qid 만", () => {
    const p = buildPayload(renderPush("new_message", { nickname: "민재", match_id: "m1" }), 42);
    expect(Object.keys(p).sort()).toEqual(["badge", "body", "icon", "kind", "qid", "slot", "tag", "template", "title", "url", "v"].sort());
    expect(p.qid).toBe(42);
    expect(p.tag).toBe("dm-new_message");
  });
});

describe("Deno 복사본 동기화", () => {
  it("supabase/functions/push-send/lib/templates.ts 는 이 파일과 바이트 단위로 같다", () => {
    const here = fileURLToPath(new URL("./templates.ts", import.meta.url));
    const deno = fileURLToPath(new URL("../../../../supabase/functions/push-send/lib/templates.ts", import.meta.url));
    expect(readFileSync(deno, "utf8")).toBe(readFileSync(here, "utf8"));
  });
});
