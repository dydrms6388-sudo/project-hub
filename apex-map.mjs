// apex-map.mjs — 전 서비스 live→{slug,dir,type,configFile} 매핑 → apex-queue.json
// 유형: next(next.config 존재) / static(package.json 없음·index.html만) / unknown
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:/Users/dydrm/projects";
const slugMap = JSON.parse(readFileSync("slug-map.json", "utf8"));
const raw = JSON.parse(readFileSync("projects.json", "utf8"));
const projects = (raw.projects || raw).filter(p => p.live && /^https?:\/\//.test(p.live));

// 로컬 dir 스캔(depth<=3): package.json 또는 .vercel 또는 index.html 보유 dir
const dirs = [];
function walk(dir, depth) {
  if (depth > 3) return;
  let ents = [];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const names = ents.map(e => e.name);
  const hasPkg = names.includes("package.json");
  const hasVercel = names.includes(".vercel");
  const hasIndex = names.includes("index.html");
  if (hasPkg || hasVercel) {
    let vercelName = null, gitRemote = null, nextCfg = null;
    try { vercelName = JSON.parse(readFileSync(join(dir, ".vercel/project.json"), "utf8")).projectName; } catch {}
    try { const gc = readFileSync(join(dir, ".git/config"), "utf8"); const m = gc.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\s*$/m); if (m) gitRemote = m[2]; } catch {}
    for (const c of ["next.config.ts", "next.config.js", "next.config.mjs"]) if (names.includes(c)) { nextCfg = c; break; }
    const type = nextCfg ? "next" : (hasPkg ? "node" : (hasIndex ? "static" : "unknown"));
    dirs.push({ dir: dir.replace(/\\/g, "/"), base: dir.split(/[\\/]/).pop(), vercelName, gitRemote, nextCfg, type });
  }
  for (const e of ents) if (e.isDirectory() && !["node_modules", ".git", ".next", ".vercel", "dist", "build", ".turbo"].includes(e.name)) walk(join(dir, e.name), depth + 1);
}
walk(ROOT, 0);

const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const hostLabel = live => { try { return new URL(live).host.replace(/\.vercel\.app$/, ""); } catch { return ""; } };

function findDir(p) {
  const hl = norm(hostLabel(p.live));
  const gh = p.github ? norm(p.github.split("/").pop()) : null;
  return dirs.find(d => norm(d.vercelName) === hl)
      || (gh && dirs.find(d => norm(d.gitRemote) === gh))
      || dirs.find(d => norm(d.gitRemote) === hl)
      || (gh && dirs.find(d => norm(d.vercelName) === gh))
      || dirs.find(d => norm(d.base) === hl)
      || (gh && dirs.find(d => norm(d.base) === gh))
      || dirs.find(d => hl.length > 5 && norm(d.base).includes(hl))
      || null;
}

const queue = [], unmatched = [];
for (const p of projects) {
  const d = findDir(p);
  const slug = slugMap[p.live] || hostLabel(p.live);
  queue.push({ slug, name: p.name, live: p.live, dir: d ? d.dir : null, type: d ? d.type : "unknown", configFile: d ? d.nextCfg : null });
  if (!d) unmatched.push(slug);
}
writeFileSync("apex-queue.json", JSON.stringify(queue, null, 2));

const byType = {};
for (const q of queue) byType[q.type] = (byType[q.type] || 0) + 1;
console.log("total:", queue.length, "| matched dir:", queue.filter(q => q.dir).length, "| unmatched:", unmatched.length);
console.log("types:", JSON.stringify(byType));
console.log("unmatched:", unmatched.slice(0, 20).join(", "));
console.log("sample next:", queue.filter(q => q.type === "next").slice(0, 5).map(q => `${q.slug}(${q.configFile})`).join(", "));
console.log("sample static:", queue.filter(q => q.type === "static").slice(0, 8).map(q => q.slug).join(", "));
