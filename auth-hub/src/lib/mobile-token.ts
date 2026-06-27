import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ─────────────────────────────────────────────────────────────
// 네이티브(React Native/Expo) 클라이언트용 베어러 토큰.
// 웹은 Auth.js 의 암호화 세션 쿠키(JWE)를 쓰지만, 네이티브 앱은 쿠키를
// 공유할 수 없으므로 별도의 서명 JWT(HS256)를 발급해 AsyncStorage 에 저장하고
// Authorization: Bearer <token> 헤더로 허브 API를 호출한다.
//
// 시크릿: MOBILE_JWT_SECRET (없으면 AUTH_SECRET 로 폴백). 둘 다 없으면 발급/검증 실패.
// ─────────────────────────────────────────────────────────────

const ISSUER = "tomatoeggcat-hub";
const AUDIENCE = "tomatoeggcat-native";
// 네이티브 토큰 수명(앱은 만료 전 재로그인). 기본 30일.
const TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): Uint8Array {
  const raw = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error("MOBILE_JWT_SECRET (or AUTH_SECRET) is not configured");
  }
  return new TextEncoder().encode(raw);
}

export interface MobileTokenClaims extends JWTPayload {
  uid: string;
  email?: string | null;
  name?: string | null;
}

/** 로그인된 사용자에 대해 네이티브용 베어러 JWT 를 발급. */
export async function mintMobileToken(user: {
  id: string;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  return new SignJWT({ email: user.email ?? null, name: user.name ?? null })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

/** 베어러 토큰을 검증하고 클레임을 반환. 실패 시 null. */
export async function verifyMobileToken(
  token: string
): Promise<MobileTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (!payload.sub) return null;
    return { ...payload, uid: payload.sub } as MobileTokenClaims;
  } catch {
    return null;
  }
}

/** Authorization 헤더에서 Bearer 토큰 문자열만 추출. */
export function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}
