import { describe, expect, it } from "vitest";
import { DATA_EXPORT_EXCLUDED, DATA_EXPORT_SECTIONS, buildExport, exportFileName, type RawExport } from "./data-export";

const raw: RawExport = {
  profile: { id: "p1", nickname: "서윤", birth_date: "1997-03-02", gender: "female", region_code: "11440", bio: null, now_into: "러닝", verify_level: 3, mode: "friend", seeking_gender: null, status: "active", created_at: "2026-09-01T00:00:00Z", last_active_at: "2026-09-02T00:00:00Z" },
  hobbies: [{ hobby_id: 1, name: "러닝", rank: 1, intensity: 4, fav_note: "한강 5k" }],
  quiz_answers: [{ question_id: 1, choice: 2, answered_at: "2026-09-01T00:00:00Z" }],
  availability: [{ weekday: 6, slot: "morning" }],
  photos: [{ id: "ph1", path: "p1/ph1.webp", is_primary: true, review_status: "approved", reject_code: null, created_at: "2026-09-01T00:00:00Z" }],
  likes_sent: [{ id: "l1", type: "like", created_at: "2026-09-01T00:00:00Z" }],
  matches: [{ match_id: "m1", mode: "friend", status: "active", matched_at: "2026-09-01T00:00:00Z", ended_at: null, partner_nickname: "민재" }],
  messages_sent: [{ match_id: "m1", body: "안녕하세요", image_attached: false, created_at: "2026-09-01T00:00:00Z" }],
  reports_submitted: [{ id: "r1", reason_code: "OTHER", surface: "chat", detail: "…", status: "queued", created_at: "2026-09-01T00:00:00Z", handled_at: null }],
  sanctions: [],
  appeals: [],
  subscriptions: [],
  payments: [],
  event_rsvps: [],
  game_profile: null,
  quest_progress: [],
  consents: [{ key: "terms", document_key: "terms", version: "1.0.0", agreed: true, agreed_at: "2026-09-01T00:00:00Z", withdrawn_at: null, source: "onboarding" }],
  partial: [],
};

describe("데이터 다운로드 JSON 스키마", () => {
  it("schema_version 1 + A5 §11.2 섹션 17개 + excluded 안내", () => {
    const out = buildExport(raw, "덕메이트", new Date("2026-09-02T03:00:00Z"));
    expect(out.schema_version).toBe(1);
    expect(out.exported_at).toBe("2026-09-02T03:00:00.000Z");
    expect(out.subject.profile_id).toBe("p1");
    for (const s of DATA_EXPORT_SECTIONS) expect(out, s).toHaveProperty(s);
    expect(out.excluded).toEqual(DATA_EXPORT_EXCLUDED);
    expect(out.partial).toEqual([]);
  });

  it("매칭은 상대 닉네임만, 신고는 대상 정보 없음, 메시지는 내 원문만", () => {
    const out = buildExport(raw, "덕메이트");
    expect(Object.keys(out.matches[0]!)).not.toContain("partner_id");
    expect(Object.keys(out.reports_submitted[0]!)).not.toContain("target_id");
    expect(out.messages_sent[0]).toEqual({ match_id: "m1", body: "안녕하세요", image_attached: false, created_at: "2026-09-01T00:00:00Z" });
    // 전화 해시·CI 해시 등 금지 키가 프로필에 없다
    for (const k of ["phone_hash", "ci_hash", "user_id"]) expect(out.profile).not.toHaveProperty(k);
  });

  it("JSON 직렬화 가능 + 파일명 KST 날짜", () => {
    const out = buildExport(raw, "덕메이트");
    expect(() => JSON.stringify(out)).not.toThrow();
    expect(exportFileName(new Date("2026-09-02T20:00:00Z"))).toBe("my-data-20260903.json");
  });
});
