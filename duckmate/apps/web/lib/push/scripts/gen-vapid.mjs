#!/usr/bin/env node
/**
 * VAPID 키 생성 (Node 내장 crypto, 의존성 없음).
 *   node apps/web/lib/push/scripts/gen-vapid.mjs
 * 출력된 값을 각각 설정한다 — 값은 레포에 커밋하지 않는다.
 *   Vercel(web):       NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   Supabase secrets:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto:… 또는 https://도메인)
 * 키 형식 = web-push 호환 (P-256 raw 공개키 65바이트 / 비밀키 32바이트, base64url).
 * 회전하면 기존 구독은 전부 무효 → 재구독 필요(sw pushsubscriptionchange 가 자동 처리하지만 브라우저 지원이 고르지 않다).
 */
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });

const raw = Buffer.concat([Buffer.from([0x04]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
if (raw.length !== 65) throw new Error(`unexpected public key length ${raw.length}`);

const publicB64u = raw.toString("base64url");
const privateB64u = priv.d;

process.stdout.write(
  [
    "# --- web (Vercel env) ---",
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicB64u}`,
    "# --- Supabase Edge Function secrets (supabase secrets set ...) ---",
    `VAPID_PUBLIC_KEY=${publicB64u}`,
    `VAPID_PRIVATE_KEY=${privateB64u}`,
    "VAPID_SUBJECT=mailto:REPLACE_ME@example.com",
    "",
  ].join("\n"),
);
