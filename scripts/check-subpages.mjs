// scripts/check-subpages.mjs — 공유·바이럴 앱의 롱테일 하위 페이지 품질 게이트
// 사용: node scripts/check-subpages.mjs <slug> [slug...]
//       node scripts/check-subpages.mjs --all
//
// 하위 페이지(/<slug>/<sub>/index.html)는 검색 유입을 담당하지만, 틀만 같고 값만 바꾼
// 얇은 페이지를 대량으로 찍어내면 도어웨이로 분류돼 사이트 전체가 손해를 본다.
// 그래서 분량·고유 메타·JSON-LD·회귀 링크에 더해 **형제 페이지 간 본문 유사도**를 재고,
// 지나치게 닮은 쌍이 있으면 실패시킨다.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";

const SHARE_APPS = [
  "chemi-link", "aboutme-quiz", "balance-vs", "hanguldaily", "nbbang-link",
  "when-link", "fourcut-web", "fortune-daily", "timecapsule-link", "yearwrap-kr",
];

const MIN_BODY = 1200;      // 하위 페이지 본문 최소 글자수(공백 제외)
const MAX_SIMILARITY = 0.72; // 형제 페이지 본문 자카드 유사도 상한

const args = process.argv.slice(2);
const slugs = args.includes("--all") ? SHARE_APPS : args;
if (!slugs.length) {
  console.error("사용법: node scripts/check-subpages.mjs <slug> | --all");
  process.exit(2);
}

// 태그·스크립트·스타일을 걷어낸 사람이 읽는 본문
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 2-그램 자카드 — 문장 순서를 바꿔도 닮은 건 닮았다고 잡힌다
function similarity(a, b) {
  const grams = (s) => {
    const w = s.replace(/[^가-힣a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    const g = new Set();
    for (let i = 0; i < w.length - 1; i++) g.add(w[i] + " " + w[i + 1]);
    return g;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

function subPages(slug) {
  if (!existsSync(slug)) return [];
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 2) return;
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      if (!statSync(p).isDirectory()) continue;
      if (existsSync(`${p}/index.html`)) out.push(p);
      walk(p, depth + 1);
    }
  };
  walk(slug, 1);
  return out.sort();
}

function checkPage(dir, slug) {
  const file = `${dir}/index.html`;
  const errs = [], warns = [];
  const buf = readFileSync(file);
  const html = buf.toString("utf8");
  const body = visibleText(html);
  const chars = body.replace(/\s/g, "").length;

  if (/REPLACE_(?:GOOGLE|NAVER)_CODE|광고 영역|TODO|Lorem ipsum/i.test(html)) errs.push("플레이스홀더 잔재");
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c < 9 || (c > 13 && c < 32) || c === 127) { errs.push(`리터럴 제어문자(0x${c.toString(16)})`); break; }
  }

  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  if (!title.trim()) errs.push("<title> 없음");
  else if (title.length < 15) warns.push(`<title> 짧음(${title.length}자)`);

  const desc = (html.match(/<meta name="description" content="([\s\S]*?)"/i) || [])[1] || "";
  if (!desc.trim()) errs.push("description 없음");
  else if (desc.length < 50) warns.push(`description 짧음(${desc.length}자)`);

  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1] || "";
  if (!canon) errs.push("canonical 없음");
  else if (!canon.includes(dir)) errs.push(`canonical 경로 불일치(${canon})`);

  if (!/<meta name="robots"/i.test(html)) errs.push("robots 메타 없음");
  if (!/application\/ld\+json/i.test(html)) errs.push("JSON-LD 없음");
  else {
    const lds = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const [, raw] of lds) { try { JSON.parse(raw); } catch (e) { errs.push("JSON-LD 파싱 실패: " + e.message); } }
    if (!/BreadcrumbList/.test(html)) warns.push("BreadcrumbList 없음");
  }

  if (!/<h1[\s>]/i.test(html)) errs.push("<h1> 없음");
  if (chars < MIN_BODY) errs.push(`본문 부족(${chars}자 < ${MIN_BODY})`);

  // 앱으로 돌아가는 길이 없으면 검색 유입이 전환되지 않는다
  if (!new RegExp(`href="/${slug}/?"`).test(html)) errs.push(`앱(/${slug}/)으로 가는 링크 없음`);

  return { dir, errs, warns, chars, title, desc, body };
}

let bad = 0;
for (const slug of slugs) {
  const dirs = subPages(slug);
  if (!dirs.length) { console.log(`— ${slug}: 하위 페이지 없음`); continue; }

  const pages = dirs.map((d) => checkPage(d, slug));

  // 형제 간 중복: 제목·설명은 정확 일치 금지, 본문은 유사도 상한
  const seenTitle = new Map(), seenDesc = new Map();
  for (const p of pages) {
    if (seenTitle.has(p.title)) p.errs.push(`title 중복(${seenTitle.get(p.title)})`);
    else seenTitle.set(p.title, p.dir);
    if (seenDesc.has(p.desc)) p.errs.push(`description 중복(${seenDesc.get(p.desc)})`);
    else seenDesc.set(p.desc, p.dir);
  }
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const s = similarity(pages[i].body, pages[j].body);
      if (s > MAX_SIMILARITY) {
        pages[i].errs.push(`본문이 ${pages[j].dir} 와 ${(s * 100).toFixed(0)}% 유사(도어웨이 위험)`);
      }
    }
  }

  const failed = pages.filter((p) => p.errs.length);
  const warned = pages.filter((p) => !p.errs.length && p.warns.length);
  if (failed.length) {
    bad++;
    console.log(`❌ ${slug} — 하위 ${pages.length}개 중 ${failed.length}개 실패`);
    for (const p of failed) for (const e of p.errs) console.log(`   ✗ ${p.dir}: ${e}`);
  } else {
    const avg = Math.round(pages.reduce((a, p) => a + p.chars, 0) / pages.length);
    console.log(`✅ ${slug} — 하위 ${pages.length}개 통과 (본문 평균 ${avg}자)`);
  }
  for (const p of warned) for (const w of p.warns) console.log(`   · ${p.dir}: ${w}`);
}

console.log(bad ? `\n실패 ${bad}/${slugs.length}` : `\n전체 통과 ${slugs.length}/${slugs.length}`);
process.exit(bad ? 1 : 0);
