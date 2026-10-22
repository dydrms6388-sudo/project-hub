import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { findProfileId, go, newUser, onboard, uniq } from "./helpers";

// 브리프의 12단계 핵심 흐름: 두 개의 독립 브라우저 컨텍스트(A, B) + 제3자(C)
test.describe.configure({ mode: "serial" });

test("첫 방문 → 등록 → 사진 → 탐색 → 필터 → 스와이프 → 좋아요 → 매칭 → 메신저 → 수정 → 삭제", async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const A = await newUser(browser, testInfo, errors);
  const B = await newUser(browser, testInfo, errors);
  const C = await newUser(browser, testInfo, errors);
  const nameA = uniq(testInfo, "에이");
  const nameB = uniq(testInfo, "비");
  const nameC = uniq(testInfo, "씨");

  // 1. 첫 방문: / → /start
  await go(A.page, "/");
  await A.page.waitForURL("**/start");

  // 2. 성인 안내 + 필수 동의 강제 + 미성년 출생연도 선택 불가
  await expect(A.page.getByText("성인 전용 서비스")).toBeVisible();
  await A.page.getByTestId("start-submit").click();
  await expect(A.page.getByText("성인 확인이 필요해요.")).toBeVisible();
  await expect(A.page).toHaveURL(/\/start$/);
  const kstYear = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
  await expect(A.page.locator(`#birthYear option[value="${kstYear - 18}"]`)).toHaveCount(0);
  await expect(A.page.locator(`#birthYear option[value="${kstYear - 19}"]`)).toHaveCount(1);

  // 3. 프로필 등록 (최소 입력)
  await onboard(A.page, nameA);
  await onboard(B.page, nameB);
  await onboard(C.page, nameC, "부산", "해운대구");

  // 4. 사진 업로드 (EXIF 포함 JPEG → 서버에서 정화)
  const jpeg = await sharp({ create: { width: 640, height: 800, channels: 3, background: { r: 140, g: 70, b: 220 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "E2E" } })
    .toBuffer();
  await go(B.page, "/me");
  await B.page
    .getByTestId("photo-upload-input")
    .setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(B.page.getByTestId("my-photo")).toHaveCount(1, { timeout: 20_000 });
  const img = B.page.getByTestId("my-photo").locator("img").first();
  await expect(img).toHaveJSProperty("complete", true);
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // 5. 다른 사용자 탐색
  const idB = await findProfileId(A.page, nameB);

  // 6. 조건 필터: 부산만 → B(서울) 제외, C(부산) 포함 → 초기화
  await A.page.getByTestId("filter-button").click();
  const sheet = A.page.getByRole("dialog");
  await sheet.getByRole("button", { name: "부산", exact: true }).click();
  await sheet.getByTestId("filter-apply").click();
  await expect(A.page.getByRole("dialog")).toBeHidden();
  await expect(A.page).toHaveURL(/sido=%EB%B6%80%EC%82%B0|sido=부산/);
  await expect(A.page.getByTestId("profile-card").filter({ hasText: nameC })).toBeVisible();
  await expect(A.page.getByTestId("profile-card").filter({ hasText: nameB })).toHaveCount(0);
  await A.page.getByTestId("filter-button").click();
  await expect(A.page.getByRole("dialog")).toBeVisible();
  await A.page.getByRole("dialog").getByTestId("filter-reset").click();
  await A.page.getByRole("dialog").getByTestId("filter-apply").click();
  await expect(A.page.getByTestId("profile-card").filter({ hasText: nameB })).toBeVisible();

  // 7. 스와이프: C 의 덱에서 드래그 제스처로 패스 1회 + 버튼 패스
  await go(C.page, "/swipe");
  const card = C.page.getByTestId("swipe-card");
  await expect(card).toBeVisible();
  const before = await card.innerText();
  await expect(C.page.getByTestId("swipe-undo")).toBeDisabled();
  const box = (await card.boundingBox())!;
  await C.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await C.page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await C.page.mouse.move(box.x + box.width / 2 - i * 25, box.y + box.height / 2, { steps: 2 });
  await C.page.mouse.up();
  await expect(C.page.getByTestId("swipe-card").or(C.page.getByTestId("swipe-empty"))).toBeVisible();
  // 드래그 스와이프가 기록되면 되돌리기가 활성화되고 다음 카드로 바뀐다
  await expect(C.page.getByTestId("swipe-undo")).toBeEnabled();
  if (await C.page.getByTestId("swipe-card").isVisible()) {
    expect(await C.page.getByTestId("swipe-card").innerText()).not.toBe(before);
  }

  // 8. 좋아요: A → B (상세 화면)
  await go(A.page, `/p/${idB}`);
  await A.page.getByTestId("detail-like").click();
  await expect(A.page.getByTestId("swipe-state")).toHaveText("좋아요를 보냈어요");

  // 10-a. B 가 '매칭 상대만' 카카오 오픈채팅 등록 (매칭 전) + 위험 링크 거부
  await go(B.page, "/me");
  const kakao = B.page.getByTestId("contact-kakao_openchat");
  await kakao.getByRole("textbox").fill("https://open.kakao.com/o/sBetween1");
  await B.page.getByTestId("contact-save-kakao_openchat").click();
  await expect(B.page.getByText(/저장했어요|등록했어요/).first()).toBeVisible();
  const link = B.page.getByTestId("contact-link");
  await link.getByRole("textbox").fill("javascript:alert(1)");
  await B.page.getByTestId("contact-save-link").click();
  await expect(link.getByRole("alert")).toBeVisible();
  await B.page.reload();
  await expect(B.page.getByTestId("contact-link").getByRole("textbox")).toHaveValue("");

  // 제3자 C 는 매칭 전용 연락처를 볼 수 없다
  await go(C.page, `/p/${idB}`);
  await expect(C.page.getByTestId("profile-name")).toContainText(nameB);
  await expect(C.page.getByTestId("contact-kakao_openchat")).toHaveCount(0);

  // 9. 상호 매칭: B 가 받은 좋아요에서 좋아요 → 매칭
  await go(B.page, "/likes?tab=received");
  const row = B.page.getByTestId("received-list").locator("li").filter({ hasText: nameA });
  await row.getByTestId("like-back").click();
  await expect(B.page.getByText(`${nameA}님과 매칭됐어요!`)).toBeVisible();
  await go(A.page, "/likes?tab=matches");
  await expect(A.page.getByTestId("match-list")).toContainText(nameB);

  // 10-b. 매칭 후 A 는 B 의 카카오 오픈채팅으로 연결
  await A.context.route("https://open.kakao.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/html", body: "kakao" }),
  );
  await A.page.getByTestId("match-list").locator("li").filter({ hasText: nameB }).getByTestId("match-contact").click();
  await expect(A.page.getByTestId("matched-banner")).toBeVisible();
  await A.page.getByTestId("contact-kakao_openchat").click();
  const popupPromise = A.context.waitForEvent("page");
  await A.page.getByTestId("contact-open").click();
  const popup = await popupPromise;
  await popup.waitForURL("https://open.kakao.com/o/sBetween1");
  await popup.close();

  // 11. 프로필 수정 (A)
  await go(A.page, "/me/edit");
  await A.page.getByLabel("자기소개").fill("주말엔 한강에서 러닝해요");
  await A.page.getByLabel("키", { exact: true }).fill("178");
  await A.page.getByTestId("save-profile").click();
  await A.page.waitForURL("**/me");
  const idA = await findProfileId(B.page, nameA);
  await go(B.page, `/p/${idA}`);
  await expect(B.page.getByText("주말엔 한강에서 러닝해요")).toBeVisible();
  await expect(B.page.getByText(/178cm/)).toBeVisible();

  // 12. 프로필 삭제 (B) → 다른 사용자에게서 사라짐
  await go(B.page, "/me");
  await B.page.getByTestId("delete-account").click();
  await B.page.getByTestId("delete-confirm-input").fill("삭제");
  await B.page.getByTestId("delete-confirm").click();
  await B.page.waitForURL(/\/(start)?$/);
  await go(A.page, `/p/${idB}`);
  await expect(A.page.getByText("찾을 수 없는 페이지예요")).toBeVisible();
  await go(A.page, "/likes?tab=matches");
  await expect(A.page.getByText(nameB)).toHaveCount(0);

  expect(errors, errors.join("\n")).toEqual([]);
  for (const u of [A, B, C]) await u.context.close();
});
