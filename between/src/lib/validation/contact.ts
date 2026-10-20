// 외부 연락 수단 검증 + 정규화. 반드시 서버에서 호출된다 (Server Action) — DB 제약은 2차 방어.
// 결과 value 는 항상 정규화된 https URL 이며, 화면에서는 이 URL 만 링크로 사용한다.
import type { ContactKind } from "@/lib/domain/options";

export type ContactResult = { ok: true; url: string; display: string } | { ok: false; error: string };

const MAX_LEN = 300;

// 단축 URL / 리다이렉터 / 익명 파일 공유 등 피싱에 자주 쓰이는 도메인
const BLOCKED_HOSTS = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
  "shorturl.at", "rb.gy", "han.gl", "me2.do", "vo.la", "url.kr", "naver.me", "lrl.kr", "tiny.cc",
  "s.id", "linktr.ee", "grabify.link", "iplogger.org", "iplogger.com", "2no.co", "yip.su",
  "blasze.com", "ps3cfw.com",
];
// 리다이렉트 파라미터 (open redirect 악용)
const REDIRECT_PARAMS = /^(url|u|redirect|redirect_uri|redirect_url|next|target|dest|destination|continue|return|returnurl|go|link|out)$/i;

function hostBlocked(host: string): boolean {
  return BLOCKED_HOSTS.some((b) => host === b || host.endsWith("." + b));
}

/** 일반 https 링크 검사 (기타 링크 및 플랫폼 URL 공통) */
export function validateHttpsUrl(raw: string): ContactResult {
  const input = raw.trim();
  if (!input) return { ok: false, error: "링크를 입력해 주세요." };
  if (input.length > MAX_LEN) return { ok: false, error: "링크가 너무 길어요." };
  if (/[\s<>"'`\\\u0000-\u001F\u007F]/.test(input)) return { ok: false, error: "링크에 허용되지 않는 문자가 있어요." };
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return { ok: false, error: "올바른 링크 형식이 아니에요. https:// 로 시작해야 해요." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "https:// 로 시작하는 링크만 등록할 수 있어요." };
  if (u.username || u.password) return { ok: false, error: "계정 정보가 포함된 링크는 등록할 수 없어요." };
  if (u.port) return { ok: false, error: "포트가 지정된 링크는 등록할 수 없어요." };
  const host = u.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[")) {
    return { ok: false, error: "IP 주소 링크는 등록할 수 없어요." };
  }
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes(".") || host.endsWith(".")) {
    return { ok: false, error: "도메인을 확인해 주세요." };
  }
  if (host.split(".").some((l) => l.startsWith("xn--"))) {
    return { ok: false, error: "국제화 도메인(IDN) 링크는 사칭 위험 때문에 등록할 수 없어요." };
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return { ok: false, error: "내부 주소는 등록할 수 없어요." };
  }
  if (hostBlocked(host)) return { ok: false, error: "단축 URL·리다이렉트 서비스 링크는 등록할 수 없어요." };
  for (const [k, v] of u.searchParams) {
    if (REDIRECT_PARAMS.test(k) || /^(https?:)?\/\//i.test(v) || /^https?%3a/i.test(v)) {
      return { ok: false, error: "다른 사이트로 이동시키는 링크는 등록할 수 없어요." };
    }
  }
  u.hash = "";
  return { ok: true, url: u.toString(), display: host + (u.pathname === "/" ? "" : u.pathname) };
}

function fromHandle(raw: string, re: RegExp, build: (h: string) => string, err: string): ContactResult {
  const h = raw.trim().replace(/^@/, "");
  if (!re.test(h)) return { ok: false, error: err };
  return { ok: true, url: build(h), display: "@" + h };
}

function hostIs(u: URL, hosts: string[]) {
  return hosts.includes(u.hostname.toLowerCase());
}

export function validateContact(kind: ContactKind, raw: string): ContactResult {
  const input = raw.trim();
  if (!input) return { ok: false, error: "값을 입력해 주세요." };
  if (input.length > MAX_LEN) return { ok: false, error: "입력이 너무 길어요." };

  switch (kind) {
    case "kakao_openchat": {
      const r = validateHttpsUrl(input);
      if (!r.ok) return { ok: false, error: "카카오톡 오픈채팅 링크(https://open.kakao.com/o/…)를 입력해 주세요." };
      const u = new URL(r.url);
      if (!hostIs(u, ["open.kakao.com"]) || !/^\/(o|me)\/[A-Za-z0-9_-]{4,40}$/.test(u.pathname) || u.search) {
        return { ok: false, error: "카카오톡 오픈채팅 링크(https://open.kakao.com/o/…)만 등록할 수 있어요." };
      }
      return { ok: true, url: `https://open.kakao.com${u.pathname}`, display: "오픈채팅" };
    }
    case "line": {
      if (/^https:\/\//i.test(input)) {
        const r = validateHttpsUrl(input);
        if (!r.ok) return r;
        const u = new URL(r.url);
        if (!hostIs(u, ["line.me"]) || !/^\/(ti\/p|R\/ti\/p)\/[A-Za-z0-9@~_%-]{2,40}$/.test(u.pathname) || u.search) {
          return { ok: false, error: "LINE 친구 추가 링크(https://line.me/ti/p/…) 또는 LINE ID 를 입력해 주세요." };
        }
        return { ok: true, url: `https://line.me${u.pathname}`, display: "LINE" };
      }
      return fromHandle(
        input,
        /^[a-z0-9._-]{4,20}$/,
        (h) => `https://line.me/ti/p/~${h}`,
        "LINE ID 는 영문 소문자·숫자·. _ - 4~20자예요.",
      );
    }
    case "instagram": {
      let handle = input;
      if (/^https:\/\//i.test(input)) {
        const r = validateHttpsUrl(input);
        if (!r.ok) return r;
        const u = new URL(r.url);
        const m = u.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
        if (!hostIs(u, ["instagram.com", "www.instagram.com"]) || !m) {
          return { ok: false, error: "Instagram 프로필 링크 또는 아이디를 입력해 주세요." };
        }
        handle = m[1];
      }
      return fromHandle(
        handle,
        /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/,
        (h) => `https://instagram.com/${h.toLowerCase()}`,
        "Instagram 아이디는 영문·숫자·. _ 1~30자예요.",
      );
    }
    case "telegram": {
      let handle = input;
      if (/^https:\/\//i.test(input)) {
        const r = validateHttpsUrl(input);
        if (!r.ok) return r;
        const u = new URL(r.url);
        const m = u.pathname.match(/^\/([A-Za-z0-9_]{5,32})\/?$/);
        if (!hostIs(u, ["t.me", "telegram.me"]) || !m || u.search) {
          return { ok: false, error: "Telegram 링크(https://t.me/아이디) 또는 아이디를 입력해 주세요." };
        }
        handle = m[1];
      }
      return fromHandle(
        handle,
        /^[A-Za-z][A-Za-z0-9_]{4,31}$/,
        (h) => `https://t.me/${h}`,
        "Telegram 아이디는 영문으로 시작하는 5~32자예요.",
      );
    }
    case "link":
      return validateHttpsUrl(input);
  }
}

/** 렌더링 직전 최종 확인 — DB 에서 읽은 값이라도 https 가 아니면 링크로 쓰지 않는다 */
export function safeHref(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}
