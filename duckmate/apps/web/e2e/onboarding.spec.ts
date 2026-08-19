// =============================================================================
// G1 · E2E — 가입 → 연령 확인 → 휴대폰(스텁) → 취미 → 퀴즈 → 덕질카드 → 사진(스킵)
//        → 모드  (PRD 필수 E2E 의 앞부분 · 12_flows §2)
//
// 이 스펙이 지키는 규약:
//  · 스텝 순서 강제(§결정-4) — 각 스텝 도착을 URL + data-testid 로 확인한다.
//  · 스킵 가능 스텝은 덕질카드·사진 **뿐** — 나머지 스텝의 스킵 버튼 부재를 확인한다.
//  · 다크패턴 금지 — 선택 동의를 사전 체크하지 않아도 가입이 성립해야 한다.
//  · 온보딩 중도 이탈 후 복귀 시 저장된 스텝으로 돌아와야 한다(§8.9).
// =============================================================================

import { expect, test } from "@playwright/test";
import { makeAccount } from "./helpers/accounts";
import { requireLiveBackend } from "./helpers/env";
import {
  answerQuiz,
  chooseMode,
  fillDuckcard,
  passPhoneStub,
  pickHobbies,
  signUp,
  skipPhoto,
} from "./helpers/onboarding";
import { ROUTES, TID } from "./helpers/selectors";

test.beforeEach(() => {
  requireLiveBackend();
});

test.describe("온보딩 7스텝", () => {
  test("가입부터 모드 선택까지 완주하면 /home 에 도착한다", async ({ page }) => {
    const account = makeAccount("onb");

    // ── 1/7 연령 확인 (생년월일은 가입 폼에 통합 — D2-7) ─────────────────
    await test.step("가입 + 연령 확인", async () => {
      await signUp(page, account);
    });

    // ── 2/7 휴대폰 인증 (스텁) → Lv0 → Lv1 ──────────────────────────────
    await test.step("휴대폰 인증 (스텁)", async () => {
      await expect(page.getByTestId(TID.onboardingProgress)).toBeVisible();
      await expect(page.getByTestId(TID.onboardingStepCount)).toContainText("2");
      await passPhoneStub(page, account);
    });

    // ── 3/7 취미 선택 (최소 3 · Top3 자동 배정) ─────────────────────────
    await test.step("취미 3개 선택", async () => {
      await expect(page.getByTestId(TID.onboardingStepCount)).toContainText("3");
      // 3개 고르기 전에는 다음 버튼이 잠겨 있어야 한다
      await expect(page.getByTestId(TID.hobbiesSubmit)).toBeDisabled();
      await pickHobbies(page, 3);
    });

    // ── 4/7 궁합 퀴즈 10문항 (최대 이탈 감시 구간) ──────────────────────
    await test.step("퀴즈 10문항", async () => {
      await expect(page.getByTestId(TID.onboardingStepCount)).toContainText("4");
      // "정답 없음 · 재미용" 고지는 콘텐츠 정책상 상시 노출이어야 한다
      await expect(page.getByText(/재미와 추천용/)).toBeVisible();
      await answerQuiz(page, 0);
    });

    // ── 5/7 덕질카드 ────────────────────────────────────────────────────
    await test.step("덕질카드 작성", async () => {
      await expect(page.getByTestId(TID.onboardingStepCount)).toContainText("5");
      // Top3 는 취미 스텝에서 정한 rank 가 그대로 넘어온다
      await expect(page.getByTestId(TID.duckcardTop3)).toBeVisible();
      // '나중에 채우기'(스킵) 가 존재하는 두 스텝 중 하나
      await expect(page.getByTestId(TID.duckcardSkip)).toBeVisible();
      await fillDuckcard(page);
    });

    // ── 6/7 사진 (스킵 가능) ────────────────────────────────────────────
    await test.step("사진 스킵", async () => {
      await expect(page.getByTestId(TID.onboardingStepCount)).toContainText("6");
      // 검수 안내는 업로드 '전에' 노출돼야 한다 (반려 시 배신감 방지)
      await expect(page.getByText(/검수 후 공개/)).toBeVisible();
      await skipPhoto(page);
    });

    // ── 7/7 모드 선택 → /home ───────────────────────────────────────────
    await test.step("모드 선택", async () => {
      await expect(page.getByTestId(TID.onboardingStepCount)).toContainText("7");
      // Lv1 이면 데이팅 모드는 잠금 안내가 붙는다
      await expect(page.getByTestId(`${TID.modeOptionPrefix}dating`)).toContainText(
        /본인인증 후 열려요/,
      );
      await chooseMode(page, "friend");
    });

    await expect(page).toHaveURL(new RegExp(`${ROUTES.home}$`));
  });

  test("스킵 불가 스텝(취미·퀴즈)에는 건너뛰기 수단이 없다", async ({ page }) => {
    const account = makeAccount("noskip");
    await signUp(page, account);
    await passPhoneStub(page, account);

    // 취미: 스킵 버튼 없음 + 3개 미만이면 제출 비활성
    await expect(page.getByTestId(TID.stepHobbies)).toBeVisible();
    await expect(page.getByRole("button", { name: /건너뛰기|나중에|없이 시작/ })).toHaveCount(0);
    await expect(page.getByTestId(TID.hobbiesSubmit)).toBeDisabled();

    await pickHobbies(page, 3);

    // 퀴즈: 스킵 버튼 없음(← 이전만 존재)
    await expect(page.getByTestId(TID.stepQuiz)).toBeVisible();
    await expect(page.getByRole("button", { name: /건너뛰기|나중에/ })).toHaveCount(0);
    await expect(page.getByTestId(TID.quizPrev)).toBeVisible();
  });

  test("중도 이탈 후 재진입하면 저장된 스텝으로 돌아온다 (§8.9)", async ({ page }) => {
    const account = makeAccount("resume");
    await signUp(page, account);
    await passPhoneStub(page, account);
    await pickHobbies(page, 3);

    // 지금 저장된 스텝은 quiz. 앞선 스텝으로 되돌아가려 해도 quiz 로 밀려난다.
    await page.goto(ROUTES.onboardingPhone);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingQuiz}$`));

    // 온보딩을 마치지 않은 채 /home 에 들어가려 하면 저장된 스텝으로 되돌린다.
    await page.goto(ROUTES.home);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingQuiz}$`));
  });

  test("선택 동의를 켜지 않아도 가입이 성립한다 (다크패턴 금지)", async ({ page }) => {
    const account = makeAccount("consent");
    await page.goto(ROUTES.signup);

    // 첫 진입 시 어떤 동의도 사전 체크돼 있으면 안 된다
    await expect(page.getByTestId(TID.consentAll)).not.toBeChecked();
    await expect(page.getByTestId(TID.consentTerms)).not.toBeChecked();
    await expect(page.getByTestId("consent-location")).not.toBeChecked();
    await expect(page.getByTestId("consent-marketing")).not.toBeChecked();

    await signUp(page, account);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingPhone}$`));
  });
});
