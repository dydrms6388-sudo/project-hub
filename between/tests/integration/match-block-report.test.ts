import { describe, expect, it } from "vitest";
import { withService } from "@/lib/server/db";
import {
  block,
  getCard,
  isAdmin,
  listContacts,
  listLikes,
  listMatches,
  moderate,
  report,
  reportQueue,
  swipe,
  unmatch,
  upsertContact,
} from "@/lib/server/repo";
import { as, makeAdmin, makeUser } from "../helpers/factory";

describe("좋아요 · 매칭", () => {
  it("상호 좋아요 시 매칭이 생성되고, 중복 좋아요는 무시된다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    expect(await as(a, (db) => swipe(db, a.id, b.id, "like"))).toEqual({ matched: false, duplicate: false });
    expect(await as(a, (db) => swipe(db, a.id, b.id, "like"))).toEqual({ matched: false, duplicate: true });
    expect((await as(b, (db) => listLikes(db, b.id, "received"))).map((x) => x.profile.id)).toContain(a.id);
    expect(await as(b, (db) => swipe(db, b.id, a.id, "like"))).toEqual({ matched: true, duplicate: false });
    expect((await as(a, (db) => listMatches(db, a.id))).map((m) => m.profile.id)).toEqual([b.id]);
    expect((await as(b, (db) => listMatches(db, b.id))).map((m) => m.profile.id)).toEqual([a.id]);
  });

  it("패스는 상대에게 보이지 않고 매칭되지 않는다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await as(a, (db) => swipe(db, a.id, b.id, "pass"));
    expect(await as(b, (db) => listLikes(db, b.id, "received"))).toEqual([]);
    expect(await as(b, (db) => swipe(db, b.id, a.id, "like"))).toMatchObject({ matched: false });
    const r = await as(b, (db) => db.query("select * from public.likes where liker_id = $1", [a.id]));
    expect(r.rowCount).toBe(0);
  });

  it("다른 사람 명의로 좋아요를 보낼 수 없다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser();
    await expect(as(a, (db) => swipe(db, b.id, c.id, "like"))).rejects.toThrow(/row-level security/);
  });

  it("매칭은 직접 생성/조작할 수 없고 제3자는 볼 수 없다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const outsider = await makeUser();
    await expect(
      as(a, (db) => db.query("insert into public.matches (user_a, user_b) values ($1, $2)", [a.id < b.id ? a.id : b.id, a.id < b.id ? b.id : a.id])),
    ).rejects.toThrow(/permission denied/);
    await as(a, (db) => swipe(db, a.id, b.id, "like"));
    await as(b, (db) => swipe(db, b.id, a.id, "like"));
    const seen = await as(outsider, (db) => db.query("select * from public.matches"));
    expect(seen.rows.filter((m) => [m.user_a, m.user_b].includes(a.id))).toEqual([]);
    const [m] = await as(a, (db) => listMatches(db, a.id));
    expect(await as(outsider, (db) => unmatch(db, m.match_id))).toBe(false);
    expect(await as(a, (db) => unmatch(db, m.match_id))).toBe(true);
    expect(await as(b, (db) => listMatches(db, b.id))).toEqual([]);
  });
});

describe("연락처 공개 범위", () => {
  it("공개 연락처는 누구나, 매칭 전용 연락처는 매칭 상대만 본다", async () => {
    const owner = await makeUser();
    const matched = await makeUser();
    const stranger = await makeUser();
    await as(owner, (db) => upsertContact(db, owner.id, "instagram", "https://instagram.com/between_owner", "public"));
    await as(owner, (db) => upsertContact(db, owner.id, "kakao_openchat", "https://open.kakao.com/o/sAbCdEf1", "matches"));

    expect((await as(stranger, (db) => listContacts(db, owner.id))).map((c) => c.kind)).toEqual(["instagram"]);

    await as(owner, (db) => swipe(db, owner.id, matched.id, "like"));
    await as(matched, (db) => swipe(db, matched.id, owner.id, "like"));
    expect((await as(matched, (db) => listContacts(db, owner.id))).map((c) => c.kind).sort()).toEqual([
      "instagram",
      "kakao_openchat",
    ]);
    expect((await as(stranger, (db) => listContacts(db, owner.id))).map((c) => c.kind)).toEqual(["instagram"]);
  });

  it("매칭 해제 후에는 매칭 전용 연락처가 다시 숨겨진다", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    await as(owner, (db) => upsertContact(db, owner.id, "telegram", "https://t.me/owner_tg", "matches"));
    await as(owner, (db) => swipe(db, owner.id, other.id, "like"));
    await as(other, (db) => swipe(db, other.id, owner.id, "like"));
    expect(await as(other, (db) => listContacts(db, owner.id))).toHaveLength(1);
    const [m] = await as(other, (db) => listMatches(db, other.id));
    await as(other, (db) => unmatch(db, m.match_id));
    expect(await as(other, (db) => listContacts(db, owner.id))).toHaveLength(0);
  });

  it("http/javascript 스킴은 DB 제약으로도 거부된다", async () => {
    const u = await makeUser();
    for (const bad of ["javascript:alert(1)", "http://example.com", "https://x.com/\"><script>"]) {
      await expect(
        as(u, (db) => db.query("insert into public.contact_methods (user_id, kind, value) values ($1, 'link', $2)", [u.id, bad])),
      ).rejects.toThrow(/check constraint/);
    }
  });

  it("다른 사람의 연락처를 수정/삭제할 수 없다", async () => {
    const owner = await makeUser();
    const attacker = await makeUser();
    await as(owner, (db) => upsertContact(db, owner.id, "line", "https://line.me/ti/p/~owner", "public"));
    const r = await as(attacker, (db) =>
      db.query("update public.contact_methods set value = 'https://evil.example' where user_id = $1", [owner.id]),
    );
    expect(r.rowCount).toBe(0);
    const d = await as(attacker, (db) => db.query("delete from public.contact_methods where user_id = $1", [owner.id]));
    expect(d.rowCount).toBe(0);
  });
});

describe("차단", () => {
  it("차단하면 양방향으로 보이지 않고, 매칭이 해제되며, 좋아요도 보낼 수 없다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await as(a, (db) => swipe(db, a.id, b.id, "like"));
    await as(b, (db) => swipe(db, b.id, a.id, "like"));
    await as(a, (db) => block(db, a.id, b.id));
    expect(await as(a, (db) => getCard(db, b.id))).toBeNull();
    expect(await as(b, (db) => getCard(db, a.id))).toBeNull();
    expect(await as(a, (db) => listMatches(db, a.id))).toEqual([]);
    const c = await makeUser();
    await as(c, (db) => block(db, c.id, a.id));
    await expect(as(a, (db) => swipe(db, a.id, c.id, "like"))).rejects.toThrow(/row-level security/);
  });

  it("차단 목록은 본인만 볼 수 있다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await as(a, (db) => block(db, a.id, b.id));
    const r = await as(b, (db) => db.query("select * from public.blocks where blocker_id = $1", [a.id]));
    expect(r.rowCount).toBe(0);
  });
});

describe("신고 · 운영", () => {
  it("신고는 본인 것만 조회되고, 3명 이상 신고 시 자동 보류된다", async () => {
    const target = await makeUser();
    const viewer = await makeUser();
    const reporters = [await makeUser(), await makeUser(), await makeUser()];
    await as(reporters[0], (db) => report(db, reporters[0].id, target.id, "spam", "광고 계정"));
    const others = await as(reporters[1], (db) => db.query("select * from public.reports where reported_id = $1", [target.id]));
    expect(others.rowCount).toBe(0);
    await as(reporters[1], (db) => report(db, reporters[1].id, target.id, "scam", null));
    expect(await as(viewer, (db) => getCard(db, target.id))).not.toBeNull();
    await as(reporters[2], (db) => report(db, reporters[2].id, target.id, "fake", null));
    expect(await as(viewer, (db) => getCard(db, target.id))).toBeNull();
  });

  it("같은 대상 중복 신고는 막힌다", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await as(a, (db) => report(db, a.id, b.id, "spam", null));
    await expect(as(a, (db) => report(db, a.id, b.id, "spam", null))).rejects.toThrow(/duplicate key/);
  });

  it("익명 JWT 사용자는 admin_roles 에 있어도 운영자가 아니다", async () => {
    const u = await makeUser();
    await withService((db) => db.query("insert into public.admin_roles (user_id) values ($1)", [u.id]));
    expect(await as(u, (db) => isAdmin(db))).toBe(false);
    await expect(
      as(u, (db) => moderate(db, { target: u.id, action: "warn", reason: null, hours: null, reportId: null, photoId: null })),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("일반 사용자는 admin_roles 를 쓸 수 없다", async () => {
    const u = await makeUser();
    await expect(as(u, (db) => db.query("insert into public.admin_roles (user_id) values ($1)", [u.id]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("운영자는 신고 큐를 보고 정지/복구할 수 있다", async () => {
    const admin = await makeAdmin(await makeUser());
    const bad = await makeUser();
    const reporter = await makeUser();
    const viewer = await makeUser();
    await as(reporter, (db) => report(db, reporter.id, bad.id, "harassment", "욕설"));
    const queue = await as(admin, (db) => reportQueue(db));
    const item = queue.find((r) => r.reported_id === bad.id)!;
    expect(item).toMatchObject({ reason: "harassment", status: "open", open_count: 1 });

    await as(admin, (db) =>
      moderate(db, { target: bad.id, action: "suspend", reason: "욕설", hours: 24, reportId: item.id, photoId: null }),
    );
    expect(await as(viewer, (db) => getCard(db, bad.id))).toBeNull();
    const st = await as(admin, (db) => db.query("select status, suspended_until from public.profiles where id = $1", [bad.id]));
    expect(st.rows[0].status).toBe("suspended");
    expect((await as(admin, (db) => reportQueue(db))).find((r) => r.id === item.id)).toBeUndefined();

    await as(admin, (db) => moderate(db, { target: bad.id, action: "restore", reason: null, hours: null, reportId: null, photoId: null }));
    expect(await as(viewer, (db) => getCard(db, bad.id))).not.toBeNull();
    const log = await as(admin, (db) => db.query("select action from public.moderation_actions where target_user_id = $1 order by created_at", [bad.id]));
    expect(log.rows.map((r) => r.action)).toEqual(["suspend", "restore"]);
    const asUser = await as(viewer, (db) => db.query("select * from public.moderation_actions"));
    expect(asUser.rowCount).toBe(0);
  });
});
