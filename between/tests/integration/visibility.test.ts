import { describe, expect, it } from "vitest";
import { withService } from "@/lib/server/db";
import { getCard, setActivity, updateProfile } from "@/lib/server/repo";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { as, makeUser } from "../helpers/factory";

describe("공개 프로필 뷰 (마스킹 + 접근제어)", () => {
  it("기본 비공개 필드(몸무게·성향·동)는 타인에게 노출되지 않는다", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await as(owner, (db) =>
      updateProfile(
        db,
        owner.id,
        profileUpdateSchema.parse({
          nickname: "공개테스트",
          birthYear: 1993,
          sido: "서울",
          sigungu: "강남구",
          dong: "역삼동",
          height: 180,
          weight: 75,
          position: "top",
          positionConsent: true,
        }),
      ),
    );
    const card = await as(viewer, (db) => getCard(db, owner.id));
    expect(card).toMatchObject({ height: 180, weight: null, position: null, dong: null, sigungu: "강남구" });
  });

  it("공개로 바꾼 필드는 노출되고, 비공개로 바꾼 필드는 숨겨진다", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await as(owner, (db) =>
      updateProfile(
        db,
        owner.id,
        profileUpdateSchema.parse({
          nickname: "공개설정",
          birthYear: 1993,
          sido: "서울",
          height: 172,
          weight: 68,
          position: "versatile",
          positionConsent: true,
          visibility: { weight: "public", position: "public", height: "private" },
        }),
      ),
    );
    const card = await as(viewer, (db) => getCard(db, owner.id));
    expect(card).toMatchObject({ height: null, weight: 68, position: "versatile" });
  });

  it("숨김/만료/정지 프로필은 보이지 않는다", async () => {
    const viewer = await makeUser();
    const hidden = await makeUser();
    const expired = await makeUser();
    const banned = await makeUser();
    await as(hidden, (db) => db.query("update public.profiles set is_hidden = true where id = $1", [hidden.id]));
    await withService((db) =>
      db.query("update public.profiles set expires_at = now() - interval '1 minute' where id = $1", [expired.id]),
    );
    await withService((db) => db.query("update public.profiles set status = 'banned' where id = $1", [banned.id]));
    for (const t of [hidden, expired, banned]) {
      expect(await as(viewer, (db) => getCard(db, t.id))).toBeNull();
    }
  });

  it("정지된 사용자는 다른 프로필을 탐색할 수 없다", async () => {
    const suspended = await makeUser();
    const other = await makeUser();
    await withService((db) =>
      db.query("update public.profiles set status = 'suspended' where id = $1", [suspended.id]),
    );
    expect(await as(suspended, (db) => getCard(db, other.id))).toBeNull();
  });

  it("'지금 가능' 은 만료 후 자동으로 비활성으로 보인다", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await as(owner, (db) => setActivity(db, owner.id, "now", 2));
    expect((await as(viewer, (db) => getCard(db, owner.id)))?.availability).toBe("now");
    await withService((db) =>
      db.query("update public.activity_status set expires_at = now() - interval '1 second' where user_id = $1", [
        owner.id,
      ]),
    );
    expect((await as(viewer, (db) => getCard(db, owner.id)))?.availability).toBe("off");
  });

  it("'지금 가능' 은 만료시각 없이 또는 6시간 초과로 설정할 수 없다", async () => {
    const u = await makeUser();
    await expect(
      as(u, (db) =>
        db.query("update public.activity_status set status = 'now', expires_at = null where user_id = $1", [u.id]),
      ),
    ).rejects.toThrow(/NOW_REQUIRES_EXPIRY/);
    await expect(
      as(u, (db) =>
        db.query(
          "update public.activity_status set status = 'now', expires_at = now() + interval '1 day' where user_id = $1",
          [u.id],
        ),
      ),
    ).rejects.toThrow(/NOW_REQUIRES_EXPIRY/);
  });

  it("타인의 activity_status 원본은 조회할 수 없다 (정확한 만료시각 비노출)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await as(owner, (db) => setActivity(db, owner.id, "now", 1));
    const r = await as(viewer, (db) => db.query("select * from public.activity_status where user_id = $1", [owner.id]));
    expect(r.rowCount).toBe(0);
  });
});
