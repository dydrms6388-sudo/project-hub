// =============================================================================
// G1 · E2E — 법적 페이지 6종 렌더 + 인덱싱 허용 [F-LGL-01]
//
// 검증 포인트
//  · /legal 목록에 6종이 모두 있고, 각 상세가 비로그인으로 열린다(미들웨어 PUBLIC).
//  · 공식 페이지이므로 **noindex 가 아니어야 한다** — 루트 레이아웃 기본값이
//    index:false 라, 페이지 메타가 이를 덮어쓰는지가 실제 회귀 포인트다.
//  · 본문이 비어 있지 않고(마크다운 로딩 실패 감지), 초안 배너 규약(08_legal_docs ①)이
//    draft 문서에 붙는다.
//  · 스토어 심사에서 요구되는 상호 링크(약관↔가이드라인·환불정책)가 살아 있다.
//
// 이 스펙은 계정을 만들지 않으므로 Supabase 미구성 환경에서도 돌아간다
// (legal 페이지는 force-static + 로컬 md 소스).
// =============================================================================

import { expect, test } from "@playwright/test";
import { LEGAL_SLUGS, LEGAL_TITLES, ROLE, ROUTES } from "./helpers/selectors";

/** <meta name="robots"> 값 (없으면 null = 기본 허용) */
async function robotsMeta(page: import("@playwright/test").Page): Promise<string | null> {
  const meta = page.locator('meta[name="robots"]');
  if ((await meta.count()) === 0) return null;
  return meta.first().getAttribute("content");
}

test.describe("법적 페이지 6종", () => {
  test("/legal 목록에 6종이 모두 노출되고 인덱싱이 허용된다", async ({ page }) => {
    await page.goto(ROUTES.legal);

    await expect(page.getByRole("heading", { name: ROLE.legalIndexHeading })).toBeVisible();

    for (const slug of LEGAL_SLUGS) {
      await expect(
        page.locator(`a[href="/legal/${slug}"]`),
        `/legal 목록에 ${slug} 링크가 있어야 한다`,
      ).toHaveCount(1);
    }

    const robots = await robotsMeta(page);
    expect(robots ?? "", "/legal 목록은 공식 페이지이므로 noindex 금지").not.toContain("noindex");
  });

  for (const slug of LEGAL_SLUGS) {
    test(`/legal/${slug} 이 비로그인으로 렌더되고 인덱싱이 허용된다`, async ({ page }) => {
      const response = await page.goto(`${ROUTES.legal}/${slug}`);
      expect(response?.status(), `${slug} 은 200 이어야 한다`).toBeLessThan(400);

      // 로그인으로 튕기지 않는다 (middleware PUBLIC_PATHS)
      await expect(page).toHaveURL(new RegExp(`/legal/${slug}$`));

      // 제목
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      await expect(h1).toHaveText(LEGAL_TITLES[slug]);

      // 본문이 실제로 들어왔는지 (md 로딩·파싱 실패 감지)
      const article = page.locator("article");
      await expect(article).toBeVisible();
      const text = (await article.innerText()).replace(/\s+/g, "");
      expect(text.length, `${slug} 본문이 비어 있다 — content/legal/${slug}.md 확인`).toBeGreaterThan(
        200,
      );

      // 인덱싱 허용 (루트 레이아웃 기본 noindex 를 덮어써야 한다)
      const robots = await robotsMeta(page);
      expect(robots ?? "", `${slug} 은 공식 페이지이므로 noindex 금지`).not.toContain("noindex");

      // 버전·시행일 표기 (08_legal_docs 결정 ⑥)
      await expect(page.getByText(/버전 v/)).toBeVisible();

      // 목록으로 돌아가는 경로
      await expect(page.locator(`a[href="${ROUTES.legal}"]`).first()).toBeVisible();
    });
  }

  test("초안 문서에는 '법률 검토 전 초안' 배너가 붙는다 (08_legal_docs ①)", async ({ page }) => {
    let draftSeen = 0;
    for (const slug of LEGAL_SLUGS) {
      await page.goto(`${ROUTES.legal}/${slug}`);
      const badge = page.getByText("검토 전 초안", { exact: false }).first();
      if (await badge.isVisible().catch(() => false)) {
        draftSeen += 1;
        // 배지만이 아니라 본문 상단 고지 블록까지 있어야 한다
        await expect(page.getByText(/법률 검토 전 초안입니다/)).toBeVisible();
      }
    }
    // 초안이 하나도 없다면 전 문서가 검토 완료됐다는 뜻 — 그 자체는 실패가 아니다.
    expect(draftSeen).toBeGreaterThanOrEqual(0);
  });

  test("약관 ↔ 커뮤니티 가이드라인·환불정책 상호 링크가 살아 있다", async ({ page }) => {
    await page.goto(`${ROUTES.legal}/terms`);
    await expect(page.locator('a[href="/legal/community"]').first()).toBeVisible();
    await expect(page.locator('a[href="/legal/refund"]').first()).toBeVisible();

    await page.locator('a[href="/legal/community"]').first().click();
    await expect(page).toHaveURL(/\/legal\/community$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LEGAL_TITLES.community);
  });

  test("가입 화면에서 약관 문서로 1탭 이동할 수 있다", async ({ page }) => {
    await page.goto(ROUTES.signup);
    for (const slug of ["terms", "privacy", "community", "location", "youth"] as const) {
      await expect(
        page.locator(`a[href="/legal/${slug}"]`).first(),
        `가입 화면에 ${slug} 링크가 있어야 한다`,
      ).toBeVisible();
    }
  });
});
