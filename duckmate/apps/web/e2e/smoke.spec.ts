/**
 * 목 라우트 스모크 — Supabase 없이 항상 실행 (더미 env). `pnpm --filter @duckmate/web e2e:smoke`
 *  공개 화면 · 연령 게이트 · 법적 문서 7 · 보호 라우트 307 · /admin 404 · /dev/discover(E2) · /dev/chat(E3) · /dev/profile(E4) · 접근성 기본
 */
import { expect, test } from "@playwright/test";
import { PHONE_MESSAGE } from "./fixtures/users";
import { dataLayerEvents, shot } from "./helpers/env";
import { expectBasicA11y, probe, tid } from "./helpers/ui";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const LEGAL_SLUGS = ["terms", "privacy", "location", "youth", "community", "refund", "business"] as const;
const PROTECTED = ["/home", "/reco", "/chat", "/match/30000000-0000-4000-8000-000000000001", "/me", "/settings", "/blocks", "/report", "/verify", "/onboarding/basic"] as const;

test.describe("공개 화면", () => {
  test("/ 랜딩: CTA 2개 (시작하기 → /onboarding/age, 이미 회원 → /login)", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(tid(page, "landing")).toBeVisible();
    await expect(tid(page, "landing-start")).toHaveAttribute("href", "/onboarding/age");
    await expect(tid(page, "landing-login")).toHaveAttribute("href", "/login");
    await shot(page, "smoke", "landing");
  });

  test("/login: 로그인 OTP 화면", async ({ page }) => {
    await page.goto("/login");
    await expect(tid(page, "login-screen")).toBeVisible();
    await expect(tid(page, "phone-input")).toBeVisible();
    await expect(tid(page, "otp-request")).toBeDisabled();
  });

  test("/blocked/age: 세션 없이 렌더", async ({ page }) => {
    const res = await page.goto("/blocked/age");
    expect(res?.status()).toBe(200);
    await expect(tid(page, "blocked-age")).toBeVisible();
    await expect(tid(page, "blocked-home")).toHaveAttribute("href", "/");
  });

  test("/onboarding/age: 성인 → /onboarding/phone (드래프트 + dataLayer)", async ({ page }) => {
    await page.goto("/onboarding/age");
    await expect(tid(page, "age-screen")).toBeVisible();
    await expect(tid(page, "onb-next")).toBeDisabled();
    await tid(page, "birth-year").fill("1996");
    await tid(page, "birth-month").fill("3");
    await tid(page, "birth-day").fill("14");
    await expect(tid(page, "onb-next")).toBeEnabled();
    await tid(page, "onb-next").click();
    await page.waitForURL(/\/onboarding\/phone$/);
    await expect(tid(page, "phone-screen")).toBeVisible();
    await expect(tid(page, "consent-all")).toBeVisible();
    const events = await dataLayerEvents(page);
    // 풀 내비게이션이 아니므로 dataLayer 가 유지된다
    expect(events).toContain("onboarding_step_completed");
    await shot(page, "smoke", "onboarding-phone");
  });

  test("/onboarding/age: 미성년(2010-01-01) → 안내 상태, 계정 없음", async ({ page }) => {
    await page.goto("/onboarding/age");
    await tid(page, "birth-year").fill("2010");
    await tid(page, "birth-month").fill("1");
    await tid(page, "birth-day").fill("1");
    await tid(page, "onb-next").click();
    await expect(tid(page, "age-minor")).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/age$/);
  });

  for (const slug of LEGAL_SLUGS) {
    test(`/legal/${slug}: 200 + h1 + index`, async ({ page }) => {
      const res = await page.goto(`/legal/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    });
  }

  test("/legal 별칭(youth-policy) → 308 /legal/youth", async ({ page }) => {
    const r = await probe(page, "/legal/youth-policy");
    expect([301, 308]).toContain(r.status);
    expect(r.location).toMatch(/\/legal\/youth$/);
  });

  test("/account/delete: 비로그인 200 + noindex", async ({ page }) => {
    const res = await page.goto("/account/delete");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("게이트", () => {
  for (const path of PROTECTED) {
    test(`${path}: 세션 없음 → 307 /login?next=`, async ({ page }) => {
      const r = await probe(page, path);
      expect(r.status).toBe(307);
      expect(r.location).toMatch(/\/login\?next=/);
      expect(decodeURIComponent(r.location ?? "")).toContain(`next=${path}`);
    });
  }

  test("/admin*: 비로그인 → 404 (존재 비노출)", async ({ page }) => {
    for (const p of ["/admin", "/admin/reports"]) {
      const r = await probe(page, p);
      expect(r.status, p).toBe(404);
    }
  });

  test("/api/health: 200", async ({ page }) => {
    const res = await page.request.get("/api/health");
    expect(res.status()).toBe(200);
  });
});

test.describe("E2 /dev/discover (목 API)", () => {
  test("추천 카드 좋아요(민재) → /match 이동, 매칭 화면 제안 카드 ③ → /chat/[id]", async ({ page }) => {
    await page.goto("/dev/discover?screen=reco");
    await expect(tid(page, "reco-stack")).toBeVisible();
    const cards = tid(page, "reco-card");
    await expect(cards).toHaveCount(4);
    const first = cards.filter({ has: page.locator('[data-position="1"]') }).first().or(page.locator('[data-testid="reco-card"][data-position="1"]'));
    await expect(first).toContainText("민재");
    await shot(page, "smoke", "dev-reco");
    await first.getByTestId("reco-like").click();
    await expect(tid(page, "dev-nav")).toContainText(/\/match\/30000000-0000-4000-8000-000000000001/);
    const events = await dataLayerEvents(page);
    expect(events).toContain("like_sent");
    expect(events).toContain("match_created");

    await page.goto("/dev/discover?screen=match&safety=1");
    await expect(tid(page, "safety-modal")).toBeVisible();
    await tid(page, "safety-confirm").click();
    await expect(tid(page, "match-screen")).toBeVisible();
    await expect(tid(page, "match-suggestions")).toBeVisible();
    await shot(page, "smoke", "dev-match");
    const card3 = tid(page, "suggestion-card-3");
    const inner = card3.getByRole("button");
    if ((await inner.count()) > 0) await inner.first().click();
    else await card3.click();
    await expect(tid(page, "dev-nav")).toContainText(/\/chat\/30000000-0000-4000-8000-000000000001/);
    expect(await dataLayerEvents(page)).toContain("suggestion_selected");
  });

  test("홈 목: CTA → /reco", async ({ page }) => {
    await page.goto("/dev/discover?screen=home");
    await expect(tid(page, "home")).toBeVisible();
    await expect(tid(page, "home-cta")).toHaveAttribute("href", /\/reco/);
    await expect(tid(page, "tab-home")).toBeVisible();
  });
});

test.describe("E3 /dev/chat (목 API)", () => {
  test("전화번호 전송 → 발신자 chat-masked-note, 수신 마스킹 칩, 신고 링크 규약", async ({ page }) => {
    await page.goto("/dev/chat?view=room");
    await expect(tid(page, "chat-room")).toBeVisible();
    await expect(tid(page, "chat-partner-name")).toContainText("민재");
    // 시드 수신 메시지의 마스킹 칩
    await expect(tid(page, "chat-masked-chip").first()).toBeVisible();
    await tid(page, "chat-input").fill(PHONE_MESSAGE);
    await tid(page, "chat-send").click();
    await expect(tid(page, "chat-masked-note")).toBeVisible();
    const mine = page.locator('[data-testid="chat-message"][data-mine="true"]').last();
    await expect(mine).toContainText("010-1234-5678"); // 발신자 화면은 원문 유지
    await shot(page, "smoke", "dev-chat-masked");
    const href = await tid(page, "chat-report").getAttribute("href");
    expect(href).toMatch(new RegExp(`^/report/new\\?target=${UUID}&match=${UUID}&surface=chat$`));
    await tid(page, "chat-menu").click();
    await expect(tid(page, "chat-block")).toBeVisible();
    await expect(tid(page, "chat-menu-report")).toHaveAttribute("href", href ?? "");
    await page.keyboard.press("Escape");
    expect(await dataLayerEvents(page)).toContain("message_sent");
  });

  test("목록: 4방 + 미읽음 배지", async ({ page }) => {
    await page.goto("/dev/chat?view=list");
    await expect(tid(page, "chat-list")).toBeVisible();
    await expect(tid(page, "chat-list-item")).toHaveCount(4);
    await expect(tid(page, "chat-unread").first()).toBeVisible();
  });
});

test.describe("E4 /dev/profile (목)", () => {
  test("설정 허브: 행 링크 규약", async ({ page }) => {
    await page.goto("/dev/profile");
    await expect(tid(page, "settings-hub")).toBeVisible();
    await expect(tid(page, "settings-mode")).toHaveAttribute("href", "/settings/mode");
    await expect(tid(page, "settings-blocks")).toHaveAttribute("href", "/blocks");
    await expect(tid(page, "settings-data")).toHaveAttribute("href", "/settings/data");
    await expect(tid(page, "settings-verify")).toHaveAttribute("href", "/settings/verify");
    await expect(tid(page, "settings-logout")).toBeVisible();
    await shot(page, "smoke", "dev-settings");
  });

  test("모드 전환: 미리보기 끝까지 스크롤해야 [확인했어요] 활성 → 제출 가능", async ({ page }) => {
    await page.goto("/dev/profile?screen=mode");
    await expect(tid(page, "mode-screen")).toBeVisible();
    await expect(tid(page, "mode-submit")).toBeDisabled();
    await tid(page, "mode-dating").click();
    await tid(page, "mode-preview-open").click();
    await expect(tid(page, "mode-preview")).toBeVisible();
    const confirm = tid(page, "mode-preview-confirm");
    const scroll = tid(page, "mode-preview-scroll");
    const needsScroll = await scroll.evaluate((el) => el.scrollHeight > el.clientHeight + 8);
    if (needsScroll) {
      await expect(confirm).toBeDisabled();
      await scroll.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
    }
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(tid(page, "mode-preview")).toBeHidden();
    await expect(tid(page, "mode-submit")).toBeDisabled(); // seeking_gender 미선택
    await tid(page, "mode-seeking-any").click();
    await expect(tid(page, "mode-submit")).toBeEnabled();
    await shot(page, "smoke", "dev-mode");
  });

  test("신고: 카테고리 → 사유 → 제출(목) → 완료(차단 기본 체크) → 완료", async ({ page }) => {
    await page.goto("/dev/profile?screen=report");
    await expect(tid(page, "report-screen")).toBeVisible();
    await tid(page, "report-category-1").click();
    await expect(tid(page, "report-reason-ROMANCE_SCAM")).toBeVisible();
    await expect(tid(page, "report-submit")).toBeDisabled();
    await tid(page, "report-reason-ROMANCE_SCAM").click();
    await expect(tid(page, "report-evidence-preview")).toBeVisible();
    await tid(page, "report-detail").fill("연락처를 계속 물어봐요");
    await expect(tid(page, "report-submit")).toBeEnabled();
    await tid(page, "report-submit").click();
    await expect(tid(page, "report-done")).toBeVisible();
    await expect(tid(page, "report-done")).toContainText("24시간 안에 확인해요");
    await expect(tid(page, "report-block-check")).toHaveAttribute("data-state", "checked");
    await shot(page, "smoke", "dev-report-done");
    expect(await dataLayerEvents(page)).toContain("report_submitted");
    await tid(page, "report-finish").click();
    // 목 차단 성공 → /chat 로 이동 → 세션 없음 → /login?next=/chat
    await page.waitForURL(/\/(chat|login)/);
  });
});

test.describe("접근성 기본", () => {
  const PAGES = ["/", "/login", "/onboarding/age", "/blocked/age", "/legal/terms", "/account/delete", "/dev/discover?screen=reco", "/dev/discover?screen=match", "/dev/chat?view=room", "/dev/chat?view=list", "/dev/profile", "/dev/profile?screen=report"];
  for (const p of PAGES) {
    test(`${p}: lang=ko · h1 · 버튼 이름`, async ({ page }) => {
      await page.goto(p);
      await expectBasicA11y(page);
    });
  }
});
