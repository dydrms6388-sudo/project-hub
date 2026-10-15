// =============================================================================
// G1 · 가입 → 온보딩 7스텝 → (선택) 본인인증 Lv2 헬퍼
//
// 12_flows §2 의 스텝 순서를 그대로 밟는다:
//   /signup → age(가입 폼에 통합) → phone(스텁) → hobbies → quiz → duckcard →
//   photo(스킵) → mode → /home
//
// 스텁 인증 규약 (lib/auth/identity-verifier.ts · onboarding/phone/actions.ts):
//   · IDENTITY_VERIFIER=stub 일 때만 confirmPhoneVerification 이 통과한다.
//   · 인증번호 자체는 검증하지 않는다(서버가 6자리 형식만 본다) → "123456" 사용.
//   · /verify 의 "본인인증 시작하기" 도 같은 StubVerifier 를 태워 Lv2 로 승급한다.
// =============================================================================

import { expect, type Locator, type Page } from "@playwright/test";
import type { TestAccount } from "./accounts";
import { ROLE, ROUTES, TID } from "./selectors";

const STUB_OTP = "123456";

function tid(page: Page, id: string): Locator {
  return page.getByTestId(id);
}

// ---------------------------------------------------------------------------
// 1. 가입 (연령 게이트 포함)
// ---------------------------------------------------------------------------

export interface SignUpOverrides {
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
}

/** /signup 폼을 채우기만 한다(제출 안 함). age-gate 스펙이 재사용한다. */
export async function fillSignupForm(
  page: Page,
  account: TestAccount,
  overrides: SignUpOverrides = {},
): Promise<void> {
  await expect(tid(page, TID.signupForm)).toBeVisible();

  await tid(page, TID.signupEmail).fill(account.email);
  await tid(page, TID.signupPassword).fill(account.password);
  await tid(page, TID.signupNickname).fill(account.nickname);

  await tid(page, TID.signupBirthYear).fill(overrides.birthYear ?? account.birthYear);
  await tid(page, TID.signupBirthMonth).fill(overrides.birthMonth ?? account.birthMonth);
  await tid(page, TID.signupBirthDay).fill(overrides.birthDay ?? account.birthDay);

  await tid(page, TID.signupGender).selectOption(account.gender);
  await tid(page, TID.signupRegion).selectOption(account.regionCode);

  // 필수 동의 3종만 체크한다 — 선택 동의를 미리 켜면 다크패턴 검증이 무의미해진다.
  await tid(page, TID.consentTerms).check();
  await tid(page, TID.consentPrivacy).check();
  await tid(page, TID.consentCommunity).check();
}

/** 가입 완료 → /onboarding/phone 도달까지 */
export async function signUp(page: Page, account: TestAccount): Promise<void> {
  await page.goto(ROUTES.signup);
  await fillSignupForm(page, account);

  await expect(tid(page, TID.signupSubmit)).toBeEnabled();
  await tid(page, TID.signupSubmit).click();

  // 이메일 확인이 켜져 있으면 세션이 없어 /login 으로 튕긴다 → 사전조건 위반을 즉시 알린다.
  await expect(
    page,
    "가입 후 /onboarding/phone 으로 이동해야 한다. /login 이면 Supabase 의 'Confirm email' 을 끌 것.",
  ).toHaveURL(new RegExp(`${ROUTES.onboardingPhone}$`), { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 2. 휴대폰 인증 (스텁)
// ---------------------------------------------------------------------------

export async function passPhoneStub(page: Page, account: TestAccount): Promise<void> {
  await expect(tid(page, TID.stepPhone)).toBeVisible();
  // 스텁 모드 배너가 떠 있어야 한다 = IDENTITY_VERIFIER=stub 이 앱에 실제로 먹혔다는 증거
  await expect(tid(page, TID.phoneStubNotice)).toBeVisible();

  await tid(page, TID.phoneInput).fill(account.phone);
  await tid(page, TID.phoneRequest).click();

  await expect(tid(page, TID.phoneCode)).toBeVisible();
  await tid(page, TID.phoneCode).fill(STUB_OTP);
  await tid(page, TID.phoneSubmit).click();

  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingHobbies}$`), { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 3. 취미 선택
// ---------------------------------------------------------------------------

/**
 * 취미 칩 N개 선택. 칩 testid 는 `hobby-chip-<uuid>` 라 고정 상수가 없으므로
 * 카탈로그의 앞에서부터 N개를 고른다(두 계정이 같은 순서로 고르면 태그가 겹쳐
 * 궁합 점수가 올라간다 → 매칭 스펙에서 서로 추천에 뜰 확률이 커진다).
 *
 * 선택 시 폼이 rank 1·2·3 을 자동 배정하므로(hobbies-form.tsx: nextRank) 정확히
 * 3개를 고르면 Top3 조건이 자동 충족된다.
 */
export async function pickHobbies(page: Page, count = 3): Promise<string[]> {
  await expect(tid(page, TID.stepHobbies)).toBeVisible();

  const chips = page.locator(`[data-testid^="${TID.hobbyChipPrefix}"]`);
  await expect(
    chips.first(),
    "취미 카탈로그가 비어 있다 — hobbies 시드(00005_seed.sql)가 적용됐는지 확인할 것.",
  ).toBeVisible({ timeout: 20_000 });

  const picked: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const chip = chips.nth(i);
    const label = (await chip.innerText()).trim();
    await chip.click();
    picked.push(label);
  }

  // 3개 도달 = 다음 버튼 활성 (12_flows §결정-5)
  await expect(tid(page, TID.hobbiesSubmit)).toBeEnabled();
  await tid(page, TID.hobbiesSubmit).click();

  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingQuiz}$`), { timeout: 30_000 });
  return picked;
}

// ---------------------------------------------------------------------------
// 4. 궁합 퀴즈 10문항
// ---------------------------------------------------------------------------

/**
 * 문항당 1탭, 선택 즉시 다음 문항. 마지막 문항 응답 시 자동 제출된다.
 * @param choice 0~3 (두 계정이 같은 값을 고르면 축 벡터가 같아 궁합이 높아진다)
 */
export async function answerQuiz(page: Page, choice = 0): Promise<void> {
  await expect(tid(page, TID.stepQuiz)).toBeVisible();
  await expect(tid(page, TID.quizForm)).toBeVisible();

  // 문항 수는 서버 시드(quiz_questions)가 정한다 — 진행 라벨에서 총 문항 수를 읽는다.
  const label = await tid(page, TID.quizProgressLabel).innerText();
  const total = Number(label.match(/\/\s*(\d+)/)?.[1] ?? 10);
  expect(total, "퀴즈 문항 수는 10문항이어야 한다 (F-ONB-06)").toBe(10);

  for (let i = 0; i < total; i += 1) {
    const option = tid(page, `${TID.quizOptionPrefix}${choice}`);
    await expect(option).toBeVisible();
    await option.click();
    if (i < total - 1) {
      // 다음 문항으로 넘어갔는지 진행 라벨로 확인 (자동 전환)
      await expect(tid(page, TID.quizProgressLabel)).toContainText(`${i + 2}/${total}`);
    }
  }

  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingDuckcard}$`), { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 5. 덕질카드
// ---------------------------------------------------------------------------

export async function fillDuckcard(
  page: Page,
  fav = "최애는 비밀이에요",
  obsession = "요즘 신작 정주행 중이에요",
): Promise<void> {
  await expect(tid(page, TID.stepDuckcard)).toBeVisible();
  await tid(page, TID.duckcardFav).fill(fav);
  await tid(page, TID.duckcardObsession).fill(obsession);
  await tid(page, TID.duckcardSubmit).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingPhoto}$`), { timeout: 30_000 });
}

/** '나중에 채우기' 경로 (스킵 허용 스텝 2개 중 하나) */
export async function skipDuckcard(page: Page): Promise<void> {
  await expect(tid(page, TID.stepDuckcard)).toBeVisible();
  await tid(page, TID.duckcardSkip).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingPhoto}$`), { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 6. 사진 (스킵)
// ---------------------------------------------------------------------------

export async function skipPhoto(page: Page): Promise<void> {
  await expect(tid(page, TID.stepPhoto)).toBeVisible();
  // 사진 0장 상태에서만 "사진 없이 시작하기" 가 렌더된다 (다크패턴 금지 규약)
  await expect(tid(page, TID.photoSkip)).toBeVisible();
  await tid(page, TID.photoSkip).click();
  await expect(page).toHaveURL(new RegExp(`${ROUTES.onboardingMode}$`), { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 7. 모드 선택 → /home
// ---------------------------------------------------------------------------

export async function chooseMode(page: Page, mode: "friend" | "dating" = "friend"): Promise<void> {
  await expect(tid(page, TID.stepMode)).toBeVisible();
  await tid(page, `${TID.modeRadioPrefix}${mode}`).check();
  await tid(page, TID.modeSubmit).click();

  if (mode === "dating") {
    // Lv<2 로 데이팅을 고르면 흐름을 끊지 않고 friend 로 저장 + /verify CTA 를 남긴다
    const cta = tid(page, TID.modeVerifyCta);
    if (await cta.isVisible().catch(() => false)) {
      await tid(page, TID.modeStartHome).click();
    }
  }

  await expect(page).toHaveURL(new RegExp(`${ROUTES.home}$`), { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 8. 본인인증 Lv2 승급 (스텁)
// ---------------------------------------------------------------------------

/**
 * /verify 에서 스텁 인증을 태워 Lv1 → Lv2 로 올린다.
 * 매칭·채팅은 **양쪽 모두 Lv2** 여야 열린다(12_flows §3.6 / A5 §1.2).
 */
export async function verifyToLevel2(page: Page): Promise<void> {
  await page.goto(ROUTES.verify);
  const start = page.getByRole("button", { name: ROLE.verifyStartButton });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect(page.getByText(ROLE.verifyDoneText)).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 전체 코스
// ---------------------------------------------------------------------------

export interface OnboardOptions {
  /** 취미 선택 개수 (기본 3 = 최소치) */
  hobbyCount?: number;
  /** 퀴즈 선택지 인덱스 — 두 계정을 같은 값으로 맞추면 궁합이 높아진다 */
  quizChoice?: number;
  /** 덕질카드를 채울지('나중에 채우기' 대신) */
  fillCard?: boolean;
  /** 완료 후 /verify 스텁으로 Lv2 승급 */
  verify?: boolean;
}

/** 가입부터 /home 까지 한 번에. 매칭 스펙이 계정 2개를 만들 때 쓴다. */
export async function completeOnboarding(
  page: Page,
  account: TestAccount,
  options: OnboardOptions = {},
): Promise<void> {
  const { hobbyCount = 3, quizChoice = 0, fillCard = true, verify = false } = options;

  await signUp(page, account);
  await passPhoneStub(page, account);
  await pickHobbies(page, hobbyCount);
  await answerQuiz(page, quizChoice);
  if (fillCard) {
    await fillDuckcard(page);
  } else {
    await skipDuckcard(page);
  }
  await skipPhoto(page);
  await chooseMode(page, "friend");

  if (verify) await verifyToLevel2(page);
}

/** 이미 가입된 계정으로 로그인 */
export async function login(page: Page, account: TestAccount, next = ROUTES.home): Promise<void> {
  await page.goto(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
  await tid(page, TID.loginEmail).fill(account.email);
  await tid(page, TID.loginPassword).fill(account.password);
  await tid(page, TID.loginSubmit).click();
  await expect(page).toHaveURL(new RegExp(`${next}(\\?.*)?$`), { timeout: 30_000 });
}
