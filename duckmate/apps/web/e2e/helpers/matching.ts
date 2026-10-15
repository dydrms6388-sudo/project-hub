// =============================================================================
// G1 · 추천 큐 발행 · 좋아요 · 매칭 리빌 헬퍼
//
// 왜 발행 호출이 필요한가:
//   `/discover` 는 `daily_recommendations` 행이 있어야 카드를 보여준다. 그 행은
//   KST 06:00 cron 이 도는 edge function `daily-recommendations` 가 만든다.
//   E2E 는 계정을 방금 만들었으므로 큐가 비어 있다 → 같은 함수를 service role 로
//   직접 호출해 **테스트 시점에 재발행**한다 (백필 아님, 오늘자 재실행).
//
// 이 경로가 막힌 환경(서비스 키 없음)에서는 requireFunctionsAccess() 가 skip 시킨다.
// =============================================================================

import { expect, request as playwrightRequest, type Page } from "@playwright/test";
import { functionsAccess } from "./env";
import { ROLE, ROUTES, TID } from "./selectors";

/**
 * daily-recommendations 를 지금 실행해 오늘자 추천을 (재)발행한다.
 * @returns 함수 응답 본문 (통계). 호출 불가 환경이면 null.
 */
export async function refreshRecommendations(): Promise<unknown | null> {
  const access = functionsAccess();
  if (!access) return null;

  const ctx = await playwrightRequest.newContext();
  try {
    const res = await ctx.post(`${access.functionsUrl}/daily-recommendations`, {
      headers: {
        Authorization: `Bearer ${access.serviceRoleKey}`,
        "content-type": "application/json",
      },
      data: {},
      timeout: 60_000,
    });
    expect(
      res.ok(),
      `daily-recommendations 호출 실패 (${res.status()}): ${await res.text()}`,
    ).toBeTruthy();
    return await res.json();
  } finally {
    await ctx.dispose();
  }
}

export type LikeOutcome = "matched" | "sent" | "pending" | "not-found";

/**
 * /discover 큐를 훑어 특정 닉네임의 카드를 찾아 좋아요를 보낸다.
 * 카드마다 버튼 aria-label 이 `<닉네임>님에게 좋아요 보내기` 이므로 그것으로 식별한다.
 * (E2 화면에 data-testid 가 없어 role/name 셀렉터를 쓴다 — 28_e2e.md §미결 1)
 */
export async function likeInQueue(
  page: Page,
  nickname: string,
  maxCards = 12,
): Promise<LikeOutcome> {
  await page.goto(ROUTES.discover);

  for (let i = 0; i < maxCards; i += 1) {
    const exhausted = page.getByText("오늘의 추천을 모두 봤어요");
    const preparing = page.getByText("취향이 겹치는 분을 찾고 있어요");
    if (
      (await exhausted.isVisible().catch(() => false)) ||
      (await preparing.isVisible().catch(() => false))
    ) {
      return "not-found";
    }

    const likeButton = page.getByRole("button", { name: `${nickname}${ROLE.likeButtonSuffix}` });
    if (await likeButton.isVisible().catch(() => false)) {
      await likeButton.click();

      // 매칭 성립 → 전역 리빌 모달
      const reveal = page.getByText(ROLE.revealHeadline);
      if (await reveal.isVisible({ timeout: 10_000 }).catch(() => false)) return "matched";

      // 양측 Lv2 미달 → 매칭 보류 안내 (§8.5)
      if (await page.getByText("상대가 본인인증을 완료하면 매칭돼요.").isVisible().catch(() => false)) {
        return "pending";
      }
      return "sent";
    }

    // 다른 사람 카드 → 패스하고 다음 카드로
    const passButton = page.getByRole("button", { name: new RegExp(`${ROLE.passButtonSuffix}$`) });
    if (!(await passButton.isVisible().catch(() => false))) return "not-found";
    await passButton.click();
    await page.waitForTimeout(300);
  }

  return "not-found";
}

/**
 * 매칭 리빌 모달에서 첫 대화 제안 카드를 탭해 대화방으로 진입한다.
 * (탭 = /chat/{matchId}?suggestion=N 딥링크 — E2→E3 규약)
 */
export async function enterChatFromReveal(page: Page): Promise<string> {
  await expect(page.getByText(ROLE.revealHeadline)).toBeVisible();

  const suggestionHeading = page.getByText(ROLE.revealSuggestionHeading);
  if (await suggestionHeading.isVisible().catch(() => false)) {
    // 제안 카드 3개 중 첫 번째
    await suggestionHeading.locator("xpath=following::button[1]").click();
  } else {
    // 제안이 비어 있으면 "나중에 할래요" 로 닫고 채팅 목록의 새 매칭 스트립으로
    await page.getByRole("button", { name: ROLE.revealLater }).click();
    await page.goto(ROUTES.chat);
    await page.getByTestId(TID.chatNewMatchItem).first().click();
  }

  await expect(page.getByTestId(TID.chatRoom)).toBeVisible({ timeout: 30_000 });
  const matchId = await page.getByTestId(TID.chatRoom).getAttribute("data-match-id");
  expect(matchId, "대화방에 data-match-id 가 있어야 한다").toBeTruthy();
  return matchId as string;
}
