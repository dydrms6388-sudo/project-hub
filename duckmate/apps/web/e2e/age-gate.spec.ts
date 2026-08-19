// =============================================================================
// G1 · E2E — 만 19세 미만 차단 (절대 규칙 2 · A5 §1.3 · F-ONB-01/10)
//
// 3중 게이트 중 화면에서 검증 가능한 두 겹을 본다:
//   ① /onboarding/age (비로그인 연령 게이트) — 미달 시 차단 화면, 입력 미저장 고지,
//      같은 세션에서 폼 재노출 금지.
//   ② /signup 폼 — 미달 시 가입 자체가 성립하지 않고 차단 화면으로 전환.
//   (③ DB 트리거 DUCKMATE_SIGNUP_UNDERAGE 는 서버 단위 테스트 소관 — G3)
//
// 이 스펙은 **계정을 만들지 않는다**(차단이 목적). 따라서 Supabase 미구성
// 환경에서도 ①은 순수 클라이언트 검증이라 통과한다 → requireLiveBackend 를
// 걸지 않고, 계정 생성이 섞이는 케이스에만 건다.
// =============================================================================

import { expect, test } from "@playwright/test";
import { almostAdultBirth, makeAccount, underageBirth } from "./helpers/accounts";
import { fillSignupForm } from "./helpers/onboarding";
import { ROUTES, TID } from "./helpers/selectors";

test.describe("연령 게이트 (만 19세 미만 차단)", () => {
  test("/onboarding/age — 미성년 입력은 차단 화면으로 전환되고 폼이 다시 뜨지 않는다", async ({
    page,
  }) => {
    const under = underageBirth();

    await page.goto(ROUTES.onboardingAge);
    await expect(page.getByTestId(TID.stepAge)).toBeVisible();

    await page.getByTestId(TID.ageYear).fill(under.year);
    await page.getByTestId(TID.ageMonth).fill(under.month);
    await page.getByTestId(TID.ageDay).fill(under.day);
    await page.getByTestId(TID.ageSubmit).click();

    const denied = page.getByTestId(TID.ageDenied);
    await expect(denied).toBeVisible();
    await expect(denied).toContainText("만 19세 이상부터 이용할 수 있어요");
    // 입력값 미저장 고지 (A5 §1.3-1)
    await expect(denied).toContainText(/저장하지 않았어요/);

    // 같은 세션에서 재시도 폼 재노출 금지
    await expect(page.getByTestId(TID.ageForm)).toHaveCount(0);

    // [확인] → 랜딩으로
    await page.getByTestId(TID.ageDeniedConfirm).click();
    await expect(page).toHaveURL(new RegExp(`${ROUTES.landing}$`));
  });

  test("/onboarding/age — 만 19세 생일 하루 전(경계값)도 차단된다", async ({ page }) => {
    const almost = almostAdultBirth();

    await page.goto(ROUTES.onboardingAge);
    await page.getByTestId(TID.ageYear).fill(almost.year);
    await page.getByTestId(TID.ageMonth).fill(almost.month);
    await page.getByTestId(TID.ageDay).fill(almost.day);
    await page.getByTestId(TID.ageSubmit).click();

    await expect(page.getByTestId(TID.ageDenied)).toBeVisible();
  });

  test("/onboarding/age — 성인이면 /signup 으로 생년월일이 프리필된다", async ({ page }) => {
    await page.goto(ROUTES.onboardingAge);
    await page.getByTestId(TID.ageYear).fill("1995");
    await page.getByTestId(TID.ageMonth).fill("03");
    await page.getByTestId(TID.ageDay).fill("21");
    await page.getByTestId(TID.ageSubmit).click();

    await expect(page).toHaveURL(/\/signup\?birth=1995-03-21/);
    await expect(page.getByTestId(TID.signupBirthYear)).toHaveValue("1995");
    await expect(page.getByTestId(TID.signupBirthMonth)).toHaveValue("03");
    await expect(page.getByTestId(TID.signupBirthDay)).toHaveValue("21");
  });

  test("/signup — 미성년 생년월일은 가입 폼 단계에서 차단된다", async ({ page }) => {
    const account = makeAccount("under");
    const under = underageBirth();

    await page.goto(ROUTES.signup);
    await fillSignupForm(page, account, {
      birthYear: under.year,
      birthMonth: under.month,
      birthDay: under.day,
    });
    await page.getByTestId(TID.signupSubmit).click();

    const denied = page.getByTestId(TID.ageDenied);
    await expect(denied).toBeVisible();
    await expect(denied).toContainText("만 19세 이상부터 이용할 수 있어요");
    await expect(denied).toContainText(/저장하지 않았어요/);

    // 폼이 사라졌고(재시도 금지), 온보딩으로 진행되지 않았다
    await expect(page.getByTestId(TID.signupForm)).toHaveCount(0);
    await expect(page).not.toHaveURL(new RegExp(ROUTES.onboardingPhone));
  });

  test("차단 화면에는 우회 링크(가입·로그인 계속)가 없다", async ({ page }) => {
    const under = underageBirth();
    await page.goto(ROUTES.onboardingAge);
    await page.getByTestId(TID.ageYear).fill(under.year);
    await page.getByTestId(TID.ageMonth).fill(under.month);
    await page.getByTestId(TID.ageDay).fill(under.day);
    await page.getByTestId(TID.ageSubmit).click();

    await expect(page.getByTestId(TID.ageDenied)).toBeVisible();
    // 차단 화면 안에서 가입/로그인으로 이어지는 경로가 없어야 한다
    await expect(page.getByTestId(TID.ageDenied).getByRole("link")).toHaveCount(0);
  });
});
