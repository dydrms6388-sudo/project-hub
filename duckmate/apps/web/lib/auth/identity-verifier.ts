// =============================================================================
// D2 · IdentityVerifier 어댑터 (본인인증 — Lv1→Lv2 승급의 유일한 관문)
//
// - PortOneVerifier: 포트원(PASS/다날) 어댑터 뼈대. 실키 없으면 "미구성" 에러만
//   던진다 — 실연동은 Phase 4 (B3 §준비물, .env PORTONE_*).
// - StubVerifier: 개발/E2E 용. env IDENTITY_VERIFIER=stub 일 때 활성.
//   항상 성공 + 결정적 테스트 CI 반환. **프로덕션(NODE_ENV=production 이고
//   VERCEL_ENV=production)에서는 선택 자체가 에러로 차단된다** (G2-01).
//   또한 stub 은 birth_date 를 반환하지 않는다 — 연령의 진실 원천이 아니므로.
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
      // ⚠ G2-01(b) 조치: stub 은 birthDate 를 반환하지 않는다.
      //   근거 — stub 은 PASS/실명확인 기관이 아니므로 생년월일에 대한 권위가 없다.
      //   과거 구현은 "1995-01-01"(항상 성인)을 반환했고 verify.ts 가 그 값으로
      //   profiles.birth_date 를 덮어써, 가입 시 미성년이 성인으로 세탁되며
      //   만 19세 3중 게이트의 게이트 2·3 이 동시에 무력화됐다. 값을 아예 만들지
      //   않는 쪽(발신처에서 제거)이, 소비처마다 "신뢰 가능한 출처인가"를 판단하게
      //   두는 것보다 안전하다. 신뢰 출처 판정은 verify.ts 의 trusted 플래그가
      //   2차 방어선으로 함께 수행한다.
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

/**
 * 실 프로덕션 런타임 판정 (G2-01(a)).
 * `NODE_ENV=production` 만으로는 프리뷰·스테이징 빌드까지 잡히므로, Vercel 의
 * 배포 환경 구분(`VERCEL_ENV`)까지 함께 본다 — 둘 다 production 일 때만 "실서비스".
 * (VERCEL_ENV 가 없는 자체 호스팅 프로덕션은 PRODUCTION_RUNTIME=1 로 강제 표시)
 */
export function isProductionRuntime(): boolean {
  if (process.env.PRODUCTION_RUNTIME === "1") return true;
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
}

/** 프로덕션에서 stub 이 선택됐을 때 던지는 에러 코드 — 호출부가 503 으로 매핑 */
export const STUB_FORBIDDEN_ERROR =
  "STUB_VERIFIER_FORBIDDEN_IN_PRODUCTION: IDENTITY_VERIFIER=stub 은 프로덕션에서 사용할 수 없다 " +
  "(만 19세 확인이 무효화됨). PortOne 실연동을 켜거나 배포 env 를 수정할 것.";

/**
 * 활성 verifier 선택:
 *   1) email 이 REVIEW_BYPASS_EMAILS 에 있으면 → StubVerifier
 *      (B3 R2 스토어 심사용 — 프로덕션에서도 예외적으로 허용. 호출부가
 *       audit_logs 에 bypass=true 로 기록하고, verify.ts 가 birth_date 를
 *       덮어쓰지 않으므로 연령 게이트는 가입 신고값 기준으로 유지된다)
 *   2) IDENTITY_VERIFIER=stub → StubVerifier.
 *      단 **실 프로덕션에서는 경고가 아니라 예외로 차단**한다 (G2-01(a)).
 *   3) 그 외 → PortOneVerifier (미구성 시 호출 시점에 에러)
 */
export function getIdentityVerifier(email?: string | null): IdentityVerifier {
  assertServerRuntime();

  // (1) 심사 바이패스 화이트리스트는 프로덕션 차단보다 앞에서 판정한다 — B3 요구사항.
  if (isReviewBypassEmail(email)) {
    return new StubVerifier();
  }

  if (process.env.IDENTITY_VERIFIER === "stub") {
    if (isProductionRuntime()) {
      // 경고 로그로는 아무도 막히지 않는다 → 기동 자체를 실패시킨다.
      throw new Error(STUB_FORBIDDEN_ERROR);
    }
    return new StubVerifier();
  }

  return new PortOneVerifier();
}
