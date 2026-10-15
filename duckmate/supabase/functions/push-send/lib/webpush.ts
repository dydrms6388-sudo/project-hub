/**
 * Web Push (RFC 8030/8291/8292) — Deno WebCrypto 직접 구현. npm:web-push 미사용(의존성·번들 최소화, 판정 근거 20_notifications §5).
 *  - 페이로드 암호화: aes128gcm (ECDH P-256 + HKDF-SHA256 + AES-128-GCM), 단일 레코드
 *  - VAPID: ES256 JWT (aud = endpoint origin, exp ≤ 24h), Authorization: vapid t=…, k=…
 * 키 형식 = gen-vapid.mjs 출력(공개키 raw 65바이트 / 비밀키 32바이트 base64url).
 */

export type PushSubscriptionLike = { endpoint: string; keys: { p256dh: string; auth: string } };
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };
export type SendOptions = { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string };
export type SendResult = { ok: boolean; status: number; body?: string };

const te = new TextEncoder();

export function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, length * 8);
  return new Uint8Array(bits);
}

/** RFC 8291 aes128gcm: 반환 = salt(16) | rs(4) | idlen(1) | as_public(65) | ciphertext */
export async function encryptPayload(sub: PushSubscriptionLike, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("invalid p256dh");
  if (authSecret.length !== 16) throw new Error("invalid auth secret");

  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const keyInfo = concat(te.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  const rs = 4096;
  if (plaintext.length + 1 + 16 > rs) throw new Error("payload too large for a single record");
  const padded = concat(plaintext, new Uint8Array([0x02])); // 마지막 레코드 구분자
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, padded as BufferSource));

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = 65;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

let cachedSigner: { pub: string; key: CryptoKey } | null = null;

async function vapidSigningKey(vapid: VapidKeys): Promise<CryptoKey> {
  if (cachedSigner && cachedSigner.pub === vapid.publicKey) return cachedSigner.key;
  const pub = fromB64u(vapid.publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("invalid VAPID public key");
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: vapid.privateKey, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  cachedSigner = { pub: vapid.publicKey, key };
  return key;
}

/** RFC 8292: Authorization 헤더 값 */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, expiresInSec = 12 * 3600): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + Math.min(expiresInSec, 24 * 3600);
  const header = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64u(te.encode(JSON.stringify({ aud, exp, sub: vapid.subject })));
  const key = await vapidSigningKey(vapid);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${header}.${payload}`)));
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${vapid.publicKey}`;
}

export async function sendWebPush(sub: PushSubscriptionLike, payload: string, vapid: VapidKeys, opts: SendOptions = {}): Promise<SendResult> {
  const body = await encryptPayload(sub, te.encode(payload));
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(sub.endpoint, vapid),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    "Content-Length": String(body.length),
    TTL: String(opts.ttl ?? 4 * 3600),
    Urgency: opts.urgency ?? "normal",
  };
  if (opts.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  const res = await fetch(sub.endpoint, { method: "POST", headers, body: body as BufferSource });
  const text = res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 200);
  return { ok: res.ok, status: res.status, body: text };
}

export function loadVapidFromEnv(): VapidKeys {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "";
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT missing");
  if (!/^(mailto:|https:\/\/)/.test(subject)) throw new Error("VAPID_SUBJECT must be mailto: or https://");
  return { publicKey, privateKey, subject };
}

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}
