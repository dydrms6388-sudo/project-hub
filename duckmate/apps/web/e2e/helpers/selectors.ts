// =============================================================================
// G1 · 셀렉터 상수 — 화면 파일의 data-testid 규약을 한 곳에 모은다.
//
// 규약(실제 코드에서 확인한 사실):
//  · E1(가입·온보딩) / E3(채팅) 화면은 data-testid 를 촘촘히 달아 두었다 → TID 사용.
//  · **E2(home·discover·likes) / E4(me·settings·legal·verify) 화면에는 data-testid 가
//    하나도 없다.** 그래서 그 구간만 role/텍스트 기반 셀렉터(ROLE)를 쓴다.
//    → 회귀에 약하므로 담당 에이전트가 testid 를 추가해야 한다 (28_e2e.md §미결).
//
// 여기 있는 문자열을 바꾸려면 화면 파일이 먼저 바뀌어야 한다. 테스트가 화면을
// 고치지 않는다(파일 소유권 규약).
// =============================================================================

/** data-testid 기반 (E1·E3 화면이 실제로 제공하는 것만 나열) */
export const TID = {
  // ── 가입 / 로그인 (app/(auth)) ───────────────────────────────────────────
  signupPage: "signup-page",
  signupForm: "signup-form",
  signupEmail: "signup-email",
  signupPassword: "signup-password",
  signupNickname: "signup-nickname",
  signupBirthYear: "signup-birth-year",
  signupBirthMonth: "signup-birth-month",
  signupBirthDay: "signup-birth-day",
  signupGender: "signup-gender",
  signupRegion: "signup-region",
  signupSubmit: "signup-submit",
  consentAll: "consent-all",
  consentTerms: "consent-terms",
  consentPrivacy: "consent-privacy",
  consentCommunity: "consent-community",
  ageDenied: "age-denied",
  ageDeniedConfirm: "age-denied-confirm",

  loginPage: "login-page",
  loginForm: "login-form",
  loginEmail: "login-email",
  loginPassword: "login-password",
  loginSubmit: "login-submit",

  formError: "form-error",

  // ── 온보딩 (app/onboarding) ─────────────────────────────────────────────
  onboardingProgress: "onboarding-progress",
  onboardingStepCount: "onboarding-step-count",
  onboardingBack: "onboarding-back",

  stepAge: "onboarding-step-age",
  ageForm: "age-form",
  ageYear: "age-year",
  ageMonth: "age-month",
  ageDay: "age-day",
  ageSubmit: "age-submit",

  stepPhone: "onboarding-step-phone",
  phoneForm: "phone-form",
  phoneStubNotice: "phone-stub-notice",
  phoneInput: "phone-input",
  phoneRequest: "phone-request",
  phoneCode: "phone-code",
  phoneSubmit: "phone-submit",
  phoneResend: "phone-resend",

  stepHobbies: "onboarding-step-hobbies",
  hobbiesForm: "hobbies-form",
  hobbySearch: "hobby-search",
  hobbyCatalog: "hobby-catalog",
  hobbySelected: "hobby-selected",
  hobbiesSubmit: "hobbies-submit",
  /** 칩 id 는 hobbies 테이블의 UUID 라 고정 상수가 없다 — 접두 매칭으로 쓴다. */
  hobbyChipPrefix: "hobby-chip-",

  stepQuiz: "onboarding-step-quiz",
  quizForm: "quiz-form",
  quizProgressLabel: "quiz-progress-label",
  quizQuestion: "quiz-question",
  quizOptions: "quiz-options",
  quizPrev: "quiz-prev",
  /** 4지선다 — quiz-option-0 ~ quiz-option-3 */
  quizOptionPrefix: "quiz-option-",

  stepDuckcard: "onboarding-step-duckcard",
  duckcardForm: "duckcard-form",
  duckcardTop3: "duckcard-top3",
  duckcardFav: "duckcard-fav",
  duckcardObsession: "duckcard-obsession",
  duckcardSubmit: "duckcard-submit",
  duckcardSkip: "duckcard-skip",

  stepPhoto: "onboarding-step-photo",
  photoUploader: "photo-uploader",
  photoSlots: "photo-slots",
  photoAdd: "photo-add",
  photoInput: "photo-input",
  photoNext: "photo-next",
  photoSkip: "photo-skip",

  stepMode: "onboarding-step-mode",
  modeForm: "mode-form",
  modeSubmit: "mode-submit",
  modeVerifyCta: "mode-verify-cta",
  modeVerifyLink: "mode-verify-link",
  modeStartHome: "mode-start-home",
  /** mode-radio-friend / mode-radio-dating */
  modeRadioPrefix: "mode-radio-",
  modeOptionPrefix: "mode-option-",

  // ── 채팅 (app/(main)/chat) ─────────────────────────────────────────────
  chatList: "chat-list",
  chatEmpty: "chat-empty",
  chatNewMatchStrip: "chat-new-match-strip",
  chatNewMatchItem: "chat-new-match-item",
  chatRoomItem: "chat-room-item",

  chatRoom: "chat-room",
  chatBack: "chat-back",
  chatMessages: "chat-messages",
  chatMessage: "chat-message",
  chatComposerInput: "chat-composer-input",
  chatComposerDisabled: "chat-composer-disabled",
  chatSend: "chat-send",
  chatSuggestions: "chat-suggestions",
  chatSuggestionCard: "chat-suggestion-card",
  chatMaskingNotice: "chat-masking-notice",
  chatNotice: "chat-notice",
  chatConnection: "chat-connection",

  chatMenuButton: "chat-menu-button",
  chatMenu: "chat-menu",
  chatMenuReport: "chat-menu-report",
  chatMenuBlock: "chat-menu-block",
  chatBlockDialog: "chat-block-dialog",
  chatBlockConfirm: "chat-block-confirm",

  chatSafetyCard: "chat-safety-card",
  chatSafetyReport: "chat-safety-report",

  reportSheet: "chat-report-sheet",
  reportCategory: "chat-report-category",
  reportReason: "chat-report-reason",
  reportDetail: "chat-report-detail",
  reportError: "chat-report-error",
  reportSubmit: "chat-report-submit",
  reportBlock: "chat-report-block",
  reportClose: "chat-report-close",
} as const;

/**
 * data-testid 가 아직 없는 화면(E2·E4)용 접근성/텍스트 셀렉터.
 * 전부 `role + name` 이거나 화면에 고정된 한국어 문구다. testid 가 붙으면 이 블록을
 * 지우고 TID 로 옮긴다.
 */
export const ROLE = {
  // /discover — recommendation-stack.tsx (aria-label 이 닉네임을 포함한다)
  discoverHeading: "오늘의 추천",
  likeButtonSuffix: "님에게 좋아요 보내기",
  superLikeButtonSuffix: "님에게 슈퍼라이크 보내기",
  passButtonSuffix: "님 패스",
  discoverDetailLink: "프로필 자세히 보기",

  // /discover/[profileId] — profile-like-actions.tsx
  profileDetailHeadingRole: "heading" as const,

  // 매칭 리빌 모달 — match-reveal-host.tsx
  revealHeadline: "취향이 통했어요!",
  revealSuggestionHeading: "이런 얘기로 시작해보세요",
  revealLater: "나중에 할래요",

  // /likes
  likesHeading: "받은 관심",
  likesEmptyTitle: "아직 조용하네요",
  likesGoDiscover: "오늘의 추천 보기",

  // /home
  homeVerifyCta: "인증하기",

  // /verify — verify-start.tsx
  verifyStartButton: "본인인증 시작하기",
  verifyDoneText: "본인인증이 완료됐어요.",

  // /legal
  legalIndexHeading: "약관 및 정책",
} as const;

/** 법적 페이지 6종 — lib/legal/documents.ts LEGAL_SLUGS 와 동일 순서 */
export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "location",
  "youth",
  "community",
  "refund",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** /legal 목록 카드에 노출되는 제목(= content/legal/*.md frontmatter title) */
export const LEGAL_TITLES: Record<LegalSlug, RegExp> = {
  terms: /이용약관/,
  privacy: /개인정보/,
  location: /위치/,
  youth: /청소년/,
  community: /커뮤니티/,
  refund: /환불/,
};

/** 온보딩 라우트 (12_flows §0 라우트 트리 — 임의 개명 금지) */
export const ROUTES = {
  landing: "/",
  login: "/login",
  signup: "/signup",
  legal: "/legal",
  onboardingAge: "/onboarding/age",
  onboardingPhone: "/onboarding/phone",
  onboardingHobbies: "/onboarding/hobbies",
  onboardingQuiz: "/onboarding/quiz",
  onboardingDuckcard: "/onboarding/duckcard",
  onboardingPhoto: "/onboarding/photo",
  onboardingMode: "/onboarding/mode",
  home: "/home",
  discover: "/discover",
  likes: "/likes",
  chat: "/chat",
  me: "/me",
  verify: "/verify",
  settings: "/settings",
  sanctioned: "/sanctioned",
} as const;
