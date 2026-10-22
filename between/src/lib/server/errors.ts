// Server Action 공통 결과 타입
export type ActionResult<T = null> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super("요청이 너무 많아요. 잠시 후 다시 시도해 주세요.", 429);
  }
}

export class AuthError extends AppError {
  constructor(message = "세션이 만료됐어요. 다시 시작해 주세요.") {
    super(message, 401);
  }
}

const KNOWN: Record<string, string> = {
  ADULT_ONLY: "성인만 이용할 수 있어요.",
  PHOTO_LIMIT: "사진은 최대 5장까지 올릴 수 있어요.",
  PREFERENCE_LIMIT: "필터는 최대 10개까지 저장할 수 있어요.",
  NOW_REQUIRES_EXPIRY: "'지금 가능' 은 최대 6시간까지 설정할 수 있어요.",
  EXPIRY_TOO_FAR: "만료 기간을 다시 선택해 주세요.",
  FORBIDDEN: "권한이 없어요.",
};

/** 내부 에러를 사용자 메시지로 변환 (스택/SQL 등 내부 정보는 노출하지 않음) */
export function toUserMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  for (const [k, v] of Object.entries(KNOWN)) if (msg.includes(k)) return v;
  const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
  if (code === "42501") return "권한이 없어요.";
  if (code === "23505") return "이미 처리된 요청이에요.";
  if (code === "23514") return "입력값을 다시 확인해 주세요.";
  console.error("[between] unexpected error", e);
  return "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
}
