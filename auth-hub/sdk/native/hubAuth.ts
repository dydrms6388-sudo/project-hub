// ════════════════════════════════════════════════════════════════════
// hubAuth.ts — 네이티브(React Native/Expo) 앱용 허브 SSO 클라이언트
//
// 각 앱의 `lib/hubAuth.ts` 로 복사. 의존성:
//   expo-web-browser, expo-linking, @react-native-async-storage/async-storage
// 흐름:
//   1) loginWithHub() → 허브 /mobile/issue 를 인앱 브라우저로 연다.
//   2) 사용자가 카카오/네이버/구글로 허브 로그인 → 허브가 앱 스킴으로 토큰 전달
//      (myapp://auth#token=<jwt>).
//   3) 토큰을 AsyncStorage 에 저장 → 이후 getMe()/API 호출에 Bearer 로 첨부.
//
// app.json 에 scheme 등록 필요(예: "scheme": "nyangstat").
// 허브 ENV: ALLOWED_MOBILE_SCHEMES 에 해당 scheme 추가.
// ════════════════════════════════════════════════════════════════════

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HUB_URL =
  process.env.EXPO_PUBLIC_HUB_URL || "https://tomatoeggcat.com";
const TOKEN_KEY = "hub.token";

export interface HubUser {
  id: string;
  name: string | null;
  email: string | null;
  plan: "FREE" | "PRO";
  credits: number;
}

function parseTokenFromUrl(url: string): string | null {
  // myapp://auth#token=<jwt>  또는  ...?token=<jwt>
  const hash = url.split("#")[1];
  const query = url.split("?")[1]?.split("#")[0];
  for (const part of [hash, query]) {
    if (!part) continue;
    const m = /(?:^|&)token=([^&]+)/.exec(part);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/** 허브 로그인 → 토큰 저장. 성공 시 토큰, 취소/실패 시 null. */
export async function loginWithHub(): Promise<string | null> {
  // 앱 스킴 기반 리다이렉트 URL (예: nyangstat://auth)
  const redirectUrl = Linking.createURL("auth");
  const authUrl = `${HUB_URL}/mobile/issue?redirect=${encodeURIComponent(
    redirectUrl
  )}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
  if (result.type !== "success" || !result.url) return null;

  const token = parseTokenFromUrl(result.url);
  if (!token) return null;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function isLoggedIn(): Promise<boolean> {
  return Boolean(await getToken());
}

/** 저장된 토큰으로 현재 사용자 조회. 토큰 만료/무효 시 자동 로그아웃 + null. */
export async function getMe(): Promise<HubUser | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${HUB_URL}/api/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      await logout();
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { authenticated: boolean; user?: HubUser };
    return data.authenticated && data.user ? data.user : null;
  } catch {
    return null;
  }
}

/** 인증이 필요한 허브 API 호출용 fetch 래퍼(Bearer 자동 첨부). */
export async function hubFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${HUB_URL}${path}`, { ...init, headers });
}

export { HUB_URL };
