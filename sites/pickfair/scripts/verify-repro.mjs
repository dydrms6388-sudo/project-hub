/**
 * 재현성 검증 스크립트.
 *   node scripts/verify-repro.mjs
 *
 * src/lib/rng.ts + src/lib/draws.ts 를 실제로 컴파일해 돌려서
 *  1) mulberry32 수열이 참조 구현과 완전히 일치하는지
 *  2) 같은 seed + 같은 입력 → 항상 같은 결과인지 (10개 도구 전부)
 *  3) URL 왕복(lz-string 압축/해제) 뒤에도 결과가 같은지
 *  4) 분포가 한쪽으로 치우치지 않는지
 * 를 확인한다.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const out = mkdtempSync(path.join(tmpdir(), "pickfair-verify-"));
execFileSync(
  "npx",
  ["tsc", "src/lib/rng.ts", "src/lib/draws.ts", "src/lib/hashurl.ts", "src/tools/registry.ts", "--rootDir", "src", "--outDir", out, "--module", "commonjs", "--target", "es2020", "--strict"],
  { stdio: "inherit" },
);

const require = createRequire(import.meta.url);
const rng = require(path.join(out, "lib/rng.js"));
const draws = require(path.join(out, "lib/draws.js"));
const hashurl = require(path.join(out, "lib/hashurl.js"));
const registry = require(path.join(out, "tools/registry.js"));
const LZ = require("lz-string");

let failed = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

/* 1. mulberry32 — 이 파일 안의 독립 참조 구현과 비교 */
function refMulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
console.log("\n[1] mulberry32 수열");
{
  const a = rng.mulberry32(1);
  const b = refMulberry32(1);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  check("seed=1 첫 8개 값이 참조 구현과 동일", eq(seqA, seqB));
  console.log(`     ${seqA.slice(0, 3).map((v) => v.toFixed(12)).join(", ")} …`);

  const c = rng.rngFromSeed("a1b2c3d4", "ladder");
  const d = rng.rngFromSeed("a1b2c3d4", "ladder");
  check("같은 seed+salt → 같은 수열", eq(Array.from({ length: 20 }, c), Array.from({ length: 20 }, d)));

  const e = rng.rngFromSeed("a1b2c3d4", "roulette");
  check("salt 가 다르면 다른 수열", !eq(Array.from({ length: 20 }, rng.rngFromSeed("a1b2c3d4", "ladder")), Array.from({ length: 20 }, e)));

  const f = rng.rngFromSeed("a1b2c3d5", "ladder");
  check("seed 1비트만 달라도 다른 수열", !eq(Array.from({ length: 20 }, rng.rngFromSeed("a1b2c3d4", "ladder")), Array.from({ length: 20 }, f)));
}

/* 2. 도구별 재현성 */
console.log("\n[2] 도구 10종 재현성 (같은 seed + 같은 입력 → 같은 결과)");
const NAMES = ["가영", "나윤", "다온", "라온", "민서", "서준", "하준", "지우"];
const SEED = "9f3c1a7d";

const cases = {
  ladder: () => {
    const L = draws.buildLadder(SEED, 8);
    return NAMES.map((_, i) => draws.traceLadder(L.rungs, i).end);
  },
  roulette: () => draws.spinRoulette(SEED, [3, 1, 1, 1, 2]),
  "team-split": () =>
    draws.splitTeams({ n: NAMES, k: 3, sz: null, fb: [["가영", "나윤"]] }, SEED).teams,
  order: () => draws.makeOrder(SEED, NAMES),
  dice: () => draws.rollDice(SEED, 5, 20),
  "number-pick": () => draws.drawNumbers({ lo: 1, hi: 45, c: 6, dup: false, sort: true }, SEED),
  seat: () => draws.seatLayout({ r: 3, c: 4, n: NAMES, b: [0, 3] }, SEED),
  "yes-no": () => draws.decideYesNo(SEED, 50),
  penalty: () => draws.drawPenalties(SEED, ["A", "B", "C", "D", "E", "F"], 2),
  "name-draw": () => draws.drawNames(SEED, NAMES, 3),
};

for (const [slug, fn] of Object.entries(cases)) {
  const runs = [fn(), fn(), fn()];
  const same = eq(runs[0], runs[1]) && eq(runs[1], runs[2]);
  check(`${slug.padEnd(11)} 3회 반복 동일`, same, JSON.stringify(runs));
  if (same) console.log(`       → ${JSON.stringify(runs[0])}`);
}

/* 3. seed 가 바뀌면 결과도 바뀌어야 한다 */
console.log("\n[3] seed 변경 시 결과 변화");
{
  let changed = 0;
  for (let i = 0; i < 50; i++) {
    const a = draws.makeOrder(`seed${i}`, NAMES);
    const b = draws.makeOrder(`seed${i + 1000}`, NAMES);
    if (!eq(a, b)) changed++;
  }
  check("서로 다른 seed 50쌍 중 최소 48쌍이 다른 순서", changed >= 48, `changed=${changed}`);
}

/* 4. URL 왕복 (lz-string) */
console.log("\n[4] URL 해시 왕복 후 재현");
{
  const data = { n: NAMES, p: ["당첨", "꽝", "꽝", "꽝", "꽝", "꽝", "꽝", "꽝"] };
  const packed = LZ.compressToEncodedURIComponent(JSON.stringify(data));
  const hash = `#s=${SEED}&d=${packed}`;
  const params = hashurl.parseHash(hash);
  const restored = JSON.parse(LZ.decompressFromEncodedURIComponent(params.data));
  check("압축/해제 후 입력 동일", eq(restored, data));
  check("URL 안전 문자만 사용", /^[A-Za-z0-9$\-_.+!*'(),%]*$/.test(packed), packed.slice(0, 40));
  const L1 = draws.buildLadder(SEED, data.n.length);
  const L2 = draws.buildLadder(params.seed, restored.n.length);
  check(
    "링크로 복원한 입력으로 계산한 사다리 결과 동일",
    eq(data.n.map((_, i) => draws.traceLadder(L1.rungs, i).end), restored.n.map((_, i) => draws.traceLadder(L2.rungs, i).end)),
  );
  console.log(`     해시 길이 ${hash.length}자 (참가자 8명 기준)`);

  // lz-string 의 URI 안전 문자셋에는 '+' 가 들어 있다. URLSearchParams 로 파싱하면
  // '+' 가 공백으로 바뀌어 데이터가 깨지므로, 실제 파서가 이를 견디는지 확인한다.
  let plusCase = null;
  for (let i = 0; i < 4000 && !plusCase; i++) {
    const payload = { n: [`이름${i}`, "가영", "나윤", "다온"], c: 2 };
    const enc = LZ.compressToEncodedURIComponent(JSON.stringify(payload));
    if (enc.includes("+")) plusCase = { payload, enc };
  }
  check("압축 결과에 '+' 가 들어가는 사례 확보", plusCase !== null);
  if (plusCase) {
    const h = hashurl.buildHash("a1b2c3d4", plusCase.enc);
    const viaOurs = hashurl.parseHash(h);
    const okOurs = eq(JSON.parse(LZ.decompressFromEncodedURIComponent(viaOurs.data) ?? "null"), plusCase.payload);
    check("parseHash 로 '+' 포함 데이터 복원 성공", okOurs);
    check("parseHash 가 '+' 를 공백으로 바꾸지 않음", viaOurs.data === plusCase.enc);
  }
}

/* 5. 사다리는 언제나 1:1 대응이어야 한다 */
console.log("\n[5] 사다리 순열 성질");
{
  let ok = true;
  for (let t = 0; t < 500; t++) {
    const cols = 2 + (t % 19);
    const L = draws.buildLadder(`perm${t}`, cols);
    const ends = Array.from({ length: cols }, (_, i) => draws.traceLadder(L.rungs, i).end);
    if (new Set(ends).size !== cols) ok = false;
  }
  check("2~20명 500회 모두 서로 다른 칸에 도착", ok);
}

/* 6. 분포 검사 */
console.log("\n[6] 분포 (편향 없음)");
{
  const N = 60000;
  const cnt = new Array(6).fill(0);
  for (let i = 0; i < N; i++) cnt[draws.rollDice(`d${i}`, 1, 6)[0] - 1]++;
  const exp = N / 6;
  const maxDev = Math.max(...cnt.map((c) => Math.abs(c - exp) / exp));
  check(`D6 ${N}회 각 눈 편차 < 3%`, maxDev < 0.03, `maxDev=${(maxDev * 100).toFixed(2)}%`);
  console.log(`     ${cnt.join(" / ")}`);

  const perm = new Map();
  for (let i = 0; i < N; i++) {
    const k = draws.makeOrder(`o${i}`, ["A", "B", "C"]).join("");
    perm.set(k, (perm.get(k) ?? 0) + 1);
  }
  const dev = Math.max(...[...perm.values()].map((c) => Math.abs(c - N / 6) / (N / 6)));
  check(`3원소 셔플 6가지 순열 모두 등장, 편차 < 5%`, perm.size === 6 && dev < 0.05, `dev=${(dev * 100).toFixed(2)}%`);

  const w = [3, 1];
  let yes = 0;
  for (let i = 0; i < N; i++) if (draws.spinRoulette(`w${i}`, w) === 0) yes++;
  check("가중치 3:1 → 첫 항목 75% ±2%p", Math.abs(yes / N - 0.75) < 0.02, `${((yes / N) * 100).toFixed(2)}%`);
}

/* 7. registry 메타 완결성 */
console.log("\n[7] registry 메타 완결성");
{
  const slugs = registry.tools.map((t) => t.slug);
  const expected = ["ladder","roulette","team-split","order","dice","number-pick","seat","yes-no","penalty","name-draw"];
  check("도구 10개 모두 등록", expected.every((e) => slugs.includes(e)) && slugs.length === 10, slugs.join(","));
  const impl = fs.readFileSync("src/tools/components.tsx", "utf8");
  for (const t of registry.tools) {
    const problems = [];
    if (!(t.howto.length >= 3 && t.howto.length <= 5)) problems.push(`howto=${t.howto.length}`);
    if (!(t.principle.length >= 3 && t.principle.length <= 8)) problems.push(`principle=${t.principle.length}`);
    if (t.faq.length !== 5) problems.push(`faq=${t.faq.length}`);
    if (!t.faq.some((f) => f.q.includes("조작"))) problems.push("조작 FAQ 없음");
    if (t.related.length === 0) problems.push("related 비어 있음");
    if (t.related.some((r) => !slugs.includes(r) || r === t.slug)) problems.push("related 슬러그 오류");
    if (!t.description || t.description.length < 30) problems.push("description 짧음");
    if (!t.keywords.length) problems.push("keywords 없음");
    if (!impl.includes(`"${t.slug}"`) && !impl.includes(`  ${t.slug}:`)) problems.push("components.tsx 미등록");
    if (!fs.existsSync(`src/tools/impl/${t.slug}.tsx`)) problems.push("구현 파일 없음");
    check(`${t.slug.padEnd(11)} 메타 완결`, problems.length === 0, problems.join(", "));
  }
}

console.log(failed === 0 ? "\n모든 검증 통과 ✅\n" : `\n실패 ${failed}건 ❌\n`);
process.exit(failed === 0 ? 0 : 1);
