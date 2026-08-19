// =============================================================================
// D7 · Web Push 발송 프리미티브 (Deno / WebCrypto 순정 구현)
//
// 선택 근거: `npm:web-push` 는 Node 의 http/https·crypto ECDH 레거시 API 에
// 의존한다. Deno 의 Node 호환 계층에서 대체로 동작하지만 버전에 따라 서명·전송
// 경로가 깨진 전례가 있어, Edge Function 은 외부 의존성 0 으로 표준 WebCrypto 만
// 사용해 RFC 8291(aes128gcm 페이로드 암호화) + RFC 8292(VAPID) 를 직접 구현한다.
// FCM 전환(Phase 4) 시 이 파일은 FcmSender 로 교체되며 index.ts 의 발송 정책
// 계층(슬롯·상한·카피)은 무수정이다 — B3 §5.2 규약.
// =============================================================================

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushResult {
  ok: boolean;
  status: number;
  /** 404/410 — 구독 만료. 호출자가 토큰을 비활성화해야 한다. */
  gone: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// base64url / bytes 유틸
// ---------------------------------------------------------------------------
export function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(bytes: Uint8Array | ArrayBuffer): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  byteLength: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    byteLength * 8
  );
  return new Uint8Array(bits);
}

// ---------------------------------------------------------------------------
// RFC 8291 — aes128gcm 페이로드 암호화
// ---------------------------------------------------------------------------
async function encryptPayload(
  payload: Uint8Array,
  uaPublicKey: Uint8Array, // 구독의 p256dh (65바이트 uncompressed point)
  authSecret: Uint8Array // 구독의 auth (16바이트)
): Promise<Uint8Array> {
  // 발송자 일회용 ECDH 키쌍(as = application server)
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublicKey as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256)
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));

  // PRK = HKDF(auth, ecdh, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = concat(utf8("WebPush: info\0"), uaPublicKey, asPublic);
  const prk = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, prk, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, utf8("Content-Encoding: nonce\0"), 12);

  // 단일 레코드: payload || 0x02 (마지막 레코드 패딩 구분자)
  const record = concat(payload, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "encrypt",
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, record as BufferSource)
  );

  // aes128gcm 헤더: salt(16) | rs(4, uint32be) | idlen(1) | keyid(as_public 65)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096); // record size
  header[20] = asPublic.length;
  header.set(asPublic, 21);

  return concat(header, ciphertext);
}

// ---------------------------------------------------------------------------
// RFC 8292 — VAPID (ES256 JWT)
// ---------------------------------------------------------------------------
async function vapidAuthorization(
  endpoint: string,
  vapidPublicB64u: string,
  vapidPrivateB64u: string,
  subject: string
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600; // 최대 24h, 12h 사용
  const enc = (o: unknown) => bytesToB64u(utf8(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp, sub: subject })}`;

  // VAPID 키(공개키 raw 65바이트 / 개인키 d 32바이트)를 JWK 로 재조립해 import
  const pub = b64uToBytes(vapidPublicB64u);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: vapidPrivateB64u,
    x: bytesToB64u(pub.slice(1, 33)),
    y: bytesToB64u(pub.slice(33, 65)),
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  // WebCrypto ECDSA 서명은 raw r||s (64바이트) — JWS ES256 규격과 동일
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned) as BufferSource)
  );
  return `vapid t=${unsigned}.${bytesToB64u(sig)}, k=${vapidPublicB64u}`;
}

// ---------------------------------------------------------------------------
// 발송
// ---------------------------------------------------------------------------
export interface VapidConfig {
  publicKey: string; // base64url (65바이트 uncompressed P-256 point)
  privateKey: string; // base64url (32바이트 d)
  subject: string; // "mailto:..." 또는 https URL
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payloadJson: string,
  vapid: VapidConfig,
  ttlSeconds = 12 * 3600
): Promise<WebPushResult> {
  try {
    const body = await encryptPayload(
      utf8(payloadJson),
      b64uToBytes(subscription.keys.p256dh),
      b64uToBytes(subscription.keys.auth)
    );
    const authorization = await vapidAuthorization(
      subscription.endpoint,
      vapid.publicKey,
      vapid.privateKey,
      vapid.subject
    );
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        TTL: String(ttlSeconds),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Urgency: "normal",
      },
      body: body as BodyInit,
    });
    // 응답 본문은 소비만 (리소스 누수 방지)
    await res.arrayBuffer().catch(() => undefined);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
    };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: e instanceof Error ? e.message : String(e) };
  }
}
