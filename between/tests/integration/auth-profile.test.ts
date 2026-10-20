import { describe, expect, it } from "vitest";
import {
  createLocalAnonymousUser,
  findUserByRecoveryCode,
  generateRecoveryCode,
  lookupLocalUser,
  saveRecoveryCode,
  signLocalSession,
  verifyLocalSession,
} from "@/lib/auth/local";
import { withService, withUser } from "@/lib/server/db";
import { createProfile, getMyProfile, updateProfile } from "@/lib/server/repo";
import { onboardingSchema, profileUpdateSchema } from "@/lib/validation/profile";
import { as, makeUser } from "../helpers/factory";

describe("익명 인증 (local 드라이버)", () => {
  it("익명 사용자를 만들고 서명된 세션 토큰을 검증한다", async () => {
    const id = await createLocalAnonymousUser();
    const token = await signLocalSession(id);
    expect(await verifyLocalSession(token)).toBe(id);
    expect(await lookupLocalUser(id)).toEqual({ isAnonymous: true });
  });

  it("위조/변조된 토큰은 거부한다", async () => {
    const id = await createLocalAnonymousUser();
    const token = await signLocalSession(id);
    const [h, p, s] = token.split(".");
    const forged = JSON.parse(Buffer.from(p, "base64url").toString());
    forged.sub = "00000000-0000-0000-0000-000000000000";
    expect(await verifyLocalSession(`${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`)).toBeNull();
    expect(await verifyLocalSession("garbage")).toBeNull();
  });

  it("복구 코드로 같은 사용자를 찾고, 해시만 저장한다", async () => {
    const u = await makeUser();
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    await saveRecoveryCode(u.id, code);
    expect(await findUserByRecoveryCode(code.toLowerCase())).toBe(u.id);
    expect(await findUserByRecoveryCode(generateRecoveryCode())).toBeNull();
    const stored = await withService((db) => db.query("select code_hash from public.account_recovery where user_id = $1", [u.id]));
    expect(stored.rows[0].code_hash).not.toContain(code.replace(/-/g, ""));
  });

  it("authenticated 사용자는 복구 코드/레이트리밋 테이블에 접근할 수 없다", async () => {
    const u = await makeUser();
    await expect(as(u, (db) => db.query("select * from public.account_recovery"))).rejects.toThrow(/permission denied/);
    await expect(as(u, (db) => db.query("select * from public.rate_limits"))).rejects.toThrow(/permission denied/);
  });
});

describe("프로필 CRUD + 소유권", () => {
  it("본인 프로필을 생성·조회·수정한다", async () => {
    const u = await makeUser({ nickname: "민준" });
    const me = await as(u, (db) => getMyProfile(db, u.id));
    expect(me?.nickname).toBe("민준");
    const upd = profileUpdateSchema.parse({
      nickname: "민준2",
      birthYear: 1994,
      sido: "부산",
      sigungu: "해운대구",
      height: 178,
      interests: ["travel", "cafe"],
      bio: "주말엔 바다 산책해요",
    });
    await as(u, (db) => updateProfile(db, u.id, upd));
    const after = await as(u, (db) => getMyProfile(db, u.id));
    expect(after).toMatchObject({ nickname: "민준2", sido: "부산", height: 178, interests: ["travel", "cafe"] });
  });

  it("다른 사용자의 프로필은 수정할 수 없다 (IDOR)", async () => {
    const a = await makeUser();
    const b = await makeUser({ nickname: "피해자" });
    const upd = profileUpdateSchema.parse({ nickname: "해킹", birthYear: 1990, sido: "서울" });
    await expect(as(a, (db) => updateProfile(db, b.id, upd))).rejects.toThrow("FORBIDDEN");
    const r = await as(a, (db) => db.query("update public.profiles set nickname = '해킹' where id = $1", [b.id]));
    expect(r.rowCount).toBe(0);
    expect((await as(b, (db) => getMyProfile(db, b.id)))?.nickname).toBe("피해자");
  });

  it("타인 원본 profiles 행은 조회되지 않는다 (마스킹 뷰로만 조회)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const r = await as(a, (db) => db.query("select * from public.profiles where id = $1", [b.id]));
    expect(r.rowCount).toBe(0);
  });

  it("상태 컬럼(status, last_active_at)은 본인도 직접 수정할 수 없다", async () => {
    const u = await makeUser();
    await expect(as(u, (db) => db.query("update public.profiles set status = 'active' where id = $1", [u.id]))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      as(u, (db) => db.query("update public.profiles set last_active_at = now() + interval '1 year' where id = $1", [u.id])),
    ).rejects.toThrow(/permission denied/);
  });

  it("다른 사람 ID 로 프로필을 만들 수 없다", async () => {
    const a = await makeUser();
    const victim = await createLocalAnonymousUser();
    const input = onboardingSchema.parse({
      nickname: "가짜",
      birthYear: 1990,
      sido: "서울",
      adultConfirmed: true,
      privacyConsent: true,
      sensitiveConsent: true,
    });
    await expect(as(a, (db) => createProfile(db, victim, input))).rejects.toThrow(/row-level security/);
  });

  it("미성년자 출생연도는 DB 에서도 거부된다", async () => {
    const id = await createLocalAnonymousUser();
    const claims = { sub: id, role: "authenticated" as const, is_anonymous: true };
    const minorYear = new Date().getFullYear() - 18;
    await expect(
      withUser(claims, (db) =>
        db.query(
          `insert into public.profiles (id, nickname, birth_year, sido, adult_confirmed_at, privacy_consent_at)
           values ($1, '미성년', $2, '서울', now(), now())`,
          [id, minorYear],
        ),
      ),
    ).rejects.toThrow(/ADULT_ONLY/);
  });

  it("성향은 민감정보 동의 없이 저장할 수 없다", async () => {
    const u = await makeUser();
    await expect(as(u, (db) => db.query("update public.profiles set position = 'top' where id = $1", [u.id]))).rejects.toThrow(
      /position_requires_sensitive_consent/,
    );
  });

  it("계정 삭제 시 개인 데이터가 cascade 로 모두 삭제된다", async () => {
    const u = await makeUser();
    await as(u, (db) =>
      db.query("insert into public.contact_methods (user_id, kind, value) values ($1, 'telegram', 'https://t.me/abcde')", [u.id]),
    );
    await withService((db) => db.query("delete from auth.users where id = $1", [u.id]));
    const left = await withService((db) =>
      db.query(
        `select (select count(*) from public.profiles where id = $1)::int +
                (select count(*) from public.contact_methods where user_id = $1)::int +
                (select count(*) from public.activity_status where user_id = $1)::int as n`,
        [u.id],
      ),
    );
    expect(left.rows[0].n).toBe(0);
  });
});
