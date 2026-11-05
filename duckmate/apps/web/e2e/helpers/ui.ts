import { expect, type Locator, type Page } from "@playwright/test";

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

/** 접근성 기본: html lang, 제목(h1 필수 — 시각적으로 숨긴 h1 도 허용, H2 가 h1~h3 허용을 되돌림), 버튼 접근 가능한 이름 */
export async function expectBasicA11y(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  // sr-only h1 은 toBeVisible 이 실패하므로(1px 클리핑) DOM 존재 + 텍스트로 판정한다
  const h1 = page.locator("h1").first();
  await expect(h1).toHaveCount(1);
  await expect(h1).not.toHaveText(/^\s*$/);
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
