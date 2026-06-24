# Auth 타입 설계

TypeScript 타입 초안. 실제 구현 시 `.ts` 파일로 변환.

---

## User

```typescript
// 중앙 DB(Supabase users 테이블) 기준
interface User {
  id: string;             // UUID (Clerk userId 또는 자체 생성)
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: AuthProvider; // 가입 경로
  plan: Plan;             // 현재 구독 플랜
  credits: number;        // 잔여 크레딧 (정수)
  createdAt: string;      // ISO 8601
  updatedAt: string;
}

type AuthProvider = 'google' | 'kakao' | 'naver' | 'email' | 'clerk';

type Plan = 'free' | 'pro' | 'credits_only';
```

---

## JWT Payload (허브 발급)

```typescript
// 마이크로서비스가 검증하는 JWT claim 설계
interface JwtPayload {
  sub: string;       // userId
  email: string;
  plan: Plan;
  credits: number;
  iat: number;       // issued at (Unix timestamp)
  exp: number;       // expiry (Unix timestamp) — 권장: 15분~1시간
}
```

---

## Session (서버 세션 사용 시)

```typescript
interface Session {
  sessionId: string;
  userId: string;
  plan: Plan;
  credits: number;
  expiresAt: string;
}
```

---

## AuthError

```typescript
interface AuthError {
  code: AuthErrorCode;
  message: string;
}

type AuthErrorCode =
  | 'UNAUTHENTICATED'       // 로그인 필요
  | 'FORBIDDEN_PLAN'        // 플랜 권한 부족
  | 'INSUFFICIENT_CREDITS'  // 크레딧 부족
  | 'TOKEN_EXPIRED'         // JWT 만료
  | 'TOKEN_INVALID';        // JWT 서명 불일치
```

---

## DB 테이블 설계 초안 (Supabase Postgres)

```sql
-- users 테이블
-- id: Clerk userId 또는 UUID
-- plan: free | pro | credits_only
-- credits: 정수, 기본 0
-- stripe_customer_id: Stripe Customer ID (사용자 직접 Stripe 연동 후 저장)
-- toss_customer_key: 토스페이먼츠 고객 키 (선택)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT NOT NULL DEFAULT 'google',
  plan TEXT NOT NULL DEFAULT 'free',
  credits INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  toss_customer_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
