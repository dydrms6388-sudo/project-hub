#!/usr/bin/env node
// =============================================================================
// E6 · 디자인 하드룰 정적 검사 (C2 D-1 / D-2 / D-5-6, PRD §4 접근성 AA)
//
// grep 기반 정적 검사 — 렌더링 없이 소스만 본다. 규칙:
//   A11Y-HEX        토큰 파일 밖에서 hex 색상 리터럴 사용        (C2 D-1)
//   A11Y-ARBITRARY  Tailwind 임의값 색상 `bg-[#…]` / `text-[rgb(…)]` (C2 D-1)
//   A11Y-PALETTE    토큰에 없는 기본 팔레트 유틸(gray-500 등)     (C2 D-1)
//   A11Y-CORAL      코랄 배경 + 흰(또는 ink) 텍스트 조합          (C2 D-2 하드룰)
//   A11Y-FONT-SM    13px 미만 폰트 유틸/선언                      (C2 D-5-6, PRD 자동갱신 고지 13px)
//   A11Y-RAW-BW     bg-white / bg-black 직접 사용                 (C2 §1 137행)
//
// 위반 시 목록 출력 + exit 1.
// =============================================================================

import { join, basename } from "node:path";
import { REPO_ROOT, walkFiles, readIfExists, rel, createReporter } from "./lib/walk.mjs";

const report = createReporter("check-a11y-tokens — 디자인 하드룰");

/** 검사 대상 루트 */
const SCAN_ROOTS = [
  join(REPO_ROOT, "apps/web/app"),
  join(REPO_ROOT, "apps/web/lib"),
  join(REPO_ROOT, "apps/company/app"),
  join(REPO_ROOT, "apps/company/components"),
  join(REPO_ROOT, "apps/company/config"),
  join(REPO_ROOT, "packages/ui/src"),
  join(REPO_ROOT, "packages/game-engine/src"),
];

/** 토큰 정의 원본 — hex 가 있어야 정상인 파일 (C2: globals.css 가 단일 원본) */
const TOKEN_FILES = new Set(["apps/web/app/globals.css", "apps/company/app/globals.css"]);

const EXT = /\.(tsx|ts|jsx|js|css)$/;

// ── 규칙 정의 ────────────────────────────────────────────────────────────────

/** Tailwind 기본 팔레트 중 이 디자인 시스템 토큰에 없는 것들 */
const FOREIGN_PALETTES = [
  "gray", "slate", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
  "fuchsia", "pink", "rose",
];
const PALETTE_RE = new RegExp(
  `\\b(?:bg|text|border|ring|outline|from|via|to|decoration|divide|caret|accent|shadow|fill|stroke|placeholder)-(?:${FOREIGN_PALETTES.join("|")})-(?:50|[1-9]00|950)\\b`,
  "g",
);

/** #fff / #ffffff / #ffffffff 형태만. `#safety` 같은 앵커는 걸리지 않는다. */
const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;

const ARBITRARY_RE =
  /\b(?:bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|decoration)-\[(?:#|rgb|rgba|hsl|hsla|color|oklch|lab)\b[^\]]*\]/g;

/** 13px 미만 폰트: text-xs(12) / text-2xs / text-[Npx] N<13 / text-[Xrem] X<0.8125 */
const FONT_UTIL_RE = /\btext-(xs|2xs|3xs|tiny|micro)\b/g;
const FONT_ARB_PX_RE = /\btext-\[(\d+(?:\.\d+)?)px\]/g;
const FONT_ARB_REM_RE = /\btext-\[(\d+(?:\.\d+)?)rem\]/g;
/** CSS: font-size: 12px / 0.75rem 등 */
const CSS_FONT_RE = /font-size\s*:\s*(\d+(?:\.\d+)?)(px|rem|em)/g;

/** 코랄 배경 유틸 — tint(연한 배경)는 대비가 다른 별도 페어라 제외 */
const CORAL_BG_RE = /\bbg-accent(?:-(?:300|400|500|600|700|800|900))?\b(?!-)/;
const CORAL_BG_TINT_RE = /\bbg-accent-(?:tint|50|100|200)\b/;
const WHITE_TEXT_RE = /\btext-(?:white|black)\b/;
const INK_TEXT_RE = /\btext-ink\b(?!-)/;

/** 브랜드 딥 배경 위 흰 텍스트는 허용 (C2 §1: text-white 는 brand-600+ 딥 배경 위에서만) */
const ALLOWED_WHITE_BG_RE =
  /\bbg-(?:brand-(?:600|700|800|900)|danger-solid|primary|from-brand-(?:600|700|800|900))\b|\bfrom-brand-(?:600|700|800|900)\b/;

// ── 스캔 ─────────────────────────────────────────────────────────────────────

let scanned = 0;

function lineNo(src, index) {
  return src.slice(0, index).split("\n").length;
}

function snippet(src, index) {
  const start = src.lastIndexOf("\n", index) + 1;
  let end = src.indexOf("\n", index);
  if (end === -1) end = src.length;
  return src.slice(start, end).trim().slice(0, 140);
}

/** className="..." / class="..." / cn("...", "...") 안의 클래스 덩어리를 뽑는다. */
function extractClassChunks(src) {
  /** @type {{text:string, index:number}[]} */
  const chunks = [];
  const attrRe = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\}|\{cn\(([\s\S]{0,600}?)\)\})/g;
  let m;
  while ((m = attrRe.exec(src))) {
    const text = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "";
    chunks.push({ text, index: m.index });
  }
  // cva / cn 헬퍼 안의 문자열 리터럴(컴포넌트 variant 정의)도 한 덩어리로 본다
  const litRe = /["'`]([^"'`\n]*\b(?:bg|text)-[a-z][^"'`\n]*)["'`]/g;
  while ((m = litRe.exec(src))) {
    chunks.push({ text: m[1], index: m.index });
  }
  return chunks;
}

for (const root of SCAN_ROOTS) {
  for (const file of walkFiles(root)) {
    if (!EXT.test(file)) continue;
    const relPath = rel(file);
    const src = readIfExists(file);
    if (src == null) continue;
    scanned++;
    const isCss = file.endsWith(".css");
    const isTokenFile = TOKEN_FILES.has(relPath);

    // A11Y-HEX
    if (!isTokenFile) {
      for (const m of src.matchAll(HEX_RE)) {
        report.fail(
          "A11Y-HEX",
          relPath,
          lineNo(src, m.index),
          `hex 색상 리터럴 ${m[0]} 사용 — 토큰 클래스/CSS 변수만 허용 (C2 D-1). 토큰 정의는 apps/web/app/globals.css 에서만.`,
          agentOwner(relPath),
        );
      }
    }

    // A11Y-ARBITRARY
    for (const m of src.matchAll(ARBITRARY_RE)) {
      report.fail(
        "A11Y-ARBITRARY",
        relPath,
        lineNo(src, m.index),
        `Tailwind 임의값 색상 \`${m[0]}\` 사용 — 다크모드 스왑이 깨진다 (C2 D-1).`,
        agentOwner(relPath),
      );
    }

    // A11Y-PALETTE
    if (!isTokenFile) {
      for (const m of src.matchAll(PALETTE_RE)) {
        report.fail(
          "A11Y-PALETTE",
          relPath,
          lineNo(src, m.index),
          `토큰 외 기본 팔레트 유틸 \`${m[0]}\` 사용 — 다크모드에서 스왑되지 않아 AA 대비가 깨진다. 시맨틱 토큰(text-ink-muted, bg-surface …)으로 교체할 것 (C2 D-1).`,
          agentOwner(relPath),
        );
      }
    }

    // A11Y-FONT-SM
    for (const m of src.matchAll(FONT_UTIL_RE)) {
      report.fail(
        "A11Y-FONT-SM",
        relPath,
        lineNo(src, m.index),
        `\`text-${m[1]}\`(12px 이하) 사용 — 13px 미만 금지. 최소 단계는 \`text-caption\`(13px), 본문은 \`text-body\`(16px) (C2 D-5-6 / PRD 접근성).\n      ${snippet(src, m.index)}`,
        agentOwner(relPath),
      );
    }
    for (const m of src.matchAll(FONT_ARB_PX_RE)) {
      if (Number(m[1]) < 13) {
        report.fail("A11Y-FONT-SM", relPath, lineNo(src, m.index), `임의 폰트 크기 ${m[1]}px — 13px 미만 금지.`, agentOwner(relPath));
      }
    }
    for (const m of src.matchAll(FONT_ARB_REM_RE)) {
      if (Number(m[1]) * 16 < 13) {
        report.fail("A11Y-FONT-SM", relPath, lineNo(src, m.index), `임의 폰트 크기 ${m[1]}rem(<13px) — 13px 미만 금지.`, agentOwner(relPath));
      }
    }
    if (isCss) {
      for (const m of src.matchAll(CSS_FONT_RE)) {
        const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
        // 토큰 파일의 --text-* 정의는 별도로 검사(아래)하므로 여기선 실사용만
        if (px < 13 && !isTokenFile) {
          report.fail("A11Y-FONT-SM", relPath, lineNo(src, m.index), `font-size ${m[1]}${m[2]} (<13px) — 13px 미만 금지.`, agentOwner(relPath));
        }
      }
      // 토큰 자체가 13px 미만 단계를 새로 만들지 않았는지
      for (const m of src.matchAll(/--text-([a-z0-9-]+)\s*:\s*(\d+(?:\.\d+)?)(rem|px)\s*;/g)) {
        const px = m[3] === "px" ? Number(m[2]) : Number(m[2]) * 16;
        if (px < 13) {
          report.fail(
            "A11Y-FONT-SM",
            relPath,
            lineNo(src, m.index),
            `타이포 토큰 --text-${m[1]} 이 ${px}px 로 13px 미만이다. "더 작은 단계는 만들지 말 것"(C2 D-5-6) 위반.`,
            "C2 / 토큰 소유자",
          );
        }
      }
    }

    // A11Y-CORAL + A11Y-RAW-BW (클래스 덩어리 단위)
    for (const chunk of extractClassChunks(src)) {
      const t = chunk.text;
      if (CORAL_BG_RE.test(t) && !CORAL_BG_TINT_RE.test(t)) {
        if (WHITE_TEXT_RE.test(t)) {
          report.fail(
            "A11Y-CORAL",
            relPath,
            lineNo(src, chunk.index),
            `코랄 배경 + 흰/검정 텍스트 조합 금지 — 반드시 \`text-accent-fg\` (C2 D-2 하드룰).\n      ${snippet(src, chunk.index)}`,
            agentOwner(relPath),
          );
        } else if (INK_TEXT_RE.test(t)) {
          report.fail(
            "A11Y-CORAL",
            relPath,
            lineNo(src, chunk.index),
            `코랄 배경 위 \`text-ink\` 금지 — 다크모드에서 ink 가 밝은 색으로 스왑돼 대비가 무너진다. \`text-accent-fg\` 를 쓸 것 (C2 D-2).\n      ${snippet(src, chunk.index)}`,
            agentOwner(relPath),
          );
        }
      }
      if (/\bbg-(?:white|black)\b/.test(t)) {
        report.fail(
          "A11Y-RAW-BW",
          relPath,
          lineNo(src, chunk.index),
          `\`bg-white\`/\`bg-black\` 직접 사용 금지 — 다크는 바이올렛 밤하늘(surface #141220)이다. \`bg-surface\`/\`bg-surface-raised\` 사용 (C2 §1).\n      ${snippet(src, chunk.index)}`,
          agentOwner(relPath),
        );
      }
      if (WHITE_TEXT_RE.test(t) && !ALLOWED_WHITE_BG_RE.test(t) && /\bbg-/.test(t)) {
        report.warn(
          "A11Y-WHITE-TEXT",
          relPath,
          lineNo(src, chunk.index),
          `\`text-white\` 가 brand-600+ / danger-solid 이외의 배경과 함께 쓰였다. 대비 수동 확인 필요.\n      ${snippet(src, chunk.index)}`,
          agentOwner(relPath),
        );
      }
    }
  }
}

/** 파일 경로로 담당 에이전트를 추정 (문서의 "담당" 열 채우기용) */
function agentOwner(relPath) {
  if (relPath.startsWith("packages/ui/")) return "C2 (디자인 시스템)";
  if (relPath.startsWith("apps/company/")) return "E5 (회사 사이트)";
  if (relPath.includes("apps/web/app/(auth)") || relPath.includes("apps/web/app/onboarding")) return "E1 (온보딩/인증)";
  if (
    relPath.includes("apps/web/app/(main)/home") ||
    relPath.includes("apps/web/app/(main)/discover") ||
    relPath.includes("apps/web/app/(main)/likes")
  )
    return "E2 (탐색/매칭)";
  if (relPath.includes("apps/web/app/(main)/chat") || relPath.includes("apps/web/app/(main)/appeal")) return "E3 (채팅/안전)";
  if (
    relPath.includes("apps/web/app/(main)/me") ||
    relPath.includes("apps/web/app/(main)/settings") ||
    relPath.includes("apps/web/app/legal")
  )
    return "E4 (프로필/설정/법적)";
  if (relPath.includes("apps/web/app/(admin)")) return "D8 (어드민)";
  if (relPath === "apps/web/app/page.tsx" || relPath === "apps/web/app/layout.tsx")
    return "오케스트레이터(스캐폴드) / 공식 페이지 담당 E4";
  return "해당 파일 소유 에이전트";
}

process.exit(report.finish(`${scanned}개 파일 스캔 (apps/web, apps/company, packages/*)`));
