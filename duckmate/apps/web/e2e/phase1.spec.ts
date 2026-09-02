/**
 * Phase 1 게이트 실환경 E2E (PRD §0-53 / §8): 가입 → 연령 → OTP → 동의 → 온보딩 6화면 → 본인인증(mock) → 추천 → 상호 좋아요 → 매칭
 * → 제안 카드 → 첫 메시지 → 상대 전화번호 전송 → 마스킹 → 신고 2단계 → 차단 → /blocks 1건.
 *
 * 실행 조건: 실 Supabase(로컬 `supabase start` 또는 스테이징) + `E2E_SUPABASE=1`. 아니면 전부 skip.
 *   env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY(테스트 헬퍼 전용, env 로만),
 *        IDENTITY_VERIFIER=mock, NODE_ENV≠production(simulate 셀렉트 노출), config.toml [auth.sms.test_otp] 의 821000000011/12.
 *   실행: pnpm --filter @duckmate/web e2e:phase1
 * 유저 A(테스터A) · B(테스터B) 두 브라우저 컨텍스트. 각 단계 스크린샷은 e2e/artifacts/phase1-NN-*.png.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PHONE_MESSAGE, USER_A, USER_B, type E2EUser } from "./fixtures/users";
import { adminDb, blockCount, deleteUsersByPhone, ensureMutualRecommendation, findProfileIdByPhone, matchBetween, type AdminDb } from "./helpers/db";
import { dataLayerEvents, REAL_SUPABASE, shot } from "./helpers/env";
import { selectRadixOption, selectRadixOptionByTestId, tid } from "./helpers/ui";

test.describe.configure({ mode: "serial" });
test.skip(!REAL_SUPABASE, "E2E_SUPABASE=1 + 실 Supabase(로컬 supabase start / 스테이징)가 있을 때만 실행");

let db: AdminDb;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;
let profileA = "";
let profileB = "";
let matchId = "";

test.beforeAll(async ({ browser }) => {
  db = adminDb();
  const removed = await deleteUsersByPhone(db, [USER_A.phoneE164, USER_B.phoneE164]);
  console.log(`[phase1] cleaned up ${removed} previous e2e users`);
  ctxA = await browser.newContext();
  ctxB = await browser.newContext();
  pageA = await ctxA.newPage();
  pageB = await ctxB.newPage();
});

test.afterAll(async () => {
  await ctxA?.close();
  await ctxB?.close();
});

/** 랜딩 → S1 연령 → S2 OTP + 동의 → /onboarding/basic */
async function signup(page: Page, u: E2EUser): Promise<void> {
  const tag = `phase1-${u.key}`;
  await page.goto("/");
  await tid(page, "landing-start").click();
  await expect(tid(page, "age-screen")).toBeVisible();
  await tid(page, "birth-year").fill(u.birth.year);
  await tid(page, "birth-month").fill(u.birth.month);
  await tid(page, "birth-day").fill(u.birth.day);
  await tid(page, "onb-next").click();
  await expect(tid(page, "phone-screen")).toBeVisible();
  await shot(page, tag, "age-done");

  await tid(page, "phone-input").fill(u.phoneInput);
  await tid(page, "otp-request").click();
  await expect(tid(page, "otp-input")).toBeVisible();
  await tid(page, "otp-input").fill(u.otp);
  await tid(page, "consent-all").click();
  await expect(tid(page, "consent-youth")).toHaveAttribute("data-state", "checked");
  await shot(page, tag, "otp-consent");
  await tid(page, "onb-next").click();
  await page.waitForURL(/\/onboarding\/basic$/, { timeout: 60_000 });
}

/** S3~S6 + /verify(mock success) → /home */
async function onboardAndVerify(page: Page, u: E2EUser): Promise<void> {
  const tag = `phase1-${u.key}`;
  // S3 기본
  await expect(tid(page, "basic-screen")).toBeVisible();
  await tid(page, "nickname-input").fill(u.nickname);
  await tid(page, `gender-${u.gender}`).click();
  await selectRadixOption(page, "region-sido", u.sido);
  await selectRadixOption(page, "region-sigungu", u.sigungu);
  await tid(page, "avail-quick-weekday-evening").click();
  await shot(page, tag, "basic");
  await tid(page, "onb-next").click();
  await page.waitForURL(/\/onboarding\/hobbies$/);

  // S4 취미 (같은 카테고리·첫 칩 idol 공통)
  await expect(tid(page, "hobbies-screen")).toBeVisible();
  await tid(page, `hobby-cat-${u.hobbyCategory}`).click();
  for (const [i, slug] of u.hobbyChips.entries()) {
    await tid(page, `hobby-chip-${slug}`).first().click();
    await expect(tid(page, "hobby-sheet")).toBeVisible();
    if (i === 0) {
      await tid(page, "intensity-4").click();
      await tid(page, "fav-note-input").fill(u.favNote);
    }
    await tid(page, "hobby-sheet").getByRole("button", { name: "완료" }).click();
    await expect(tid(page, "hobby-sheet")).toBeHidden();
    await expect(tid(page, `hobby-selected-${slug}`)).toBeVisible();
  }
  await shot(page, tag, "hobbies");
  await tid(page, "onb-next").click();
  await page.waitForURL(/\/onboarding\/quiz$/);

  // S5 퀴즈: 나중에
  await expect(tid(page, "quiz-screen")).toBeVisible();
  await tid(page, "quiz-later").click();
  await page.waitForURL(/\/onboarding\/card$/);

  // S6-a 덕질 카드
  await expect(tid(page, "card-screen")).toBeVisible();
  await tid(page, "card-now-into").fill(u.nowInto);
  await shot(page, tag, "card");
  await tid(page, "onb-next").click();
  await page.waitForURL(/\/onboarding\/photos$/);

  // S6-b 사진: 나중에 → /verify (풀 내비게이션)
  await expect(tid(page, "photos-screen")).toBeVisible();
  await tid(page, "photos-later").click();
  await page.waitForURL(/\/verify$/, { timeout: 60_000 });

  // S7 본인인증 mock(simulate=success)
  await expect(tid(page, "verify-screen")).toBeVisible();
  await shot(page, tag, "verify");
  await tid(page, "verify-start").click();
  await expect(tid(page, "verify-mock-dialog")).toBeVisible();
  await selectRadixOptionByTestId(page, "verify-simulate", "verify-simulate-success");
  await tid(page, "verify-simulate-confirm").click();
  await page.waitForURL(/\/home$/, { timeout: 60_000 });
  await expect(tid(page, "home")).toBeVisible();
  await shot(page, tag, "home");
}

test("1. 유저 A 가입 → 온보딩 → 본인인증 → /home", async () => {
  await signup(pageA, USER_A);
  await onboardAndVerify(pageA, USER_A);
  const events = await dataLayerEvents(pageA);
  expect(events).toContain("verify_succeeded");
});

test("2. 유저 B 가입 → 온보딩 → 본인인증 → /home", async () => {
  await signup(pageB, USER_B);
  await onboardAndVerify(pageB, USER_B);
});

test("3. 추천 보강(A↔B) + A 가 B 에게 좋아요", async () => {
  profileA = (await findProfileIdByPhone(db, USER_A.phoneE164)) ?? "";
  profileB = (await findProfileIdByPhone(db, USER_B.phoneE164)) ?? "";
  expect(profileA, "A profile").not.toBe("");
  expect(profileB, "B profile").not.toBe("");
  // /home 진입 시 ensure_today_recommendations 가 온디맨드 생성했을 수 있다 → 서로 포함되도록 보강(멱등)
  await ensureMutualRecommendation(db, profileA, profileB);

  await pageA.goto("/reco");
  await expect(tid(pageA, "reco-stack")).toBeVisible();
  const cardB = tid(pageA, "reco-card").filter({ hasText: USER_B.nickname }).first();
  await expect(cardB).toBeVisible();
  await shot(pageA, "phase1-A", "reco");
  await cardB.getByTestId("reco-like").click();
  // 아직 상호 아님 → 카드 제거, 매칭 화면 없음
  await expect(cardB).toBeHidden();
  await expect(pageA).toHaveURL(/\/reco/);
  expect(await dataLayerEvents(pageA)).toContain("like_sent");
});

test("4. B 가 A 에게 좋아요 → 매칭 리빌 → 제안 카드 ③ → /chat/[id] 첫 메시지", async () => {
  await pageB.goto("/reco");
  const cardA = tid(pageB, "reco-card").filter({ hasText: USER_A.nickname }).first();
  await expect(cardA).toBeVisible();
  await cardA.getByTestId("reco-like").click();
  await pageB.waitForURL(/\/match\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  matchId = pageB.url().split("/match/")[1]?.split(/[?#]/)[0] ?? "";
  expect(matchId).toMatch(/^[0-9a-f-]{36}$/);
  const m = await matchBetween(db, profileA, profileB);
  expect(m?.id).toBe(matchId);
  expect(m?.status).toBe("active");

  // 첫 매칭 안전 모달 → 리빌 → 제안 3장
  const safety = tid(pageB, "safety-modal");
  if (await safety.isVisible().catch(() => false)) await tid(pageB, "safety-confirm").click();
  await expect(tid(pageB, "match-screen")).toBeVisible();
  await expect(tid(pageB, "match-suggestions")).toBeVisible();
  await shot(pageB, "phase1-B", "match");
  const card3 = tid(pageB, "suggestion-card-3");
  const inner = card3.getByRole("button");
  if ((await inner.count()) > 0) await inner.first().click();
  else await card3.click();
  await pageB.waitForURL(new RegExp(`/chat/${matchId}$`), { timeout: 30_000 });
  await expect(tid(pageB, "chat-room")).toBeVisible();
  await expect(pageB.locator('[data-testid="chat-message"][data-mine="true"]')).toHaveCount(1);
  await shot(pageB, "phase1-B", "chat-first-message");
  expect(await dataLayerEvents(pageB)).toContain("suggestion_selected");
});

test("5. B 가 전화번호 전송 → 발신자 안내, A 화면 마스킹 칩 (Realtime/폴링)", async () => {
  await tid(pageB, "chat-input").fill(PHONE_MESSAGE);
  await tid(pageB, "chat-send").click();
  await expect(tid(pageB, "chat-masked-note")).toBeVisible();
  await expect(pageB.locator('[data-testid="chat-message"][data-mine="true"]').last()).toContainText("010-1234-5678");
  await shot(pageB, "phase1-B", "chat-phone-sent");

  await pageA.goto(`/chat/${matchId}`);
  await expect(tid(pageA, "chat-room")).toBeVisible();
  await expect(tid(pageA, "chat-masked-chip").first()).toBeVisible({ timeout: 20_000 });
  await expect(tid(pageA, "chat-room")).not.toContainText("010-1234-5678");
  await expect(tid(pageA, "chat-banner-mask")).toBeVisible();
  await shot(pageA, "phase1-A", "chat-masked");
  // Realtime private 채널 연결 확인(E3 결정 9): 폴링 폴백 바가 계속 떠 있으면 실패로 기록
  const polling = await tid(pageA, "chat-polling").isVisible().catch(() => false);
  test.info().annotations.push({ type: "realtime", description: polling ? "polling fallback (private channel join 미확인)" : "connected" });
});

test("6. A 가 B 신고(ROMANCE_SCAM) → 완료 화면 차단 체크 → /blocks 1건", async () => {
  const href = await tid(pageA, "chat-report").getAttribute("href");
  expect(href).toContain(`target=${profileB}`);
  expect(href).toContain(`match=${matchId}`);
  await tid(pageA, "chat-report").click();
  await pageA.waitForURL(/\/report/);
  await expect(tid(pageA, "report-screen")).toBeVisible();
  await tid(pageA, "report-category-1").click();
  await tid(pageA, "report-reason-ROMANCE_SCAM").click();
  await tid(pageA, "report-detail").fill("연락처를 계속 물어봐요");
  await shot(pageA, "phase1-A", "report-form");
  await tid(pageA, "report-submit").click();
  await expect(tid(pageA, "report-done")).toBeVisible({ timeout: 30_000 });
  await expect(tid(pageA, "report-done")).toContainText("24시간 안에 확인해요");
  await expect(tid(pageA, "report-block-check")).toHaveAttribute("data-state", "checked");
  await shot(pageA, "phase1-A", "report-done");
  await tid(pageA, "report-finish").click();
  await pageA.waitForURL(/\/chat$/, { timeout: 30_000 });

  await pageA.goto("/blocks");
  await expect(tid(pageA, "blocks-screen")).toBeVisible();
  await expect(tid(pageA, "block-item")).toHaveCount(1);
  await expect(tid(pageA, "block-item").first()).toContainText(USER_B.nickname);
  await shot(pageA, "phase1-A", "blocks");
  expect(await blockCount(db, profileA)).toBe(1);
  const m = await matchBetween(db, profileA, profileB);
  expect(m?.status).toBe("blocked");

  // 차단당한 B: 방은 종료 상태, 입력 불가
  await pageB.goto(`/chat/${matchId}`);
  await expect(tid(pageB, "chat-ended").or(tid(pageB, "chat-input-disabled"))).toBeVisible({ timeout: 20_000 });
  await shot(pageB, "phase1-B", "chat-ended");
});
