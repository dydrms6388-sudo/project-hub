#!/usr/bin/env node
/**
 * preview/ 아래 export 된 사이트들을 스캔해 preview/index.html (목차)을 만든다.
 * 각 사이트의 site.config.ts 에서 name/description 을 읽어온다.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW = join(ROOT, "preview");
const SITES = join(ROOT, "sites");

const pick = (src, key) => {
  const m = src.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  return m ? m[1] : "";
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** export 된 /tools/<slug>/ 디렉터리 수 = 실제 라이브 도구 수.
 *  registry 를 정규식으로 세면 spec 주도형 사이트(idphoto-kr)를 놓친다. */
const countTools = (slug) => {
  const d = join(PREVIEW, slug, "tools");
  if (!existsSync(d)) return 0;
  return readdirSync(d).filter((f) => statSync(join(d, f)).isDirectory()).length;
};

const dirs = existsSync(PREVIEW)
  ? readdirSync(PREVIEW).filter((d) => statSync(join(PREVIEW, d)).isDirectory()).sort()
  : [];

const sites = dirs.map((slug) => {
  const cfgPath = join(SITES, slug, "src", "site.config.ts");
  const cfg = existsSync(cfgPath) ? readFileSync(cfgPath, "utf8") : "";
  return {
    slug,
    name: pick(cfg, "name") || slug,
    description: pick(cfg, "description") || "",
    domain: pick(cfg, "domain") || `${slug}.vercel.app`,
    tools: countTools(slug),
  };
});

const cards = sites
  .map(
    (s) => `      <a class="card" href="./${esc(s.slug)}/">
        <span class="name">${esc(s.name)}</span>
        <span class="desc">${esc(s.description)}</span>
        <span class="meta">도구 ${s.tools}개 · <code>${esc(s.domain)}</code></span>
      </a>`,
  )
  .join("\n");

writeFileSync(
  join(PREVIEW, "index.html"),
  `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>도구 사이트 선배포 프리뷰</title>
<style>
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body { margin:0; padding:2.5rem 1.25rem; background:#f8fafc; color:#0f172a;
         font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif }
  .wrap { max-width:960px; margin:0 auto }
  h1 { font-size:1.6rem; margin:0 0 .5rem }
  p.lead { color:#475569; line-height:1.7; margin:0 0 .5rem }
  .warn { margin:1.5rem 0 2rem; padding:.9rem 1rem; border-radius:.6rem;
          background:#fffbeb; border:1px solid #fde68a; color:#92400e; font-size:.9rem; line-height:1.6 }
  .grid { display:grid; gap:.85rem; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)) }
  .card { display:block; padding:1.1rem; border:1px solid #e2e8f0; border-radius:.75rem;
          background:#fff; text-decoration:none; color:inherit; transition:.15s }
  .card:hover { border-color:#3b82f6; background:#eff6ff }
  .name { display:block; font-weight:700; font-size:1.05rem }
  .desc { display:block; margin-top:.35rem; font-size:.875rem; color:#64748b; line-height:1.5 }
  .meta { display:block; margin-top:.6rem; font-size:.75rem; color:#94a3b8 }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace }
</style>
</head>
<body>
  <div class="wrap">
    <h1>도구 사이트 선배포 프리뷰</h1>
    <p class="lead">각 사이트는 독립된 Next.js 앱이며, 최종적으로는 각자의 Vercel 프로젝트 · 도메인으로 배포됩니다.</p>
    <div class="warn">
      이 페이지는 <strong>레이아웃·콘텐츠 확인용 정적 export</strong> 입니다.
      하위 경로(<code>/preview/&lt;사이트&gt;/</code>)에서 서빙되며 검색엔진에는 노출하지 않습니다.
      <br><br>
      아래 두 가지는 <strong>프리뷰에서만 동작하지 않습니다.</strong> 각 사이트를 개별 Vercel 프로젝트로
      배포하면 정상 동작합니다.
      <br>
      · <strong>멀티스레드 영상 처리</strong>(clipforge) — COOP/COEP 응답 헤더가 하위 경로 정적 서빙에서는
      켜지지 않아 단일 스레드로 폴백합니다.
      <br>
      · <strong>AI 모델 실행</strong>(dictate-kr · docmind-local · idphoto-kr 배경 제거) — 22MB 짜리
      onnxruntime 바이너리를 리포에 커밋하지 않았기 때문입니다. 크롭·규격·다운로드 등 나머지 기능은 그대로 동작합니다.
    </div>
    <div class="grid">
${cards}
    </div>
  </div>
</body>
</html>
`,
);

console.log(`preview/index.html 생성 — ${sites.length}개 사이트`);
for (const s of sites) console.log(`  · ${s.slug.padEnd(16)} 도구 ${String(s.tools).padStart(2)}개  ${s.name}`);
