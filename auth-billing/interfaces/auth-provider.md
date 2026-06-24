# Auth Provider 인터페이스 설계

실제 Auth 라이브러리(Clerk, NextAuth, Supabase Auth)를 갈아끼울 수 있도록
추상화 레이어 설계. 실제 SDK 연동은 사용자가 구현.

---

## IAuthProvider

```typescript
// 허브 Auth 서버가 구현해야 할 인터페이스
interface IAuthProvider {
  /**
   * 소셜 로그인 URL 생성
   * @param provider - 'google' | 'kakao' | 'naver'
   * @param redirectUri - 콜백 URL
   */
  getAuthUrl(provider: string, redirectUri: string): Promise<string>;

  /**
   * OAuth 콜백 처리 — 코드를 액세스 토큰으로 교환
   * @param provider - 소셜 제공자
   * @param code - OAuth authorization code
   * @returns 내부 User 객체 (DB upsert 포함)
   */
  handleCallback(provider: string, code: string): Promise<User>;

  /**
   * 허브 JWT 발급
   * @param user - DB에서 조회한 User
   * @returns 서명된 JWT 문자열
   */
  issueJwt(user: User): Promise<string>;

  /**
   * JWT 검증 및 파싱
   * @param token - Authorization 헤더의 Bearer 토큰
   * @returns 파싱된 JwtPayload 또는 null (검증 실패)
   */
  verifyJwt(token: string): Promise<JwtPayload | null>;

  /**
   * 세션 종료 (로그아웃)
   * @param userId
   */
  revokeSession(userId: string): Promise<void>;
}
```

---

## IUserRepository

```typescript
// DB 접근 추상화 (Supabase 등 교체 가능)
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  upsert(data: Partial<User>): Promise<User>;
  updatePlan(userId: string, plan: Plan): Promise<void>;
  updateCredits(userId: string, delta: number): Promise<number>; // 새 잔액 반환
}
```

---

## 마이크로서비스 미들웨어 인터페이스

```typescript
// 각 마이크로서비스의 Next.js middleware.ts 또는 API 라우트에서 사용할 헬퍼
// 실제 구현은 공유 유틸 패키지로 배포하거나 각 서비스에 복붙

interface AuthMiddlewareOptions {
  /** 플랜 게이트: 이 플랜 이상만 허용 */
  requirePlan?: Plan;
  /** 크레딧 게이트: 최소 잔액 */
  requireCredits?: number;
  /** true면 로그인 없어도 통과 (AdSense 공개 페이지용) */
  allowGuest?: boolean;
}

// 사용 예시 (설계 의도 표현)
// export default withAuth(handler, { requirePlan: 'pro' });
// export default withAuth(handler, { requireCredits: 1 });
// export default withAuth(handler, { allowGuest: true });
```

---

## Clerk 사용 시 매핑 메모

Clerk를 사용하면 `IAuthProvider` 대부분을 Clerk SDK가 대신 처리함.
- `getAuthUrl` → Clerk `<SignIn />` 컴포넌트
- `handleCallback` → Clerk 자동 처리
- `issueJwt` → Clerk `getToken()` (커스텀 claim 추가 가능)
- `verifyJwt` → Clerk `verifyToken()`
- 남은 작업: Clerk 웹훅(`user.created`, `user.updated`)으로 Supabase DB 동기화
