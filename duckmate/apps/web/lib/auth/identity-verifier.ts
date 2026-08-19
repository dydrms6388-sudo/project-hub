// =============================================================================
// D2 · IdentityVerifier 어댑터 (본인인증 — Lv1→Lv2 승급의 유일한 관문)
//
// - PortOneVerifier: 포트원(PASS/다날) 어댑터 뼈대. 실키 없으면 "미구성" 에러만
//   던진다 — 실연동은 Phase 4 (B3 §준비물, .env PORTONE_*).
// - StubVerifier: 개발/E2E 용. env IDENTITY_VERIFIER=stub 일 때 활성.
//   항상 성공 + 결정적 테스트 CI 반환. 프로덕션에서 stub 이면 기동 시 경고.
// - 심사 바이패스(B3 결정사항 공통-2 / R2): REVIEW_BYPASS_EMAILS 화이트리스트에
//   등록된 이메일은 프로덕션에서도 Stub 경로를 탄다. 사용 시 반드시 audit_logs 에
//   기록할 것(verify.ts 승급부에서 meta.bypass=true 로 남긴다).
//
// ⚠ 이 파일은 서버 전용이다. PORTONE_API_SECRET 등을 읽으므로 클라이언트 컴포넌트
//   에서 import 금지 (next 의 "server-only" 패키지가 없어 주석+런타임 검증으로 대체).
// =============================================================================

export interface VerificationRequest {
  /** PG 인증창으로 보낼 URL (PortOne) — stub 은 undefined */
  redirectUrl?: string;
  /** 세션 토큰 (stub 은 confirm 에 그대로 되돌려준다) */
  token?: string;
}

export interface VerificationResult {
  ok: boolean;
  /** 연계정보 — 원문은 어디에도 저장 금지, verify.ts 가 즉시 해시 후 폐기 */
  ci?: string;
  /** PASS 가 반환한 생년월일 YYYY-MM-DD — 진실의 원천 (A5 §1.3-2) */
  birthDate?: string;
  /** 인증에 사용된 휴대폰 번호 (선택) */
  phone?: string;
  reason?: string;
}

export interface IdentityVerifier {
  readonly name: "portone" | "stub";
  requestVerification(userId: string): Promise<VerificationRequest>;
  confirmVerification(userId: string, payload: Record<string, unknown>): Promise<VerificationResult>;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("identity-verifier 는 서버 전용 모듈이다 — 클라이언트에서 import 금지");
  }
}

// ---------------------------------------------------------------------------
// PortOneVerifier — 어댑터만 (실연동 Phase 4)
// ---------------------------------------------------------------------------
export class PortOneVerifier implements IdentityVerifier {
  readonly name = "portone" as const;

  private assertConfigured(): void {
    assertServerRuntime();
    if (!process.env.PORTONE_API_KEY || !process.env.PORTONE_API_SECRET || !process.env.PORTONE_STORE_ID) {
      throw new Error(
        "IDENTITY_VERIFIER_NOT_CONFIGURED: PORTONE_API_KEY/SECRET/STORE_ID 미설정 — 본인인증 실연동은 Phase 4"
      );
    }
  }

  async requestVerification(_userId: string): Promise<VerificationRequest> {
    this.assertConfigured();
    // Phase 4: 포트원 본인인증 세션 생성 → 인증창 redirectUrl 반환
    throw new Error("IDENTITY_VERIFIER_NOT_IMPLEMENTED: PortOne 실연동은 Phase 4 에서 구현된다");
  }

  async confirmVerification(_userId: string, _payload: Record<string, unknown>): Promise<VerificationResult> {
    this.assertConfigured();
    // Phase 4: imp_uid 검증 API 호출 → CI/생년월일/휴대폰 추출
    throw new Error("IDENTITY_VERIFIER_NOT_IMPLEMENTED: PortOne 실연동은 Phase 4 에서 구현된다");
  }
}

// ---------------------------------------------------------------------------
// StubVerifier — 개발/E2E/심사 바이패스 전용. 항상 성공.
// ---------------------------------------------------------------------------
export class StubVerifier implements IdentityVerifier {
  readonly name = "stub" as const;

  async requestVerification(userId: string): Promise<VerificationRequest> {
    assertServerRuntime();
    return { token: `stub:${userId}` };
  }

  async confirmVerification(userId: string, payload: Record<string, unknown>): Promise<VerificationResult> {
    assertServerRuntime();
    const token = typeof payload.token === "string" ? payload.token : "";
    if (token && token !== `stub:${userId}`) {
      return { ok: false, reason: "STUB_TOKEN_MISMATCH" };
    }
    return {
      ok: true,
      // 유저별 결정적 테스트 CI — E2E 재실행에도 동일 값 (blocked_hashes 테스트 가능)
      ci: `STUB-CI-${userId}`,
      birthDate: "1995-01-01", // 항상 성인
      phone: "01000000000",
    };
  }
}

// ---------------------------------------------------------------------------
// 선택 팩토리
// ---------------------------------------------------------------------------

/** B3 R2: 심사용 바이패스 화이트리스트 (쉼표 구분, 소문자 비교) */
export function isReviewBypassEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.REVIEW_BYPASS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

let warnedStubInProduction = false;

/**
 * 활성 verifier 선택:
 *   1) IDENTITY_VERIFIER=stub → StubVerifier (프로덕션이면 경고 로그 — 1회)
 *   2) email 이 REVIEW_BYPASS_EMAILS 에 있으면 → StubVerifier (심사 바이패스,
 *      프로덕션에서도 허용 — 호출부가 audit_logs 에 bypass 기록)
 *   3) 그 외 → PortOneVerifier (미구성 시 호출 시점에 에러)
 */
export function getIdentityVerifier(email?: string | null): IdentityVerifier {
  assertServerRuntime();

  if (process.env.IDENTITY_VERIFIER === "stub") {
    if (process.env.NODE_ENV === "production" && !warnedStubInProduction) {
      warnedStubInProduction = true;
      console.warn(
        "[duckmate:auth] ⚠ IDENTITY_VERIFIER=stub 가 프로덕션에서 활성화되어 있다. " +
          "본인인증이 무조건 통과된다 — 배포 env 를 즉시 확인할 것."
      );
    }
    return new StubVerifier();
  }

  if (isReviewBypassEmail(email)) {
    return new StubVerifier();
  }

  return new PortOneVerifier();
}
