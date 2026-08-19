// scripts/check-viral-app.mjs — 공유·바이럴 자립형 앱 품질 게이트
// 사용: node scripts/check-viral-app.mjs <slug> [slug...]
//       node scripts/check-viral-app.mjs --all      (SHARE_APPS 전체)
//
// 통과 기준(모두 필수): 배포 가드(광고/플레이스홀더), 메타·JSON-LD, 인라인 JS 문법,
// share-kit 엔진 탑재, VIRAL 5요소(URL 상태·유입 CTA·PNG 카드·공유·리믹스).
import { readFileSync, existsSync } from "node:fs";

const SHARE_APPS = [
  "chemi-link", "aboutme-quiz", "balance-vs", "hanguldaily", "nbbang-link",
  "when-link", "fourcut-web", "fortune-daily", "timecapsule-link", "yearwrap-kr",
];

const args = process.argv.slice(2);
const slugs = args.includes("--all") ? SHARE_APPS : args;
if (!slugs.length) {
  console.error("사용법: node scripts/check-viral-app.mjs <slug> | --all");
  process.exit(2);
}

// <script> 블록 추출(JSON-LD 등 type 지정 블록은 별도 분리)
function scriptBlocks(html) {
  const js = [], ld = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "", body = m[2] || "";
    if (/\bsrc\s*=/.test(attrs)) continue;                       // 외부 스크립트는 본문 없음
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) { ld.push(body); continue; }
    if (/type\s*=\s*["'](?!text\/javascript)/i.test(attrs)) continue; // 템플릿 등
    js.push(body);
  }
  return { js, ld };
}

function checkSlug(slug) {
  const file = `${slug}/index.html`;
  const errs = [], warns = [];
  const E = (m) => errs.push(m);
  const W = (m) => warns.push(m);

  if (!existsSync(file)) return { slug, errs: [`${file} 없음`], warns, bytes: 0 };
  const buf = readFileSync(file);
  const html = buf.toString("utf8");
  const bytes = buf.length;

  // ── 1. 배포 가드(gen-pages.mjs JUNK 정규식과 동일 기준) ──
  if (/REPLACE_(?:GOOGLE|NAVER)_CODE|광고 영역/.test(html)) E("플레이스홀더 잔재(REPLACE_ 또는 '광고 영역')");

  // ── 2. 제어문자 오염(작성 도구가 \\u 이스케이프를 리터럴로 쓴 경우) ──
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c < 9 || (c > 13 && c < 32) || c === 127) { E(`리터럴 제어문자(0x${c.toString(16)}) 오프셋 ${i}`); break; }
  }

  // ── 3. 필수 메타 ──
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  if (!title.trim()) E("<title> 없음");
  else if (title.length < 20) W(`<title> 너무 짧음(${title.length}자)`);
  const desc = (html.match(/<meta name="description" content="([\s\S]*?)"/i) || [])[1] || "";
  if (desc.length < 80) E(`meta description 부족(${desc.length}자, 80자 이상 권장)`);
  if (!new RegExp(`<link rel="canonical" href="https://tomatoeggcat\\.com/${slug}/"`).test(html)) E("canonical 누락/불일치");
  for (const p of ["og:title", "og:description", "og:url", "og:type"]) {
    if (!new RegExp(`property="${p}"`).test(html)) E(`OG 태그 누락: ${p}`);
  }
  if (!/name="twitter:card"/.test(html)) E("twitter:card 누락");
  if (!/<meta name="viewport"/i.test(html)) E("viewport 누락");
  if (!/<html lang="ko"/i.test(html)) E('html lang="ko" 누락');

  // ── 4. JSON-LD ──
  const { js, ld } = scriptBlocks(html);
  if (!ld.length) E("JSON-LD 없음");
  const types = new Set();
  for (const block of ld) {
    let parsed;
    try { parsed = JSON.parse(block); } catch (e) { E(`JSON-LD 파싱 실패: ${e.message}`); continue; }
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === "object") { if (n["@type"]) types.add(n["@type"]); Object.values(n).forEach(walk); }
    };
    walk(parsed);
  }
  for (const t of ["SoftwareApplication", "FAQPage", "BreadcrumbList"]) {
    if (!types.has(t)) E(`JSON-LD 타입 누락: ${t}`);
  }

  // ── 5. 광고: 정확히 1개, 결과 영역 아래 ──
  const adCount = (html.match(/class="adsbygoogle"/g) || []).length;
  if (adCount === 0) E("애드센스 유닛 없음(결과 하단 1개 필요)");
  else if (adCount > 1) E(`애드센스 유닛 ${adCount}개 — 결과 하단 1개만 허용`);
  if (!/ca-pub-5567719201265106/.test(html)) E("애드센스 퍼블리셔 ID 누락");

  // ── 6. 인라인 JS 문법 ──
  if (!js.length) E("인라인 스크립트 없음");
  js.forEach((code, i) => {
    try { new Function(code); }
    catch (e) { E(`인라인 <script> #${i + 1} 문법 오류: ${e.message}`); }
  });

  // ── 7. share-kit 엔진 탑재 ──
  const all = js.join("\n");
  if (!/var SK\s*=\s*\(function/.test(all)) E("share-kit 엔진(SK) 미탑재 — templates/share-kit.js 인라인 필요");
  for (const fn of ["enc", "dec", "readState", "stateUrl", "sharePng", "copy", "toast"]) {
    if (!new RegExp(`\\b${fn}\\s*:`).test(all)) W(`SK.${fn} 노출 확인 필요`);
  }

  // ── 8. VIRAL 5요소 ──
  if (!/\?d=|readState\(|stateUrl\(/.test(all)) E("VIRAL①: URL 상태(?d=) 미구현");
  if (!/나도 해보기|나도 하기|나도 만들기|나도 해볼래/.test(html)) E("VIRAL②: 공유 유입 CTA('나도 해보기') 없음");
  if (!/SK\.card\(|createElement\("canvas"\)|createElement\('canvas'\)/.test(all)) E("VIRAL③: 캔버스 결과 카드 없음");
  if (!new RegExp(`tomatoeggcat\\.com/${slug}`).test(all)) E("VIRAL③: 카드 워터마크(도메인/슬러그) 없음");
  if (!/SK\.share\(|navigator\.share/.test(all)) E("VIRAL④: navigator.share 공유 없음");
  if (!/SK\.copy\(/.test(all)) E("VIRAL④: 링크/텍스트 복사 없음");
  if (!/twitter\.com\/intent|SK\.xUrl\(/.test(all)) E("VIRAL④: X 공유 없음");
  if (!/리믹스|다시 하기|다시하기|새로 만들기|한 번 더/.test(html)) E("VIRAL⑤: 리믹스/재생성 없음");

  // ── 9. 콘텐츠 두께(소개·사용법·FAQ 고유 본문) ──
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
  if (text.length < 2500) E(`본문 텍스트 부족(${text.length}자) — 소개·사용법·FAQ 2,500자 이상`);
  if (!/자주 묻는 질문|FAQ/i.test(html)) E("FAQ 섹션 없음");
  if (!/재미|오락|참고용|정확하지 않|보장하지 않/.test(text)) W("오락/참고용 고지 문구 확인 필요");

  // ── 10. 개인정보 수집 금지(입력 필드 타입 점검) ──
  if (/<input[^>]*type="(?:email|tel)"/i.test(html)) E("개인정보 입력 필드(email/tel) 사용 금지");
  if (/주민등록번호|주민번호/.test(text) && !/수집하지|입력받지|묻지 않/.test(text)) E("주민번호 관련 표현 점검 필요");

  // ── 11. 외부 의존 ──
  const externalSrc = [...html.matchAll(/<script[^>]*src="([^"]+)"/gi)].map((m) => m[1])
    .filter((u) => !/pagead2\.googlesyndication\.com/.test(u));
  if (externalSrc.length) E(`외부 스크립트 의존 금지: ${externalSrc.join(", ")}`);
  const externalLink = [...html.matchAll(/<link[^>]*href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1])
    .filter((u) => !/tomatoeggcat\.com/.test(u));
  if (externalLink.length) W(`외부 스타일/리소스: ${externalLink.join(", ")}`);

  // ── 12. 용량 ──
  if (bytes < 18000) E(`파일이 너무 작음(${bytes}B) — 콘텐츠·기능 부족 의심`);
  if (bytes > 400000) W(`파일이 큼(${Math.round(bytes / 1024)}KB) — 모바일 로딩 확인`);

  return { slug, errs, warns, bytes, textLen: text.length };
}

let bad = 0;
for (const slug of slugs) {
  const r = checkSlug(slug);
  const head = `${r.errs.length ? "❌" : "✅"} ${r.slug}  (${Math.round(r.bytes / 1024)}KB, 본문 ${r.textLen || 0}자)`;
  console.log(head);
  for (const e of r.errs) console.log(`   ✗ ${e}`);
  for (const w of r.warns) console.log(`   · ${w}`);
  if (r.errs.length) bad++;
}
console.log(bad ? `\n실패 ${bad}/${slugs.length}` : `\n전체 통과 ${slugs.length}/${slugs.length}`);
process.exit(bad ? 1 : 0);
