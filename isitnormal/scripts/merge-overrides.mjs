// P2 콘텐츠 심화 병합: 시드 해설 재작성 + 허브 intro 추가 문단을 overrides.json으로 합친다.
// 입력: 서브에이전트가 scratch에 쓴 ext-s1/s2/s3.json(해설 교체), ext-hubs.json(문단 추가).
// 출력: isitnormal/content/overrides.json
import { readFileSync, writeFileSync } from "node:fs";

const SCRATCH =
  "/tmp/claude-0/-home-user-project-hub/5730e78e-9858-531d-809d-5814ef9f5351/scratchpad";
const OUT = new URL("../content/overrides.ts", import.meta.url);

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.warn("skip (missing/invalid):", p, e.message);
    return {};
  }
};

const commentary = {
  ...readJson(`${SCRATCH}/ext-s1.json`),
  ...readJson(`${SCRATCH}/ext-s2.json`),
  ...readJson(`${SCRATCH}/ext-s3.json`),
};
const introAppend = readJson(`${SCRATCH}/ext-hubs.json`);

const header =
  "/**\n * 콘텐츠 심화 오버레이 (scripts/merge-overrides.mjs 산출).\n" +
  " * JSON 대신 .ts 로 저장 — Next 번들러와 node --experimental-strip-types 양쪽에서 임포트 가능.\n */\n" +
  "export interface Overrides { commentary: Record<string, string>; introAppend: Record<string, string>; }\n" +
  "const overrides: Overrides = ";
writeFileSync(OUT, header + JSON.stringify({ commentary, introAppend }, null, 2) + ";\nexport default overrides;\n");
console.log(
  `merged: ${Object.keys(commentary).length} commentaries, ${Object.keys(introAppend).length} intro appends`,
);
