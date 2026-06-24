// 롤아웃 실패로 앱 레포에 남은 미커밋 next.config 수정을 안전 원복.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const q = JSON.parse(readFileSync("apex-queue.json", "utf8")).filter(x => x.dir && x.type === "next");
let reverted = 0, clean = 0, committed = 0;
const revertedList = [];
for (const a of q) {
  try {
    const st = execSync(`git -C "${a.dir}" status --porcelain -- next.config.ts next.config.js next.config.mjs`, { encoding: "utf8" }).trim();
    if (!st) { clean++; continue; }
    // 스테이징/커밋된 변경(apex 성공)인지: 워킹트리 수정(' M' 또는 '??')만 원복
    if (/^\s?[MD?]/.test(st)) {
      execSync(`git -C "${a.dir}" checkout -- next.config.ts next.config.js next.config.mjs 2>/dev/null || true`);
      reverted++; revertedList.push(a.slug);
    } else { committed++; }
  } catch { /* skip */ }
}
console.log(`clean: ${clean} | reverted(stray): ${reverted} | committed(apex): ${committed}`);
console.log("reverted slugs:", revertedList.slice(0, 40).join(", ") + (revertedList.length > 40 ? ` …(+${revertedList.length - 40})` : ""));
