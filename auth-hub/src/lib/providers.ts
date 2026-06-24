import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

// ─────────────────────────────────────────────────────────────
// 커스텀 OAuth 프로바이더 — 카카오 / 네이버
// Auth.js v5(next-auth)의 OAuth provider 형식을 직접 구성한다.
// Google 은 next-auth/providers/google 내장 프로바이더를 auth.ts 에서 사용.
// ─────────────────────────────────────────────────────────────

interface KakaoProfile {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
}

/**
 * 카카오 로그인.
 * 콘솔: https://developers.kakao.com
 * - 카카오 로그인 활성화 + Redirect URI 등록: {AUTH_URL}/api/auth/callback/kakao
 * - 동의항목: 닉네임/프로필사진(profile_nickname, profile_image), 이메일(account_email) 동의
 * - 보안 → Client Secret 사용함(코드) → KAKAO_CLIENT_SECRET
 */
export function Kakao(
  config: OAuthUserConfig<KakaoProfile>
): OAuthConfig<KakaoProfile> {
  return {
    id: "kakao",
    name: "Kakao",
    type: "oauth",
    authorization: {
      url: "https://kauth.kakao.com/oauth/authorize",
      params: { scope: "profile_nickname profile_image account_email" },
    },
    token: "https://kauth.kakao.com/oauth/token",
    userinfo: "https://kapi.kakao.com/v2/user/me",
    profile(profile) {
      const account = profile.kakao_account;
      return {
        id: String(profile.id),
        name:
          account?.profile?.nickname ?? profile.properties?.nickname ?? null,
        email: account?.email ?? null,
        image:
          account?.profile?.profile_image_url ??
          profile.properties?.profile_image ??
          null,
      };
    },
    style: { brandColor: "#FEE500", text: "#000000" },
    ...config,
  };
}

interface NaverProfile {
  resultcode: string;
  message: string;
  response: {
    id: string;
    nickname?: string;
    name?: string;
    email?: string;
    profile_image?: string;
  };
}

/**
 * 네이버 로그인.
 * 콘솔: https://developers.naver.com
 * - 애플리케이션 등록 → 사용 API: 네이버 로그인
 * - Callback URL 등록: {AUTH_URL}/api/auth/callback/naver
 * - 제공 정보: 이메일/이름/별명/프로필사진
 */
export function Naver(
  config: OAuthUserConfig<NaverProfile>
): OAuthConfig<NaverProfile> {
  return {
    id: "naver",
    name: "Naver",
    type: "oauth",
    authorization: {
      url: "https://nid.naver.com/oauth2.0/authorize",
      params: { scope: "name email profile_image" },
    },
    token: "https://nid.naver.com/oauth2.0/token",
    userinfo: "https://openapi.naver.com/v1/nid/me",
    profile(profile) {
      const r = profile.response;
      return {
        id: r.id,
        name: r.name ?? r.nickname ?? null,
        email: r.email ?? null,
        image: r.profile_image ?? null,
      };
    },
    style: { brandColor: "#03C75A", text: "#FFFFFF" },
    ...config,
  };
}
