#!/usr/bin/env node
/**
 * check-copy — 10_brand §4.4 금지 표현 사전 + §4.3 금지 이모지 + 서비스명 리터럴 규칙을 소스에 grep 한다 (E6).
 *
 *  대상: apps/web/{app,components} · apps/company/{app,components} · packages/ui/src 의 .ts/.tsx
 *  제외: 주석(블록·라인, 문자열 안의 // 는 보존) · *.test.* · __tests__/ · node_modules
 *  예외: 같은 줄에 `copy-lint-disable-line` 주석이 있으면 건너뛴다(사유를 같이 적을 것).
 *  서비스명 리터럴 "덕메이트" 는 config/company.ts · manifest.webmanifest · lib/push/templates.ts · app/**\/layout.tsx(metadata) 만 허용.
 *
 *  사용: node scripts/check-copy.mjs [--json]   → 위반 0 이면 exit 0, 아니면 exit 1
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = ["apps/web/app", "apps/web/components", "apps/company/app", "apps/company/components", "packages/ui/src"];
const SERVICE_NAME = "덕메이트";
const SERVICE_NAME_ALLOW = [/(^|\/)config\/company\.ts$/, /manifest\.webmanifest$/, /lib\/push\/templates\.ts$/, /(^|\/)app\/(.+\/)?layout\.tsx$/];

/** 10_brand §4.4 (분류 → 정규식). 문자열·JSX 텍스트 기준이므로 한국어 어절 경계는 느슨하게 본다. */
export const FORBIDDEN = [
  { category: "희소성·긴급", re: /지금 안 하면|마지막 기회|곧 사라져요|서두르세요|놓치지 마세요|카운트다운/g, fix: "사실 + 다음 시각(\"내일 07:00\")" },
  { category: "죄책감·자책", re: /아직도 안 했어요|기록이 사라져요|매칭이 안 되는 이유|프로필 때문에|노력이 부족/g, fix: "있는 것만 알림" },
  { category: "가짜 신호", re: /누군가 당신을 좋아해요|인기 급상승|\d+\s*명이 보는 중|지금 .{0,6}명이 보는 중|매칭률 \d+배/g, fix: "실제 데이터만" },
  { category: "외모·평가", re: /매력 점수|인기 회원|상위 ?\d+ ?%|잘생긴|예쁜|비주얼|얼평|\b등급\b|등급이|등급을|등급은/g, fix: "취미·몰입도·활동 시간대만 서술" },
  { category: "성별 고정관념", re: /남자답게|여자답게|여성분들이 좋아하는|남자라면|이상형 스펙/g, fix: "성별 무관 서술" },
  { category: "만남 압박", re: /아직 안 만났어요|만나야 진짜|언제 만나요|오프라인이 답/g, fix: "만남 제안은 제안 카드로만" },
  { category: "탈락·심사", re: /탈락|불합격|심사 통과|거절됨|승인 거부/g, fix: "\"다시 올려 주세요\" 등 사실형" },
  { category: "결제 압박", re: /프리미엄 회원만|무료는 여기까지|지금 결제하면|해지하면 손해/g, fix: "사실형 혜택 나열" },
  { category: "위치", re: /근처|\b500 ?m\b|지금 여기/g, fix: "구 단위 지역명만" },
  { category: "호칭", re: /회원님|고객님|(?<![가-힣])이성(?![적계])|남성분|여성분/g, fix: "닉네임 또는 생략 / 상대" },
  { category: "금지 이모지", re: /😍|😘|🔥|💋|❤️|💔|💕|😭|🥺|🚨|⚠️/gu, fix: "허용 세트(🎉 ✨ 👋 …)만, 경고는 lucide 아이콘" },
];

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === "node_modules" || e === ".next" || e === "__tests__" || e === "out") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|mts|webmanifest)$/.test(e) && !/\.test\.|\.spec\./.test(e)) {
      out.push(p);
    }
  }
  return out;
}

/** 주석을 같은 길이의 공백으로 치환(줄 번호 보존). 문자열/템플릿 리터럴 안의 // 나 /* 는 건드리지 않는다. */
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let quote = null; // ' " `
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") { out += d ?? ""; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") { out += " "; i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(REPO_ROOT, r), []));
const violations = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file).split(sep).join("/");
  const raw = readFileSync(file, "utf8");
  const rawLines = raw.split("\n");
  const stripped = stripComments(raw).split("\n");
  const serviceAllowed = SERVICE_NAME_ALLOW.some((re) => re.test(rel));

  stripped.forEach((line, idx) => {
    if (/copy-lint-disable-line/.test(rawLines[idx] ?? "")) return;
    for (const rule of FORBIDDEN) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) {
        violations.push({ file: rel, line: idx + 1, category: rule.category, match: m[0], fix: rule.fix, context: line.trim().slice(0, 100) });
        if (!rule.re.global) break;
      }
    }
    if (!serviceAllowed && line.includes(SERVICE_NAME)) {
      violations.push({ file: rel, line: idx + 1, category: "서비스명 리터럴", match: SERVICE_NAME, fix: "SERVICE_NAME 상수(config/company.ts) 참조", context: line.trim().slice(0, 100) });
    }
  });
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ files: files.length, violations }, null, 2));
} else {
  console.log(`[check-copy] ${files.length} files scanned (${ROOTS.join(", ")})`);
  if (violations.length) {
    console.log(`\n❌ ${violations.length} violation(s):\n`);
    console.log("| 파일:줄 | 분류 | 매치 | 문맥 | 대체 |");
    console.log("|---|---|---|---|---|");
    for (const v of violations) console.log(`| ${v.file}:${v.line} | ${v.category} | ${v.match} | ${v.context.replace(/\|/g, "\\|")} | ${v.fix} |`);
  } else {
    console.log("✅ [check-copy] 금지 표현·서비스명 리터럴 위반 없음");
  }
}
process.exit(violations.length ? 1 : 0);
