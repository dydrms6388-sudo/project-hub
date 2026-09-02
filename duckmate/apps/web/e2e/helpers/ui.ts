import { expect, test, type Locator, type Page } from "@playwright/test";

export const tid = (page: Page, id: string): Locator => page.getByTestId(id);

/** Radix Select: 트리거 클릭 → 리스트박스에서 옵션 텍스트 선택 */
export async function selectRadixOption(page: Page, triggerTestId: string, optionText: string): Promise<void> {
  await tid(page, triggerTestId).click();
  const option = page.getByRole("option", { name: optionText, exact: false }).first();
  await expect(option).toBeVisible();
  await option.click();
}

/** Radix Select 옵션을 data-testid 로 선택 */
export async function selectRadixOptionByTestId(page: Page, triggerTestId: string, optionTestId: string): Promise<void> {
  await tid(page, triggerTestId).click();
  const option = tid(page, optionTestId).first();
  await expect(option).toBeVisible();
  await option.click();
}

/** 접근성 기본: html lang, 제목(h1 — strictH1=false 면 h1|h2|role=heading 허용 + h1 부재 annotation), 버튼 접근 가능한 이름 */
export async function expectBasicA11y(page: Page, opts: { strictH1?: boolean } = {}): Promise<void> {
  const strictH1 = opts.strictH1 ?? true;
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  if (strictH1) {
    await expect(page.locator("h1").first()).toBeVisible();
  } else {
    await expect(page.locator("h1, h2, h3, [role=heading]").first()).toBeVisible();
    if ((await page.locator("h1").count()) === 0) test.info().annotations.push({ type: "a11y", description: `h1 없음: ${page.url()}` });
  }
  const unnamed = await page.evaluate(() => {
    const out: string[] = [];
    for (const b of Array.from(document.querySelectorAll("button, a[role=button], [role=button]"))) {
      const el = b as HTMLElement;
      const labelledBy = el.getAttribute("aria-labelledby");
      const byRef = labelledBy ? (document.getElementById(labelledBy)?.textContent ?? "") : "";
      // <label for=id> 연결(Radix RadioGroupItem/Checkbox 는 button 이라 .labels 로 접근 가능한 이름을 얻는다)
      const labels = "labels" in el && (el as HTMLButtonElement).labels ? Array.from((el as HTMLButtonElement).labels ?? []).map((l) => l.textContent ?? "").join("") : "";
      const name = (el.getAttribute("aria-label") ?? "") + (el.textContent ?? "") + (el.getAttribute("title") ?? "") + byRef + labels;
      const img = el.querySelector("img[alt]:not([alt=''])");
      if (name.trim().length === 0 && !img) out.push(el.outerHTML.slice(0, 120));
    }
    return out;
  });
  expect(unnamed, "버튼에 접근 가능한 이름이 없음").toEqual([]);
}

/** 리다이렉트 없이 상태·Location 만 확인 */
export async function probe(page: Page, path: string): Promise<{ status: number; location: string | null }> {
  const res = await page.request.get(path, { maxRedirects: 0 });
  return { status: res.status(), location: res.headers()["location"] ?? null };
}
