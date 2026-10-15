// 샘플 데이터 생성기 — Supabase 미연결 시 사용하는 합성 데이터.
// ⚠️ 종목명/코드는 실제 상장사이지만 수치는 시드 기반 난수(실제 재무·시세 아님).
// 실행: node scripts/gen-sample-data.mjs  → data/sample-stocks.json
import { writeFileSync, mkdirSync } from "node:fs";

const UNIVERSE = [
  ["005930","삼성전자","KOSPI","반도체"],["000660","SK하이닉스","KOSPI","반도체"],["373220","LG에너지솔루션","KOSPI","2차전지"],
  ["207940","삼성바이오로직스","KOSPI","바이오"],["005380","현대차","KOSPI","자동차"],["000270","기아","KOSPI","자동차"],
  ["068270","셀트리온","KOSPI","바이오"],["005490","POSCO홀딩스","KOSPI","철강"],["035420","NAVER","KOSPI","인터넷"],
  ["105560","KB금융","KOSPI","금융"],["055550","신한지주","KOSPI","금융"],["086790","하나금융지주","KOSPI","금융"],
  ["316140","우리금융지주","KOSPI","금융"],["012330","현대모비스","KOSPI","자동차부품"],["028260","삼성물산","KOSPI","지주"],
  ["066570","LG전자","KOSPI","전자"],["003670","포스코퓨처엠","KOSPI","2차전지"],["096770","SK이노베이션","KOSPI","에너지"],
  ["034730","SK","KOSPI","지주"],["015760","한국전력","KOSPI","유틸리티"],["017670","SK텔레콤","KOSPI","통신"],
  ["030200","KT","KOSPI","통신"],["032640","LG유플러스","KOSPI","통신"],["033780","KT&G","KOSPI","담배"],
  ["009150","삼성전기","KOSPI","전자부품"],["010130","고려아연","KOSPI","비철금속"],["051910","LG화학","KOSPI","화학"],
  ["011200","HMM","KOSPI","해운"],["010950","S-Oil","KOSPI","에너지"],["024110","기업은행","KOSPI","금융"],
  ["138040","메리츠금융지주","KOSPI","금융"],["000810","삼성화재","KOSPI","보험"],["032830","삼성생명","KOSPI","보험"],
  ["018260","삼성에스디에스","KOSPI","IT서비스"],["036570","엔씨소프트","KOSPI","게임"],["251270","넷마블","KOSPI","게임"],
  ["009540","HD한국조선해양","KOSPI","조선"],["042660","한화오션","KOSPI","조선"],["012450","한화에어로스페이스","KOSPI","방산"],
  ["047050","포스코인터내셔널","KOSPI","상사"],["000100","유한양행","KOSPI","제약"],["128940","한미약품","KOSPI","제약"],
  ["004020","현대제철","KOSPI","철강"],["011170","롯데케미칼","KOSPI","화학"],["090430","아모레퍼시픽","KOSPI","화장품"],
  ["097950","CJ제일제당","KOSPI","식품"],["271560","오리온","KOSPI","식품"],["139480","이마트","KOSPI","유통"],
  ["023530","롯데쇼핑","KOSPI","유통"],["029780","삼성카드","KOSPI","금융"],["071050","한국금융지주","KOSPI","금융"],
  ["006800","미래에셋증권","KOSPI","증권"],["016360","삼성증권","KOSPI","증권"],["039490","키움증권","KOSPI","증권"],
  ["002380","KCC","KOSPI","건자재"],["000720","현대건설","KOSPI","건설"],["047040","대우건설","KOSPI","건설"],
  ["021240","코웨이","KOSPI","생활가전"],["008770","호텔신라","KOSPI","면세"],["035250","강원랜드","KOSPI","레저"],
  ["247540","에코프로비엠","KOSDAQ","2차전지"],["086520","에코프로","KOSDAQ","2차전지"],["091990","셀트리온헬스케어","KOSDAQ","바이오"],
  ["028300","HLB","KOSDAQ","바이오"],["196170","알테오젠","KOSDAQ","바이오"],["066970","엘앤에프","KOSDAQ","2차전지"],
  ["263750","펄어비스","KOSDAQ","게임"],["293490","카카오게임즈","KOSDAQ","게임"],["112040","위메이드","KOSDAQ","게임"],
  ["035900","JYP Ent.","KOSDAQ","엔터"],["041510","에스엠","KOSDAQ","엔터"],["067160","아프리카TV","KOSDAQ","미디어"],
  ["058470","리노공업","KOSDAQ","반도체장비"],["240810","원익IPS","KOSDAQ","반도체장비"],["403870","HPSP","KOSDAQ","반도체장비"],
  ["039030","이오테크닉스","KOSDAQ","반도체장비"],["357780","솔브레인","KOSDAQ","반도체소재"],["036930","주성엔지니어링","KOSDAQ","반도체장비"],
  ["095340","ISC","KOSDAQ","반도체부품"],["215200","메가스터디교육","KOSDAQ","교육"],["064760","티씨케이","KOSDAQ","반도체소재"],
  ["222800","심텍","KOSDAQ","PCB"],["078600","대주전자재료","KOSDAQ","전자소재"],["166090","하나머티리얼즈","KOSDAQ","반도체소재"],
  ["214150","클래시스","KOSDAQ","의료기기"],["145020","휴젤","KOSDAQ","바이오"],["141080","리가켐바이오","KOSDAQ","바이오"],
  ["237690","에스티팜","KOSDAQ","제약"],["348370","엔켐","KOSDAQ","2차전지"],["009520","포스코엠텍","KOSDAQ","철강"],
];

// mulberry32 시드 난수
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r = rng(20260901);
const pick = (lo, hi, d = 2) => Number((lo + (hi - lo) * r()).toFixed(d));
const AS_OF = "2026-09-01";

const financials = [];
const dividends = [];
for (const [code, name, market, sector] of UNIVERSE) {
  const isFin = /금융|보험|증권|은행/.test(sector);
  const isGrowth = /바이오|2차전지|게임|엔터/.test(sector);
  const price = market === "KOSPI" ? Math.round(pick(8000, 420000, 0) / 100) * 100 : Math.round(pick(5000, 180000, 0) / 100) * 100;
  const mcap = market === "KOSPI" ? Math.round(pick(8000, 3000000, 0)) : Math.round(pick(1500, 120000, 0));
  const roe = isGrowth ? pick(-8, 18, 1) : isFin ? pick(6, 13, 1) : pick(2, 22, 1);
  const per = roe <= 0 ? null : isGrowth ? pick(18, 95, 1) : isFin ? pick(4, 9, 1) : pick(5, 28, 1);
  const pbr = isGrowth ? pick(1.5, 9, 2) : isFin ? pick(0.3, 0.8, 2) : pick(0.4, 3.2, 2);
  const debt = isFin ? pick(600, 1400, 0) : isGrowth ? pick(40, 160, 0) : pick(20, 190, 0);
  const eps = per ? Math.round(price / per) : Math.round(-price * pick(0.01, 0.05, 3));
  const bps = Math.round(price / pbr);
  const revenue = Math.round(mcap * pick(0.3, 1.8, 2));
  const opInc = Math.round(revenue * pick(-0.05, 0.22, 3));
  const netInc = Math.round(opInc * pick(0.6, 0.95, 2));
  financials.push({ code, fiscal_year: 2025, price, market_cap: mcap, per, pbr, roe, debt_ratio: debt, eps, bps, revenue, operating_income: opInc, net_income: netInc, as_of: AS_OF });

  const pays = isFin ? r() < 0.97 : isGrowth ? r() < 0.25 : r() < 0.75;
  const dy = pays ? (isFin ? pick(3.5, 8.5, 2) : pick(0.4, 6.0, 2)) : 0;
  const dps = pays ? Math.round((price * dy) / 100 / 10) * 10 : 0;
  const payout = pays && eps > 0 ? Number(Math.min(120, (dps / eps) * 100).toFixed(1)) : null;
  const years = pays ? Math.round(pick(1, isFin ? 20 : 15, 0)) : 0;
  // 지급월: 대형 우량주 일부 분기배당, 금융 일부 반기, 나머지 연배당(4월)
  const quarterly = pays && (["005930","000660","005380","000270","105560","055550","086790","316140","017670","030200","033780","012330"].includes(code));
  const semi = pays && !quarterly && isFin && r() < 0.5;
  const pay_months = !pays ? null : quarterly ? [4, 5, 8, 11] : semi ? [4, 8] : [4];
  dividends.push({ code, fiscal_year: 2025, dps, dividend_yield: dy, payout_ratio: payout, consecutive_years: years, ex_dividend_date: pays ? "2025-12-29" : null, pay_months, as_of: AS_OF });
}

const stocks = UNIVERSE.map(([code, name, market, sector]) => ({ code, name, market, sector }));
mkdirSync("data", { recursive: true });
writeFileSync("data/sample-stocks.json", JSON.stringify({ _note: "합성 샘플 데이터 — 실제 재무·시세 아님. 파이프라인 연결 전 UI 확인용.", as_of: AS_OF, stocks, financials, dividends }, null, 1));
console.log(`sample: ${stocks.length} stocks → data/sample-stocks.json`);
