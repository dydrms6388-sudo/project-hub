#!/usr/bin/env node
/**
 * 동행복권 공개 엔드포인트에서 로또 회차 결과를 받아 data/draws.json 을 증분 갱신한다.
 *
 *   node scripts/fetch-draws.mjs
 *
 * - draws.json 의 마지막 회차 이후만 순차 요청 (1회차부터 시작 가능)
 * - 요청 간 딜레이(기본 400ms)로 서버 부하 방지
 * - returnValue !== "success" → 최신 회차 도달로 보고 정상 종료
 * - 네트워크/파싱 실패 → 그때까지 수집분 저장 후 종료 코드 1 (가짜 데이터 생성 금지)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'draws.json');
const ENDPOINT = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';
const DELAY_MS = Number(process.env.FETCH_DELAY_MS || 400);
const MAX_PER_RUN = Number(process.env.MAX_DRAWS_PER_RUN || 1300); // 폭주 방지 상한

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadExisting() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('draws.json is not an array');
    return arr.sort((a, b) => a.round - b.round);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function toRecord(json) {
  const numbers = [
    json.drwtNo1, json.drwtNo2, json.drwtNo3,
    json.drwtNo4, json.drwtNo5, json.drwtNo6,
  ].map(Number).sort((a, b) => a - b);

  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) {
    throw new Error(`round ${json.drwNo}: invalid numbers ${numbers.join(',')}`);
  }
  const bonus = Number(json.bnusNo);
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45) {
    throw new Error(`round ${json.drwNo}: invalid bonus ${json.bnusNo}`);
  }
  return {
    round: Number(json.drwNo),
    date: String(json.drwNoDate),          // YYYY-MM-DD
    numbers,
    bonus,
    firstPrize: Number(json.firstWinamnt), // 1등 1인당 당첨금(원)
    firstWinners: Number(json.firstPrzwnerCo), // 1등 당첨자 수
  };
}

async function fetchRound(round) {
  const res = await fetch(ENDPOINT + round, {
    headers: { 'User-Agent': 'lottolab-kr-fetcher/1.0 (static site data sync)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for round ${round}`);
  const json = await res.json();
  if (json.returnValue !== 'success') return null; // 아직 추첨 전 회차
  return toRecord(json);
}

async function save(draws) {
  draws.sort((a, b) => a.round - b.round);
  await writeFile(DATA_FILE, JSON.stringify(draws, null, 1) + '\n', 'utf8');
}

async function main() {
  const draws = await loadExisting();
  const last = draws.length ? draws[draws.length - 1].round : 0;
  let round = last + 1;
  let added = 0;

  console.log(`existing draws: ${draws.length} (last round: ${last || 'none'})`);

  while (added < MAX_PER_RUN) {
    let rec;
    try {
      rec = await fetchRound(round);
    } catch (err) {
      console.error(`fetch failed at round ${round}: ${err.message}`);
      if (added > 0) await save(draws);
      console.error(`aborted. saved ${added} new draw(s) before failure.`);
      process.exit(1);
    }
    if (rec === null) {
      console.log(`round ${round} not drawn yet — up to date.`);
      break;
    }
    draws.push(rec);
    added += 1;
    if (added % 50 === 0) {
      await save(draws); // 중간 저장(장시간 초기 수집 대비)
      console.log(`...progress: round ${round} saved (${added} added)`);
    }
    round += 1;
    await sleep(DELAY_MS);
  }

  if (added > 0) {
    await save(draws);
    console.log(`done. added ${added} draw(s), total ${draws.length}, latest round ${draws[draws.length - 1].round}.`);
  } else {
    console.log('no new draws.');
  }
}

main().catch((err) => {
  console.error('unexpected error:', err);
  process.exit(1);
});
