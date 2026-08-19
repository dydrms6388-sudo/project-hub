#!/usr/bin/env node
// =============================================================================
// E6 · 비밀값 커밋 검사 (PRD §4 보안 — "비밀값 커밋 금지(.env.example 만)")
//
// `.env.example` 외의 파일에 실제 키가 들어갔는지 정적 검사한다.
//   SEC-JWT-SERVICE  supabase service_role JWT (payload 디코드로 role 확인)
//   SEC-JWT          기타 supabase JWT (anon 포함 — 값이 커밋되면 프로젝트 특정 가능)
//   SEC-TOSS         toss 결제 키 (test_/live_ + ck/sk/gck/gsk)
//   SEC-PORTONE      포트원 imp_/channel-key/store-id
//   SEC-SUPABASE-URL 실제 프로젝트 ref 가 박힌 supabase URL
//   SEC-PRIVATE-KEY  PEM 개인키 블록
//   SEC-ENV-ASSIGN   비밀 env 이름에 플레이스홀더가 아닌 값이 대입됨
//   SEC-ENV-FILE     .env / .env.local 등 실파일이 워킹트리에 존재하는데 gitignore 안 됨
//
// 위반 시 목록 출력 + exit 1.
// =============================================================================

import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import { REPO_ROOT, walkFiles, readIfExists, rel, createReporter } from "./lib/walk.mjs";

const report = createReporter("check-secrets — 비밀값 커밋 검사");

/** 검사에서 제외: 예제 파일, 락파일, 이 스크립트 자신(패턴 문자열 포함) */
const EXEMPT_BASENAMES = new Set([".env.example", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);
const EXEMPT_RELPATHS = new Set(["scripts/check-secrets.mjs"]);

/** 바이너리·산출물 확장자는 스킵 */
const SKIP_EXT = /\.(png|jpg|jpeg|gif|webp|avif|ico|svg|woff2?|ttf|otf|eot|mp4|webm|pdf|zip|tar|gz|zst|node|wasm|tsbuildinfo)$/i;

/** 플레이스홀더로 인정하는 값 */
const PLACEHOLDER_RE =
  /^\s*$|YOUR_|<[^>]*>|example|placeholder|changeme|dummy|xxxx|\.\.\.|TODO|REPLACE|sk_test_xxx|project-ref|\bref\b/i;

/** base64url payload 디코드 */
function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const PATTERNS = [
  {
    id: "SEC-JWT",
    re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    describe(match) {
      const payload = decodeJwtPayload(match);
      const role = payload?.role;
      if (role === "service_role") {
        return {
          id: "SEC-JWT-SERVICE",
          msg: `supabase **service_role** JWT 가 커밋돼 있다 (ref=${payload?.ref ?? "?"}). RLS 를 전부 우회하는 키다 — 즉시 Supabase 대시보드에서 회전(rotate)하고 파일에서 제거할 것.`,
        };
      }
      return {
        id: "SEC-JWT",
        msg: `JWT 형태 문자열이 커밋돼 있다 (role=${role ?? "?"}, ref=${payload?.ref ?? "?"}). 값은 env 로만 주입할 것.`,
      };
    },
  },
  {
    id: "SEC-TOSS",
    re: /\b(?:test|live)_(?:ck|sk|gck|gsk)_[A-Za-z0-9]{10,}/g,
    describe: (m) => ({ id: "SEC-TOSS", msg: `Toss Payments 키 형태 문자열 (${m.slice(0, 14)}…) 커밋 — .env 로 옮기고 키 회전.` }),
  },
  {
    id: "SEC-PORTONE",
    re: /\b(?:imp_[0-9a-z]{10,}|channel-key-[0-9a-f-]{16,}|store-[0-9a-f]{8}-[0-9a-f-]{20,})/gi,
    describe: (m) => ({ id: "SEC-PORTONE", msg: `포트원(PortOne) 키/식별자 형태 문자열 (${m.slice(0, 16)}…) 커밋 — .env 로 옮길 것.` }),
  },
  {
    id: "SEC-SUPABASE-URL",
    re: /https:\/\/([a-z]{20})\.supabase\.(?:co|in)/g,
    describe: (m) => ({ id: "SEC-SUPABASE-URL", msg: `실제 Supabase 프로젝트 URL(${m}) 하드코딩 — NEXT_PUBLIC_SUPABASE_URL env 로만 참조할 것.` }),
  },
  {
    id: "SEC-PRIVATE-KEY",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    describe: () => ({ id: "SEC-PRIVATE-KEY", msg: "PEM 개인키 블록이 커밋돼 있다 — 즉시 제거 + 회전." }),
  },
  {
    id: "SEC-VAPID",
    re: /VAPID_PRIVATE_KEY\s*[=:]\s*["']?([A-Za-z0-9_-]{30,})["']?/g,
    describe: (m) => ({ id: "SEC-VAPID", msg: `VAPID 개인키 값이 대입돼 있다 (${m.slice(0, 30)}…). Web Push 발신 위조가 가능해진다 — 회전 필요.` }),
  },
];

/** 이름만 봐도 비밀인 env 키 — 값이 플레이스홀더가 아니면 위반 */
const SECRET_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOSS_SECRET_KEY",
  "TOSS_WEBHOOK_SECRET",
  "PORTONE_API_SECRET",
  "PORTONE_API_KEY",
  "VAPID_PRIVATE_KEY",
];
const ENV_ASSIGN_RE = new RegExp(`\\b(${SECRET_ENV_NAMES.join("|")})\\s*=\\s*["']?([^\\n"']*)["']?`, "g");

function lineNo(src, index) {
  return src.slice(0, index).split("\n").length;
}

// ── 스캔 ─────────────────────────────────────────────────────────────────────

let scanned = 0;
const files = walkFiles(REPO_ROOT).filter((f) => {
  const b = basename(f);
  if (EXEMPT_BASENAMES.has(b)) return false;
  if (EXEMPT_RELPATHS.has(rel(f))) return false;
  if (SKIP_EXT.test(f)) return false;
  return true;
});

for (const file of files) {
  const relPath = rel(file);
  const src = readIfExists(file);
  if (src == null) continue;
  if (src.length > 2_000_000) continue; // 초대형 파일 스킵
  scanned++;

  for (const p of PATTERNS) {
    for (const m of src.matchAll(p.re)) {
      const info = p.describe(m[0]);
      report.fail(info.id, relPath, lineNo(src, m.index), info.msg, "해당 파일 커밋한 에이전트 / G2 보안 리뷰");
    }
  }

  for (const m of src.matchAll(ENV_ASSIGN_RE)) {
    const [, name, value] = m;
    if (PLACEHOLDER_RE.test(value ?? "")) continue;
    if ((value ?? "").length < 12) continue; // 짧은 값은 실키로 보지 않음
    if (/process\.env|import\.meta|\$\{/.test(value)) continue; // 참조는 정상
    report.fail(
      "SEC-ENV-ASSIGN",
      relPath,
      lineNo(src, m.index),
      `${name} 에 실값으로 보이는 문자열이 대입돼 있다 (${value.slice(0, 8)}…). .env.example 외 파일에는 플레이스홀더만 허용.`,
      "해당 파일 커밋한 에이전트 / G2 보안 리뷰",
    );
  }
}

// ── .env 실파일 존재 여부 ────────────────────────────────────────────────────

const gitignore = readIfExists(join(REPO_ROOT, ".gitignore")) ?? "";
const ignoresEnv = /^\s*\.env(\.\*)?\s*$/m.test(gitignore) || /^\s*\.env\*/m.test(gitignore);
if (!ignoresEnv) {
  report.fail(
    "SEC-GITIGNORE",
    ".gitignore",
    null,
    ".env / .env.* 가 .gitignore 에 없다 — 실키가 커밋될 위험.",
    "G2 / 리포 소유자",
  );
}
for (const f of walkFiles(REPO_ROOT).filter((f) => /(^|\/)\.env(\.|$)/.test(rel(f)))) {
  if (basename(f) === ".env.example") continue;
  if (!ignoresEnv) {
    report.fail("SEC-ENV-FILE", rel(f), null, "실 .env 파일이 존재하는데 gitignore 되지 않았다.", "G2");
  } else {
    report.warn("SEC-ENV-FILE", rel(f), null, "로컬 .env 파일 존재 (gitignore 됨 — 커밋만 하지 않으면 정상).");
  }
}

// ── .env.example 자체 점검: 예제에 실키가 들어가 있지 않은지 ─────────────────
for (const ex of walkFiles(REPO_ROOT).filter((f) => basename(f) === ".env.example")) {
  const src = readIfExists(ex) ?? "";
  for (const p of PATTERNS) {
    for (const m of src.matchAll(p.re)) {
      const info = p.describe(m[0]);
      report.fail(`${info.id}-EXAMPLE`, rel(ex), lineNo(src, m.index), `.env.example 에 실키 형태 값이 들어 있다 — 예제는 플레이스홀더만. ${info.msg}`, "G2");
    }
  }
}

process.exit(report.finish(`${scanned}개 파일 스캔 (node_modules·빌드 산출물·락파일 제외)`));
