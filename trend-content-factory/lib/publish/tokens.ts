// 토큰 수명 관리 (M5): Meta long-lived 토큰 50일 주기 갱신 + 만료 7일 전 알림.
// 실제 갱신 크론은 pg_cron/워커에서 이 함수를 호출. 시크릿은 Vault/env 에서만.

const GRAPH = 'https://graph.facebook.com/v21.0';

export type TokenRefreshResult = { token: string; expiresInSec: number };

/** Meta long-lived 토큰 교환/갱신 (fb_exchange_token). */
export async function refreshMetaToken(
  currentToken: string,
  appId: string,
  appSecret: string,
): Promise<TokenRefreshResult> {
  const url =
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: unknown };
    if (!json.access_token) throw new Error(`토큰 갱신 실패: ${JSON.stringify(json.error ?? json)}`);
    return { token: json.access_token, expiresInSec: json.expires_in ?? 60 * 24 * 3600 };
  } finally {
    clearTimeout(timer);
  }
}

/** 만료 임박 여부 (기본 7일 전). expiresAt: ISO. */
export function needsRefreshSoon(expiresAtIso: string, now: number, days = 7): boolean {
  const exp = Date.parse(expiresAtIso);
  if (Number.isNaN(exp)) return true;
  return exp - now <= days * 86_400_000;
}

/** 50일 경과 시 갱신 대상인지 (long-lived 60일 만료 대비). */
export function shouldRotate(issuedAtIso: string, now: number, rotateAfterDays = 50): boolean {
  const iss = Date.parse(issuedAtIso);
  if (Number.isNaN(iss)) return true;
  return now - iss >= rotateAfterDays * 86_400_000;
}
