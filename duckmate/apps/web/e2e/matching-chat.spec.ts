// =============================================================================
// G1 · E2E — 추천 조회 → 좋아요 → 상호 좋아요 → 매칭 → 채팅 첫 메시지 → 신고
//        (PRD 필수 E2E: 가입→인증→매칭→채팅→신고 의 뒷부분)
//
// 구조: 브라우저 컨텍스트 2개(A·B)를 한 파일 안에서 직렬로 굴린다. 매칭은 두
// 계정의 상태가 서로 얽혀 있어 순서를 보장해야 하므로 serial 모드다.
//
// 전제 (28_e2e.md §사전조건):
//   1) 살아 있는 Supabase + IDENTITY_VERIFIER=stub
//   2) SUPABASE_SERVICE_ROLE_KEY — daily-recommendations 를 즉시 재발행하기 위함.
//      추천 큐가 없으면 /discover 에 상대가 뜨지 않는다.
//   3) 양측 Lv2 (스텁 본인인증) — 매칭·채팅은 Lv2 게이트다 (A5 §1.2).
// =============================================================================

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { makeAccount, type TestAccount } from "./helpers/accounts";
import { checkLiveBackendEnv, functionsAccess } from "./helpers/env";
import { completeOnboarding } from "./helpers/onboarding";
import { enterChatFromReveal, likeInQueue, refreshRecommendations } from "./helpers/matching";
import { ROLE, ROUTES, TID } from "./helpers/selectors";

test.describe.configure({ mode: "serial" });

// 사전조건은 파일 스코프에서 판정한다 — beforeAll 이 계정을 만들기 전에 걸러야 한다.
const envReport = checkLiveBackendEnv();
test.skip(
  !envReport.ok || functionsAccess() === null,
  `실행 환경 미구성 — 필요: ${[...envReport.missing, "SUPABASE_SERVICE_ROLE_KEY"].join(", ")}. ` +
    "docs/agents/28_e2e.md §사전조건 참고.",
);

const FIRST_MESSAGE = "안녕하세요! 덕질카드 보고 취향이 비슷해서 말 걸어요.";

let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;
let userA: TestAccount;
let userB: TestAccount;
let matchId: string | null = null;

test.beforeAll(async ({ browser }) => {
  userA = makeAccount("a");
  userB = makeAccount("b");

  ctxA = await browser.newContext();
  ctxB = await browser.newContext();
  pageA = await ctxA.newPage();
  pageB = await ctxB.newPage();

  // 두 계정을 같은 취미·같은 퀴즈 응답으로 만든다 → 궁합 점수가 높아 서로의
  // 추천 큐 상위에 오를 확률이 커진다(추천은 서버 알고리즘 소관이라 강제는 못 한다).
  await completeOnboarding(pageA, userA, { hobbyCount: 3, quizChoice: 0, verify: true });
  await completeOnboarding(pageB, userB, { hobbyCount: 3, quizChoice: 0, verify: true });

  // 방금 만든 계정이 서로의 오늘자 추천에 들어가도록 발행 잡을 지금 실행한다.
  await refreshRecommendations();
});

test.afterAll(async () => {
  await ctxA?.close();
  await ctxB?.close();
});

test("1. 추천 큐를 열면 카드가 보이고, A 가 B 에게 좋아요를 보낸다", async () => {
  const outcome = await likeInQueue(pageA, userB.nickname);

  test.skip(
    outcome === "not-found",
    `A 의 추천 큐에서 B(${userB.nickname}) 카드를 찾지 못했다 — ` +
      "추천 알고리즘(D3)이 이 조합을 발행하지 않았을 수 있다. 28_e2e.md §미결 2 참고.",
  );

  // 아직 B 는 A 를 좋아하지 않았으므로 매칭이 아니라 '접수' 상태여야 한다.
  expect(outcome, "일방 좋아요는 매칭이 아니다").toBe("sent");
});

test("2. B 가 A 에게 좋아요를 보내면 상호 좋아요 → 매칭 리빌이 뜬다", async () => {
  const outcome = await likeInQueue(pageB, userA.nickname);

  test.skip(
    outcome === "not-found",
    `B 의 추천 큐에서 A(${userA.nickname}) 카드를 찾지 못했다 — 28_e2e.md §미결 2 참고.`,
  );
  expect(
    outcome,
    "양측 Lv2 상태의 상호 좋아요는 즉시 매칭돼야 한다 (pending 이면 인증 레벨을 확인할 것)",
  ).toBe("matched");

  // 리빌 모달 규약: 헤드라인 + 첫 대화 제안 + 안전 안내 1줄 (12_flows §3.4)
  await expect(pageB.getByText(ROLE.revealHeadline)).toBeVisible();
  await expect(pageB.getByText(/금전 요구·외부 링크 유도는 신고해 주세요/)).toBeVisible();
});

test("3. 제안 카드를 눌러 대화방에 들어가 첫 메시지를 보낸다", async () => {
  matchId = await enterChatFromReveal(pageB);

  // 대화방 상단 마스킹 상태 바 — 연락처는 72h + 양측 Lv2 전까지 가려진다 (D4-7)
  await expect(pageB.getByTestId(TID.chatMaskingNotice)).toBeVisible();

  const composer = pageB.getByTestId(TID.chatComposerInput);
  await expect(composer, "Lv2 양측이면 입력창이 열려 있어야 한다").toBeVisible();

  await composer.fill(FIRST_MESSAGE);
  await pageB.getByTestId(TID.chatSend).click();

  const messages = pageB.getByTestId(TID.chatMessage);
  await expect(messages.last()).toContainText(FIRST_MESSAGE, { timeout: 30_000 });
  await expect(messages.last()).toHaveAttribute("data-mine", "true");
});

test("4. A 의 채팅 목록에 방이 생기고 B 의 첫 메시지가 보인다", async () => {
  test.skip(matchId === null, "이전 단계에서 매칭이 성립하지 않았다");

  await pageA.goto(ROUTES.chat);
  await expect(pageA.getByTestId(TID.chatList)).toBeVisible();

  const room = pageA.getByTestId(TID.chatRoomItem).filter({ hasText: userB.nickname }).first();
  await expect(room, "첫 메시지가 온 방은 '대화 중' 목록에 있어야 한다").toBeVisible({
    timeout: 30_000,
  });
  await room.click();

  await expect(pageA.getByTestId(TID.chatRoom)).toHaveAttribute("data-match-id", matchId!);
  await expect(pageA.getByTestId(TID.chatMessage).last()).toContainText(FIRST_MESSAGE);
  // 수신 메시지는 상대 것
  await expect(pageA.getByTestId(TID.chatMessage).last()).toHaveAttribute("data-mine", "false");
});

test("5. 대화방에서 2탭 이내로 신고 시트를 열고 접수한다 (F-SAF-01)", async () => {
  test.skip(matchId === null, "이전 단계에서 매칭이 성립하지 않았다");

  // ⋮ 1탭 → [신고하기] 2탭 (A5 부록: 어디서든 2탭 이내)
  await pageA.getByTestId(TID.chatMenuButton).click();
  await expect(pageA.getByTestId(TID.chatMenu)).toBeVisible();
  await pageA.getByTestId(TID.chatMenuReport).click();

  const sheet = pageA.getByTestId(TID.reportSheet);
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-step", "category");

  // ① 카테고리 9종 → 사기
  await expect(pageA.getByTestId(TID.reportCategory)).toHaveCount(9);
  await pageA.getByTestId(TID.reportCategory).filter({ hasText: "사기" }).first().click();

  // ② 세부 사유 → 금전 요구
  await expect(sheet).toHaveAttribute("data-step", "reason");
  await pageA.locator(`[data-testid="${TID.reportReason}"][data-code="SCAM_MONEY"]`).click();

  // ③ 상세 입력 — 대화 자동 첨부 고지가 반드시 있어야 한다 (A5 §4.2)
  await expect(sheet).toHaveAttribute("data-step", "detail");
  await expect(pageA.getByText(/자동으로 함께 첨부돼요/)).toBeVisible();
  await pageA.getByTestId(TID.reportDetail).fill("금전을 요구하는 메시지를 받았어요. (E2E 테스트)");
  await pageA.getByTestId(TID.reportSubmit).click();

  // ④ 접수 확인 — 24h SLA + 상대 미통지 고지
  await expect(sheet).toHaveAttribute("data-step", "done", { timeout: 30_000 });
  await expect(pageA.getByText(/24시간 이내에 검토·조치/)).toBeVisible();
  await expect(pageA.getByText(/신고 사실은 상대에게 알리지 않아요/)).toBeVisible();
  // 차단 원클릭 경로가 같은 화면에 있어야 한다
  await expect(pageA.getByTestId(TID.reportBlock)).toBeVisible();
});

test("6. 신고 후 차단하면 목록에서 사라진다 (F-SAF-05)", async () => {
  test.skip(matchId === null, "이전 단계에서 매칭이 성립하지 않았다");

  await pageA.getByTestId(TID.reportBlock).click();

  // 차단 완료 → 호출부가 대화 목록으로 되돌린다
  await expect(pageA).toHaveURL(new RegExp(`${ROUTES.chat}`), { timeout: 30_000 });
  await expect(
    pageA.getByTestId(TID.chatRoomItem).filter({ hasText: userB.nickname }),
  ).toHaveCount(0);
});
