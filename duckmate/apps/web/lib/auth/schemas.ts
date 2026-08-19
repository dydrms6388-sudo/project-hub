// =============================================================================
// D2 · 인증/온보딩 zod 스키마 + 온보딩 스텝 순서 + 공용 결과 타입
// - actions.ts 는 "use server" 파일이라 async 함수 외 export 불가 → 스키마는 여기.
// - 온보딩 7스텝(12_flows §결정-4): age→phone→hobbies→quiz→duckcard→photo→mode→done
// =============================================================================

import { z } from "zod";
import type { OnboardingStep } from "@duckmate/db";

// ---------------------------------------------------------------------------
// Server Action 공용 결과 타입 (throw 대신 코드 반환 — E1 이 코드로 UI 분기)
// ---------------------------------------------------------------------------
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };

export type ActionErrorCode =
  | "INVALID_INPUT" // zod 검증 실패
  | "UNDERAGE" // 만 19세 미만 (가입 거부 — 입력값 미저장)
  | "AUTH_REQUIRED" // 세션 없음
  | "AUTH_FAILED" // 로그인 실패 (이메일/비밀번호 불일치 등)
  | "EMAIL_TAKEN" // 이미 가입된 이메일
  | "PROFILE_NOT_FOUND"
  | "STEP_ORDER" // 온보딩 스텝 순서 위반 (이전 스텝 미완료)
  | "CONTACT_INFO_BLOCKED" // 덕질카드에 연락처/민감정보 패턴 (R1~R4 프리체크)
  | "VERIFY_LEVEL_REQUIRED" // dating 모드 등 Lv 미달
  | "PHONE_BLOCKED" // 영구정지 재가입 차단 (blocked_hashes 히트)
  | "CI_BLOCKED" // 영구정지 재가입 차단 (blocked_hashes 히트)
  | "VERIFIER_NOT_CONFIGURED" // PortOne 실키 미구성 (Phase 4 전)
  | "VERIFY_FAILED" // 본인인증 실패/거부
  | "DB_ERROR";

export function fail(code: ActionErrorCode, message: string): ActionResult<never> {
  return { ok: false, code, message };
}

// ---------------------------------------------------------------------------
// 온보딩 스텝 순서 강제 유틸
// ---------------------------------------------------------------------------
export const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = [
  "age",
  "phone",
  "hobbies",
  "quiz",
  "duckcard",
  "photo",
  "mode",
  "done",
] as const;

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEP_ORDER.indexOf(step);
}

/** current 가 required 스텝에 "도달"했는가 (도달 = 해당 스텝 진행 중이거나 이미 지남 — 재편집 허용) */
export function hasReachedStep(current: OnboardingStep, required: OnboardingStep): boolean {
  return stepIndex(current) >= stepIndex(required);
}

/** current 가 정확히 이 스텝이면 다음 스텝을, 이미 지났으면 current 유지 (되감기 금지) */
export function nextStepAfter(current: OnboardingStep, completed: OnboardingStep): OnboardingStep {
  if (current !== completed) return current;
  const i = stepIndex(completed);
  return ONBOARDING_STEP_ORDER[Math.min(i + 1, ONBOARDING_STEP_ORDER.length - 1)] ?? "done";
}

// ---------------------------------------------------------------------------
// 만 19세 판정 (M1: 만 나이, birth_date <= today - 19y — DB CHECK 와 동일식)
// ---------------------------------------------------------------------------
export function isAdultBirthDate(birthDate: string): boolean {
  const d = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 19);
  return d.getTime() <= cutoff.getTime();
}

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일은 YYYY-MM-DD 형식이어야 해요.");

// ---------------------------------------------------------------------------
// 덕질카드 민감정보 프리체크 (12_flows §2.5 — 전화/이메일/URL/메신저ID 저장 거부)
// A5 §5.3 R1~R4 의 축약판. 채팅 마스킹(D4)과 별개의 "입력 차단" 용도.
// ---------------------------------------------------------------------------
const CONTACT_PATTERNS: RegExp[] = [
  /0[17]\s*[-–.·]?\s*\d{1,2}(\s*[-–.·]?\s*\d){6,8}/, // R1 전화번호
  /[A-Za-z0-9._%+-]+\s*(@|＠|골뱅이)\s*[A-Za-z0-9.-]+/, // R3 이메일
  /(https?:\/\/|www\.)[^\s]+/i, // R4 URL
  /(카톡|카카오톡?|ㅋㅌ|kakao|라인|line|텔레|telegram|인스타|insta|디엠|\bDM\b)\s*(아이디|ID|id|계정)/iu, // R2 메신저 키워드+식별자
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// 액션별 입력 스키마
// ---------------------------------------------------------------------------

export const signUpSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아니에요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요.").max(72),
  nickname: z.string().min(2, "닉네임은 2자 이상이에요.").max(12, "닉네임은 12자까지예요."),
  birthDate: birthDateSchema,
  gender: z.enum(["m", "f", "n"]),
  regionCode: z.string().max(10).default(""),
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.input<typeof signInSchema>;

/** 취미 3~5개 + Top3 rank(1·2·3 각 1개씩, 선택 취미 중 지정) — 12_flows §결정-5 */
export const saveHobbiesSchema = z
  .object({
    hobbies: z
      .array(
        z.object({
          hobbyId: z.string().uuid(),
          intensity: z.number().int().min(1).max(5),
          rank: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().default(null),
        })
      )
      .min(3, "취미는 최소 3개 골라야 해요.")
      .max(5, "취미는 최대 5개까지예요."),
  })
  .superRefine((v, ctx) => {
    const ids = new Set(v.hobbies.map((h) => h.hobbyId));
    if (ids.size !== v.hobbies.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "같은 취미를 중복 선택할 수 없어요." });
    }
    const ranks = v.hobbies.filter((h) => h.rank !== null).map((h) => h.rank as number);
    const rankSet = new Set(ranks);
    if (ranks.length !== 3 || rankSet.size !== 3 || ![1, 2, 3].every((r) => rankSet.has(r))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Top3 순위(1·2·3위)를 각각 1개씩 지정해야 해요.",
      });
    }
  });
export type SaveHobbiesInput = z.input<typeof saveHobbiesSchema>;

/** 궁합 퀴즈 — 정확히 10문항, 문항 중복 금지, choice = options 인덱스 0~3 */
export const saveQuizAnswersSchema = z
  .object({
    answers: z
      .array(
        z.object({
          questionId: z.number().int().positive(),
          choice: z.number().int().min(0).max(3),
        })
      )
      .length(10, "10문항 모두 응답해야 해요."),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.answers.map((a) => a.questionId)).size !== v.answers.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "같은 문항에 중복 응답할 수 없어요." });
    }
  });
export type SaveQuizAnswersInput = z.input<typeof saveQuizAnswersSchema>;

/** 덕질카드 — 최애 40자·요즘 빠진 것 80자, 개별 생략 가능('나중에 채우기') */
export const saveDuckCardSchema = z.object({
  favNote: z.string().max(40, "최애는 40자까지예요.").nullable().default(null),
  currentObsession: z.string().max(80, "80자까지 적을 수 있어요.").nullable().default(null),
});
export type SaveDuckCardInput = z.input<typeof saveDuckCardSchema>;

/** Storage 경로 규약: photos/{profile_id}/{uuid}.webp (00006_storage.sql 정책과 1:1) */
export const PHOTO_PATH_RE =
  /^photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export const savePhotoSchema = z.object({
  path: z.string().regex(PHOTO_PATH_RE, "사진 경로 규약(photos/{profile_id}/{uuid}.webp) 위반이에요."),
  isPrimary: z.boolean().default(false),
});
export type SavePhotoInput = z.input<typeof savePhotoSchema>;

export const saveModeSchema = z.object({
  mode: z.enum(["friend", "dating"]),
});
export type SaveModeInput = z.input<typeof saveModeSchema>;

/** 본인인증 confirm 페이로드 (route handler 에서 검증) */
export const verifyConfirmSchema = z.object({
  action: z.enum(["request", "confirm"]),
  payload: z.record(z.unknown()).optional(),
});
