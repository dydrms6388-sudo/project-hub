import { describe, expect, it } from "vitest";
import {
  decidePush,
  isMarketingWindowKst,
  isQuietHoursKst,
  kstAt,
  kstMinutes,
  loopDateKst,
  nextKstTime,
  pickSlotB,
  reminderAllowed,
  reminderTemplateFor,
  retryDelayMinutes,
  slotAEligible,
  slotBTimeFor,
  type PushDecisionInput,
} from "./policy";

const Z = (s: string) => new Date(s);

describe("KST 경계", () => {
  it("kstMinutes / loopDate: 07:00 KST 가 하루 경계", () => {
    expect(kstMinutes(Z("2026-09-01T22:00:00Z"))).toBe(7 * 60); // 07:00 KST
    expect(loopDateKst(Z("2026-09-01T21:59:59Z"))).toBe("2026-09-01"); // 06:59 KST → 전날 loop
    expect(loopDateKst(Z("2026-09-01T22:00:00Z"))).toBe("2026-09-02");
  });

  it("야간 23:00~07:00 KST (경계 포함/제외)", () => {
    expect(isQuietHoursKst(Z("2026-09-01T13:59:59Z"))).toBe(false); // 22:59:59
    expect(isQuietHoursKst(Z("2026-09-01T14:00:00Z"))).toBe(true); // 23:00
    expect(isQuietHoursKst(Z("2026-09-01T21:59:59Z"))).toBe(true); // 06:59:59
    expect(isQuietHoursKst(Z("2026-09-01T22:00:00Z"))).toBe(false); // 07:00
    expect(isQuietHoursKst(Z("2026-09-01T22:30:00Z"))).toBe(false); // 07:30 슬롯 A 는 야간 아님
  });

  it("마케팅 창 08:00~21:00 KST", () => {
    expect(isMarketingWindowKst(Z("2026-09-01T22:59:59Z"))).toBe(false); // 07:59:59
    expect(isMarketingWindowKst(Z("2026-09-01T23:00:00Z"))).toBe(true); // 08:00
    expect(isMarketingWindowKst(Z("2026-09-02T11:59:59Z"))).toBe(true); // 20:59:59
    expect(isMarketingWindowKst(Z("2026-09-02T12:00:00Z"))).toBe(false); // 21:00
  });

  it("nextKstTime: 야간 보류 해제 = 다음 07:00 KST", () => {
    expect(nextKstTime(Z("2026-09-01T14:30:00Z"), "07:00").toISOString()).toBe("2026-09-01T22:00:00.000Z"); // 23:30 → 익일 07:00
    expect(nextKstTime(Z("2026-09-01T20:00:00Z"), "07:00").toISOString()).toBe("2026-09-01T22:00:00.000Z"); // 05:00 → 같은 날 07:00
    expect(nextKstTime(Z("2026-09-01T22:00:00Z"), "07:00").toISOString()).toBe("2026-09-02T22:00:00.000Z"); // 정확히 07:00 → 다음날
    expect(kstAt("2026-09-02", "19:30").toISOString()).toBe("2026-09-02T10:30:00.000Z");
  });
});

const base: PushDecisionInput = {
  template: "daily_reco_ready",
  at: Z("2026-09-02T01:00:00Z"), // 10:00 KST
  profileStatus: "active",
  hasSubscription: true,
  slotEnabled: true,
  budgetUsed: 0,
};

describe("decidePush — SQL can_send_push 미러", () => {
  it("낮·구독 있음 → send", () => {
    expect(decidePush(base).action).toBe("send");
  });
  it("구독 없음 / 슬롯 off / 서비스 off", () => {
    expect(decidePush({ ...base, hasSubscription: false }).reason).toBe("NO_SUBSCRIPTION");
    expect(decidePush({ ...base, slotEnabled: false }).reason).toBe("SLOT_OFF");
    expect(decidePush({ ...base, serviceEnabled: false }).reason).toBe("SERVICE_OFF");
    // 제재 통보는 서비스 off 여도 간다
    expect(decidePush({ ...base, template: "sanction_issued", serviceEnabled: false }).action).toBe("send");
  });
  it("프로필 상태: paused 는 계정 통보만, banned 는 제재 통보만", () => {
    expect(decidePush({ ...base, profileStatus: "paused" }).reason).toBe("PROFILE_PAUSED");
    expect(decidePush({ ...base, profileStatus: "paused", template: "report_resolved" }).action).toBe("send");
    expect(decidePush({ ...base, profileStatus: "banned", template: "new_match" }).reason).toBe("PROFILE_BANNED");
    expect(decidePush({ ...base, profileStatus: "banned", template: "sanction_issued" }).action).toBe("send");
    expect(decidePush({ ...base, profileStatus: "deleting", template: "sanction_issued" }).reason).toBe("PROFILE_INACTIVE");
  });
  it("예산 2건: service 는 초과 시 폐기, transactional 은 미소비", () => {
    expect(decidePush({ ...base, budgetUsed: 2 }).reason).toBe("BUDGET_EXCEEDED");
    expect(decidePush({ ...base, budgetUsed: 1 }).action).toBe("send");
    expect(decidePush({ ...base, template: "new_match", budgetUsed: 2 }).action).toBe("send");
    expect(decidePush({ ...base, template: "new_message", budgetUsed: 5 }).action).toBe("send");
  });
  it("야간 → hold, release 07:00 KST", () => {
    const d = decidePush({ ...base, template: "new_message", at: Z("2026-09-02T14:30:00Z") }); // 23:30 KST
    expect(d.action).toBe("hold");
    expect(d.reason).toBe("QUIET_HOURS");
    expect(d.releaseAt?.toISOString()).toBe("2026-09-02T22:00:00.000Z");
  });
  it("개인 방해금지 → USER_QUIET", () => {
    const d = decidePush({ ...base, template: "new_message", at: Z("2026-09-02T12:30:00Z"), userQuiet: { start: "21:00", end: "09:00" } }); // 21:30
    expect(d.reason).toBe("USER_QUIET");
    expect(d.releaseAt?.toISOString()).toBe("2026-09-03T00:00:00.000Z"); // 09:00 KST
  });
  it("뭉침: 같은 템플릿 60분 내 → hold(BUNDLE), 야간이면 둘 중 늦은 시각", () => {
    const d = decidePush({ ...base, template: "new_match", lastSameTemplateSentAt: Z("2026-09-02T00:50:00Z") });
    expect(d.action).toBe("hold");
    expect(d.reason).toBe("BUNDLE");
    expect(d.releaseAt?.toISOString()).toBe("2026-09-02T01:50:00.000Z");
    const past = decidePush({ ...base, template: "new_match", lastSameTemplateSentAt: Z("2026-09-01T23:00:00Z") });
    expect(past.action).toBe("send");
    const night = decidePush({ ...base, template: "new_match", at: Z("2026-09-02T14:30:00Z"), lastSameTemplateSentAt: Z("2026-09-02T14:00:00Z") });
    expect(night.reason).toBe("QUIET_HOURS");
    expect(night.releaseAt?.toISOString()).toBe("2026-09-02T22:00:00.000Z");
  });
  it("마케팅: 동의 없음 폐기, 창 밖 폐기(보류 아님), 낮+동의 → send, 예산 소비", () => {
    expect(decidePush({ ...base, template: "marketing_event" }).reason).toBe("NO_MARKETING_CONSENT");
    expect(decidePush({ ...base, template: "marketing_event", marketingConsent: true, at: Z("2026-09-02T12:30:00Z") }).reason).toBe("MARKETING_NIGHT");
    expect(decidePush({ ...base, template: "marketing_event", marketingConsent: true }).action).toBe("send");
    expect(decidePush({ ...base, template: "marketing_event", marketingConsent: true, budgetUsed: 2 }).reason).toBe("BUDGET_EXCEEDED");
    // 마케팅은 슬롯 토글과 무관(동의만)
    expect(decidePush({ ...base, template: "marketing_event", marketingConsent: true, slotEnabled: false }).action).toBe("send");
  });
});

describe("슬롯 B · 리마인더 · 재시도", () => {
  it("우선순위: 미확인 매칭 > 미답장 > 사진 검수 > 추천 미완료 > 리마인더", () => {
    expect(pickSlotB(["reco_remaining", "unreplied_message", "photo_reviewed"])).toBe("unreplied_message");
    expect(pickSlotB(["reminder_d3", "unseen_match"])).toBe("unseen_match");
    expect(pickSlotB(["reco_remaining", "reminder_d7"])).toBe("reco_remaining");
    expect(pickSlotB([])).toBeNull();
    expect(pickSlotB(["new_match"])).toBeNull(); // 슬롯 B 템플릿이 아니면 후보 아님
  });
  it("유저별 시각: night 만 → 20:30, 그 외 19:30", () => {
    expect(slotBTimeFor(["night"])).toBe("20:30");
    expect(slotBTimeFor(["evening", "night"])).toBe("19:30");
    expect(slotBTimeFor([])).toBe("19:30");
  });
  it("리마인더 상한 30일 2건, D3/D7 창", () => {
    expect(reminderAllowed(0)).toBe(true);
    expect(reminderAllowed(1)).toBe(true);
    expect(reminderAllowed(2)).toBe(false);
    const at = Z("2026-09-10T10:00:00Z");
    expect(reminderTemplateFor(Z("2026-09-07T00:00:00Z"), at)).toBe("reminder_d3");
    expect(reminderTemplateFor(Z("2026-09-03T00:00:00Z"), at)).toBe("reminder_d7");
    expect(reminderTemplateFor(Z("2026-09-05T00:00:00Z"), at)).toBeNull();
  });
  it("슬롯 A: 7일 내 접속 or 월요일", () => {
    const monday = Z("2026-09-07T01:00:00Z"); // 2026-09-07 은 월요일(KST)
    const tuesday = Z("2026-09-08T01:00:00Z");
    expect(slotAEligible(Z("2026-08-01T00:00:00Z"), monday)).toBe(true);
    expect(slotAEligible(Z("2026-08-01T00:00:00Z"), tuesday)).toBe(false);
    expect(slotAEligible(Z("2026-09-05T00:00:00Z"), tuesday)).toBe(true);
  });
  it("재시도 3회 · 5/10 분 백오프", () => {
    expect(retryDelayMinutes(1)).toBe(5);
    expect(retryDelayMinutes(2)).toBe(10);
    expect(retryDelayMinutes(3)).toBeNull();
  });
});
