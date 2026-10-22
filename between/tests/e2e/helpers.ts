import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

export function uniq(testInfo: TestInfo, base: string) {
  // 프로젝트(기기)별 데이터 분리: 닉네임 규칙(한글·영문·숫자) 안에서 고유하게
  const proj = testInfo.project.name.replace(/[^a-z0-9]/gi, "").slice(0, 6);
  return `${base}${proj}${Math.random().toString(36).slice(2, 5)}`.slice(0, 16);
}

/** 콘솔 에러/페이지 에러 수집 (의도적 404 리소스 로드는 제외) */
export function watchConsole(page: Page, sink: string[]) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource: the server responded with a status of 404/.test(m.text())) return;
    sink.push(`[${page.url()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => sink.push(`[${page.url()}] PAGEERROR ${e.message}`));
}

export async function newUser(browser: Browser, testInfo: TestInfo, errors: string[]) {
  const context: BrowserContext = await browser.newContext({ ...testInfo.project.use });
  const page = await context.newPage();
  watchConsole(page, errors);
  return { context, page };
}

export async function onboard(page: Page, nickname: string, sido = "서울", sigungu = "마포구", birthYear = "1994") {
  await page.goto("/");
  await page.waitForURL("**/start");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("닉네임").fill(nickname);
  await page.locator("#birthYear").selectOption(birthYear);
  await page.locator("#sido").selectOption(sido);
  if (sigungu) await page.locator("#sigungu").selectOption(sigungu);
  await page.getByRole("button", { name: "모두 동의하기" }).click();
  await page.getByTestId("start-submit").click();
  await page.waitForURL("**/explore");
}

/** 탐색 화면에서 닉네임으로 프로필을 찾아 id 를 반환 */
export async function findProfileId(page: Page, nickname: string): Promise<string> {
  await page.goto("/explore?sort=new");
  await page.waitForLoadState("networkidle");
  const card = page.getByTestId("profile-card").filter({ hasText: nickname });
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  return href!.split("/").pop()!;
}

/** 이동 후 하이드레이션 완료까지 대기 (하이드레이션 전 입력은 React 이벤트로 전달되지 않음) */
export async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}
