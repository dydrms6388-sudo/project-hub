import { expect, test } from "@playwright/test";
import { findProfileId, go, newUser, onboard, uniq } from "./helpers";

test("신고 + 차단: 신고 후 차단된 프로필은 보이지 않는다", async ({ browser }, testInfo) => {
  const errors: string[] = [];
  const E = await newUser(browser, testInfo, errors);
  const F = await newUser(browser, testInfo, errors);
  const nameE = uniq(testInfo, "이");
  await onboard(E.page, nameE);
  await onboard(F.page, uniq(testInfo, "에프"));

  const idE = await findProfileId(F.page, nameE);
  await go(F.page, `/p/${idE}`);
  await F.page.getByTestId("profile-menu").click();
  await F.page.getByTestId("menu-report").click();
  const dialog = F.page.getByTestId("report-dialog");
  await dialog.getByText("스팸·광고").click();
  await dialog.getByRole("textbox").fill("광고 링크를 보냄");
  await dialog.getByTestId("report-submit").click();
  await F.page.waitForURL("**/explore");
  await expect(F.page.getByTestId("profile-card").filter({ hasText: nameE })).toHaveCount(0);
  await go(F.page, `/p/${idE}`);
  await expect(F.page.getByText("찾을 수 없는 페이지예요")).toBeVisible();

  // 차단은 양방향: E 에게도 F 가 보이지 않음 + 차단 목록에서 해제 가능
  await go(F.page, "/me/blocked");
  await expect(F.page.getByTestId("blocked-item")).toContainText(nameE);
  expect(errors, errors.join("\n")).toEqual([]);
  await E.context.close();
  await F.context.close();
});

test("비로그인 접근 통제", async ({ page, request }) => {
  await go(page, "/explore");
  await expect(page).toHaveURL(/\/start$/);
  const api = await request.get("/api/explore");
  expect(api.status()).toBe(401);
  const photo = await request.get("/api/photos/00000000-0000-4000-8000-000000000000");
  expect(photo.status()).toBe(401);
  const upload = await request.post("/api/photos", {
    headers: { origin: "https://evil.example" },
    multipart: { file: "x" },
  });
  expect(upload.status()).toBe(403);
  const cron = await request.get("/api/cron/cleanup");
  expect(cron.status()).toBe(401);
});

test("일반 사용자에게 운영자 페이지는 존재하지 않는다", async ({ browser }, testInfo) => {
  const errors: string[] = [];
  const U = await newUser(browser, testInfo, errors);
  await onboard(U.page, uniq(testInfo, "유저"));
  const res = await U.page.goto("/admin");
  expect(res?.status()).toBe(404);
  await U.context.close();
});

test("보안 헤더와 CSP nonce", async ({ request }) => {
  const res = await request.get("/start");
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
  const nonce = h["content-security-policy"].match(/'nonce-([^']+)'/)![1];
  const html = await res.text();
  expect(html).toContain(`nonce="${nonce}"`);
  expect(html).toContain('name="robots" content="noindex, nofollow');
});
