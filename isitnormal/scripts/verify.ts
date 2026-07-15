/**
 * 검증 스크립트 (P6 기술 게이트 F + 콘텐츠/모더레이션). 재사용 모듈.
 * 실행: npx tsx scripts/verify.ts
 * 이진 판정 — 하나라도 실패하면 비정상 종료(1).
 */
import { SEEDS } from "../content/seeds";
import { HUBS } from "../content/hubs";
import { CATEGORIES } from "../content/categories";
import { CARD_BUCKETS } from "../content/card-copy";
import { findCliches } from "../content/schema";
import { scanUgc } from "../lib/moderation";
import { evaluatePromotion } from "../lib/promotion-gate";

const clen = (s: string) => [...s].length;
let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ── 콘텐츠 ─────────────────────────────────────────────
check("시드 60개", SEEDS.length === 60, `${SEEDS.length}`);
check("허브 12개", HUBS.length === 12, `${HUBS.length}`);
const slugs = SEEDS.map((s) => s.slug);
check("slug 중복 0", new Set(slugs).size === slugs.length);

const shortCom = SEEDS.filter((s) => clen(s.editorCommentary) < 300);
check("해설 300자+ (F6)", shortCom.length === 0, `미달 ${shortCom.length}`);
const shortHub = HUBS.filter((h) => clen(h.intro) < 1200);
check("허브 intro 1200자+ (F6)", shortHub.length === 0, `미달 ${shortHub.length}`);

// F5: 중복 title/metaTitle/metaDescription/h1
const dup = (a: string[]) => a.filter((v, i) => a.indexOf(v) !== i);
check("중복 시드 title 0 (F5)", dup(SEEDS.map((s) => s.title)).length === 0);
check("중복 허브 metaTitle 0 (F5)", dup(HUBS.map((h) => h.metaTitle)).length === 0);
check("중복 허브 metaDescription 0 (F5)", dup(HUBS.map((h) => h.metaDescription)).length === 0);
check("중복 허브 h1 0 (F5)", dup(HUBS.map((h) => h.h1)).length === 0);

// F9: AI 상투구 0
let cliche = 0;
for (const s of SEEDS) if (findCliches(s.title + s.body + s.editorCommentary).length) cliche++;
for (const h of HUBS) if (findCliches(h.intro + h.faq.map((f) => f.q + f.a).join("")).length) cliche++;
check("AI 상투구 0 (F9)", cliche === 0, `${cliche}건`);

// F8: 해설 pairwise 유사도 0.7 초과 0
const shingles = (t: string) => {
  const c = [...t.replace(/\s/g, "")];
  const set = new Set<string>();
  for (let i = 0; i + 8 <= c.length; i++) set.add(c.slice(i, i + 8).join(""));
  return set;
};
const jac = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
const sh = SEEDS.map((s) => shingles(s.editorCommentary));
let maxSim = 0;
for (let i = 0; i < sh.length; i++)
  for (let j = i + 1; j < sh.length; j++) maxSim = Math.max(maxSim, jac(sh[i], sh[j]));
check("해설 유사도 0.7 이하 (F8)", maxSim <= 0.7, `max ${maxSim.toFixed(3)}`);

// F3: sitemap = 홈 + 허브 12 (시드/UGC 제외). 여기선 색인 대상 수 검증.
check("색인 대상 = 홈+허브12 (F3)", 1 + CATEGORIES.length === 13);

// 승격 게이트: 투표 0인 시드는 색인 불가(미승격 noindex 보장)
const p = evaluatePromotion({
  origin: "operator",
  moderationStatus: "approved",
  bodyChars: 200,
  votes: 0,
  comments: 0,
  editorCommentaryChars: 350,
  relatedCount: 5,
  totalPageChars: 1300,
  uniquePageChars: 900,
  ageDays: 30,
  qualityScanPassed: true,
});
check("투표 0 시드는 색인 불가 (A5)", p.canIndex === false, p.reasons.join(","));

// 카드 12종
check("카드 문구 12구간 (C2)", CARD_BUCKETS.length === 12);
check("카드 버킷 헤드라인 고유 (C4)", new Set(CARD_BUCKETS.map((b) => b.headline)).size === 12);

// 모더레이션 (D4/D5/E)
const pii = [
  "제 번호는 010-1234-5678", "계좌 110-234-567890", "주민번호 900101-1234567",
  "차량 12가 3456", "홍길동 팀장이", "삼성전자 김철수 대리", "서울시 강남구 테헤란로 123",
  "메일 abc@test.com", "카톡 아이디 hong123 추가", "네이버㈜ 김영희 과장",
];
const spam = [
  "대출 필요하면", "토토 배팅", "리딩방 무료체험", "카지노 충전", "성인 출장",
  "코인리딩 선입금", "구매대행 팔로우", "먹튀 없는", "주식리딩방 모집", "홍보문의",
];
const legit = ["저희 팀장이 늦게 퇴근", "우리집은 수건 이틀", "그분이 이상해요"];
const piiPass = pii.filter((t) => scanUgc(t).action === "accept").length;
const spamPass = spam.filter((t) => scanUgc(t).action === "accept").length;
const legitReject = legit.filter((t) => scanUgc(t).action === "reject").length;
check("PII 통과율 0% (D4)", piiPass === 0, `통과 ${piiPass}/10`);
check("스팸 통과율 0% (D5)", spamPass === 0, `통과 ${spamPass}/10`);
check("정상 문장 반려 0", legitReject === 0, `반려 ${legitReject}/3`);

console.log(fails === 0 ? "\n✅ 전체 통과" : `\n❌ ${fails}건 실패`);
process.exit(fails === 0 ? 0 : 1);
