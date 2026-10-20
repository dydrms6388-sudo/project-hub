import { z } from "zod";
import {
  ACTIVE_TIMES,
  BODY_TYPES,
  DRINKING,
  EXPIRY_CHOICES,
  INTERESTS,
  PERSONALITIES,
  POSITIONS,
  PURPOSES,
  SMOKING,
  STYLES,
  VISIBILITY_FIELDS,
  values,
} from "@/lib/domain/options";
import { isValidSido, isValidSigungu } from "@/lib/domain/regions";
import { cleanText, findPersonalInfo, PERSONAL_INFO_MESSAGES } from "./text";

/** 청소년보호법 기준: 만 19세가 되는 해의 1월 1일부터 성인 → 출생연도 ≤ 올해 - 19 */
export function maxAdultBirthYear(now = new Date()): number {
  return now.getFullYear() - 19;
}

export function ageFromBirthYear(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const nickname = z
  .string()
  .transform(cleanText)
  .pipe(
    z
      .string()
      .min(2, "닉네임은 2자 이상이에요.")
      .max(16, "닉네임은 16자 이하예요.")
      .regex(/^[가-힣A-Za-z0-9_. ]+$/, "닉네임은 한글·영문·숫자·공백·_ . 만 쓸 수 있어요."),
  )
  .refine((v) => findPersonalInfo(v) === null, "닉네임에 연락처를 넣을 수 없어요.");

const birthYear = z.coerce
  .number({ error: "출생연도를 입력해 주세요." })
  .int()
  .min(1930, "출생연도를 확인해 주세요.")
  .refine((y) => y <= maxAdultBirthYear(), "BETWEEN 은 성인(만 19세가 되는 해 이후)만 이용할 수 있어요.");

const regionFields = {
  sido: z.string().refine(isValidSido, "시/도를 선택해 주세요."),
  sigungu: z.preprocess(emptyToNull, z.string().nullable()),
  dong: z.preprocess(
    emptyToNull,
    z
      .string()
      .transform(cleanText)
      .pipe(z.string().max(20).regex(/^[가-힣0-9]{1,18}(동|읍|면|가|리)$/, "동/읍/면 이름만 입력해 주세요. (예: 역삼동)"))
      .nullable(),
  ),
};

function refineRegion(
  v: { sido: string; sigungu: string | null; dong: string | null },
  ctx: z.RefinementCtx,
) {
  if (v.sigungu && !isValidSigungu(v.sido, v.sigungu)) {
    ctx.addIssue({ code: "custom", path: ["sigungu"], message: "시/군/구를 다시 선택해 주세요." });
  }
  if (v.dong && !v.sigungu) {
    ctx.addIssue({ code: "custom", path: ["dong"], message: "동을 입력하려면 시/군/구를 먼저 선택해 주세요." });
  }
}

/** 첫 방문: 성인 확인 + 필수 고지 동의 + 최소 3개 필드 */
export const onboardingSchema = z
  .object({
    nickname,
    birthYear,
    ...regionFields,
    adultConfirmed: z.literal(true, { error: "성인 확인이 필요해요." }),
    privacyConsent: z.literal(true, { error: "개인정보 수집·이용 동의가 필요해요." }),
    sensitiveConsent: z.literal(true, {
      error: "BETWEEN 이용 사실 자체가 민감정보에 해당할 수 있어 별도 동의가 필요해요.",
    }),
    // 봇 방지 허니팟 (사람은 비워 둔다)
    website: z.string().max(0).optional().default(""),
  })
  .superRefine(refineRegion);
export type OnboardingInput = z.input<typeof onboardingSchema>;
export type Onboarding = z.output<typeof onboardingSchema>;

const optionalEnum = <T extends string>(list: [T, ...T[]]) => z.preprocess(emptyToNull, z.enum(list).nullable());
const multi = <T extends string>(list: [T, ...T[]], max: number) =>
  z
    .array(z.enum(list))
    .max(max)
    .default([])
    .transform((a) => [...new Set(a)]);
const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .int()
      .min(min, `${label}은(는) ${min}~${max} 사이로 입력해 주세요.`)
      .max(max, `${label}은(는) ${min}~${max} 사이로 입력해 주세요.`)
      .nullable(),
  );

export const visibilitySchema = z
  .partialRecord(z.enum(VISIBILITY_FIELDS), z.enum(["public", "private"]))
  .default({});

export const profileUpdateSchema = z
  .object({
    nickname,
    birthYear,
    ...regionFields,
    height: optionalInt(140, 220, "키"),
    weight: optionalInt(35, 200, "몸무게"),
    bodyType: optionalEnum(values(BODY_TYPES)),
    position: optionalEnum(values(POSITIONS)),
    styles: multi(values(STYLES), 5),
    personality: multi(values(PERSONALITIES), 5),
    interests: multi(values(INTERESTS), 10),
    purposes: multi(values(PURPOSES), 8),
    activeTimes: multi(values(ACTIVE_TIMES), 6),
    smoking: optionalEnum(values(SMOKING)),
    drinking: optionalEnum(values(DRINKING)),
    bio: z.preprocess(
      emptyToNull,
      z
        .string()
        .transform(cleanText)
        .pipe(z.string().max(500, "자기소개는 500자 이하예요."))
        .nullable(),
    ),
    visibility: visibilitySchema,
    // 세부 성향 정보 공개를 위한 별도 동의 (온보딩 동의와 분리)
    positionConsent: z.boolean().default(false),
    isHidden: z.boolean().default(false),
    expiresInDays: z.coerce
      .number()
      .int()
      .refine((d) => EXPIRY_CHOICES.some((c) => c.days === d), "만료 기간을 다시 선택해 주세요.")
      .default(0),
  })
  .superRefine((v, ctx) => {
    refineRegion(v, ctx);
    if (v.bio) {
      const issue = findPersonalInfo(v.bio);
      if (issue) ctx.addIssue({ code: "custom", path: ["bio"], message: PERSONAL_INFO_MESSAGES[issue] });
    }
    if (v.position && !v.positionConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["positionConsent"],
        message: "성향 정보를 저장하려면 민감정보 별도 동의가 필요해요.",
      });
    }
  });
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;

/** zod 에러 → { field: message } (폼 표시용, 필드당 첫 메시지) */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
