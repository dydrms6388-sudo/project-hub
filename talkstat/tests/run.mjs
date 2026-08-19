// talkstat 파서·분석기 단위 테스트 — `node tests/run.mjs`
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const P = require(join(__dir, '..', 'assets', 'parsers.js'));
const A = require(join(__dir, '..', 'assets', 'analyzer.js'));

const fx = (name) => readFileSync(join(__dir, 'fixtures', name), 'utf8');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.error(`  FAIL ${label}\n       expected ${e}\n       actual   ${a}`); }
}
function ok(cond, label) { eq(!!cond, true, label); }

// ── 시간 변환 ─────────────────────────────────────────────
console.log('[time] 오전/오후 → 24시간 변환');
eq(P._to24('오전', 12), 0, '오전 12시 = 0시');
eq(P._to24('오후', 12), 12, '오후 12시 = 12시');
eq(P._to24('오후', 3), 15, '오후 3시 = 15시');
eq(P._to24('오전', 9), 9, '오전 9시 = 9시');

// ── 포맷 감지 ─────────────────────────────────────────────
console.log('[detect] 포맷 자동 감지');
eq(P.detectFormat(fx('android-1-basic.txt')), 'android', 'android-1');
eq(P.detectFormat(fx('ios-1-basic.txt')), 'ios', 'ios-1');
eq(P.detectFormat(fx('pc-1-basic.txt')), 'pc', 'pc-1');
eq(P.detectFormat(fx('pc-3-csv.csv')), 'pc-csv', 'pc-3 (csv)');

// ── Android ──────────────────────────────────────────────
console.log('[android] 기본 파싱');
{
  const r = P.parseAndroid(fx('android-1-basic.txt'));
  eq(r.messages.length, 9, '메시지 9건');
  eq(r.participants.sort(), ['라떼', '모카'], '참여자 2명');
  eq(r.messages[0].text, '점심 먹었어?', '첫 메시지 본문');
  eq(r.messages[0].h, 13, '오후 1시 → 13시');
  const photo = r.messages.filter((m) => m.type === 'photo');
  const emo = r.messages.filter((m) => m.type === 'emoticon');
  eq(photo.length, 1, '사진 1건');
  eq(emo.length, 1, '이모티콘 1건');
}
console.log('[android] 멀티라인 병합 + 삭제 메시지');
{
  const r = P.parseAndroid(fx('android-2-multiline.txt'));
  eq(r.messages.length, 7, '메시지 7건 (멀티라인이 쪼개지지 않음)');
  const first = r.messages[0];
  ok(first.text.includes('1. 서론') && first.text.includes('피드백 부탁해!'),
    '멀티라인(빈 줄 포함) 본문 병합');
  eq(first.text.split('\n').length, 6, '멀티라인 6줄');
  const second = r.messages[1];
  eq(second.text, '목차 좋다\n2번에 그래프 넣으면 어떨까', '두 줄짜리 메시지 병합');
  eq(r.messages.filter((m) => m.type === 'deleted').length, 1, '삭제된 메시지 분류');
  const night = r.messages.find((m) => m.text.startsWith('나도 방금'));
  eq(night.h, 0, '오전 12:03 → 0시');
}
console.log('[android] 시스템 메시지(입장/퇴장) 분리');
{
  const r = P.parseAndroid(fx('android-3-system.txt'));
  eq(r.messages.length, 7, '일반 메시지 7건 (시스템 줄 제외)');
  eq(r.systemEvents.length, 2, '시스템 이벤트 2건');
  eq(r.systemEvents.map((s) => s.kind), ['join', 'leave'], 'join/leave 분류');
  ok(!r.participants.includes('초코님이 들어왔습니다.'), '시스템 줄이 참여자로 오인되지 않음');
}

// ── iOS ──────────────────────────────────────────────────
console.log('[ios] 기본 파싱');
{
  const r = P.parseIos(fx('ios-1-basic.txt'));
  eq(r.messages.length, 8, '메시지 8건');
  eq(r.participants.sort(), ['다람', '도토리'], '참여자 2명');
  eq(r.messages[0].h, 18, '오후 6시 → 18시');
  eq(r.messages.filter((m) => m.type === 'emoticon').length, 1, '이모티콘 분류');
}
console.log('[ios] 멀티라인 병합');
{
  const r = P.parseIos(fx('ios-2-multiline.txt'));
  eq(r.messages.length, 6, '메시지 6건');
  const first = r.messages[0];
  eq(first.text.split('\n').length, 5, '5줄 멀티라인 병합');
  ok(first.text.includes('셋째 날: 시장 구경'), '멀티라인 내용 유지');
  const mid = r.messages.find((m) => m.text.startsWith('자기 전에'));
  eq(mid.h, 0, '오전 12:01 → 0시');
  const noon = r.messages.find((m) => m.text.startsWith('점심 먹으면서'));
  eq(noon.h, 12, '오후 12:30 → 12시');
}
console.log('[ios] 시스템 메시지 분리');
{
  const r = P.parseIos(fx('ios-3-system.txt'));
  eq(r.messages.length, 7, '일반 메시지 7건');
  eq(r.systemEvents.map((s) => s.kind), ['join', 'leave'], 'join/leave 분류');
  const multi = r.messages.find((m) => m.text.startsWith('공지 올릴게요'));
  eq(multi.text.split('\n').length, 3, '공지 멀티라인 병합');
  eq(r.messages.filter((m) => m.type === 'deleted').length, 1, '삭제된 메시지 분류');
}

// ── PC txt ───────────────────────────────────────────────
console.log('[pc] 기본 파싱 (날짜 구분줄에서 날짜 상속)');
{
  const r = P.parsePcTxt(fx('pc-1-basic.txt'));
  eq(r.messages.length, 8, '메시지 8건');
  eq(r.messages[0].d, 17, '구분줄 날짜 상속(17일)');
  eq(r.messages[7].d, 18, '두 번째 구분줄 이후 18일');
  eq(r.messages[4].h, 12, '오후 12:01 → 12시');
  eq(r.messages.filter((m) => m.type === 'photo').length, 1, '사진 분류');
}
console.log('[pc] 멀티라인 + 시스템 줄');
{
  const r = P.parsePcTxt(fx('pc-2-multiline.txt'));
  eq(r.messages.length, 7, '일반 메시지 7건');
  const first = r.messages[0];
  eq(first.text.split('\n').length, 6, '훈련 계획 6줄 병합 (빈 줄 포함)');
  const two = r.messages.find((m) => m.text.startsWith('금요일 기대'));
  eq(two.text, '금요일 기대되네요 ㅎㅎ\n초보라 긴장돼요', '2줄 메시지 병합');
  eq(r.systemEvents.length, 1, '시스템 이벤트 1건');
  eq(r.systemEvents[0].kind, 'join', '입장 분류');
}
console.log('[pc-csv] CSV 파싱 (따옴표 안 줄바꿈 포함)');
{
  const r = P.parsePcCsv(fx('pc-3-csv.csv'));
  eq(r.messages.length, 10, '일반 메시지 10건');
  eq(r.systemEvents.length, 2, '시스템 이벤트 2건 (User 빈 값)');
  const multi = r.messages.find((m) => m.text.startsWith('오늘 할 일'));
  eq(multi.text.split('\n').length, 4, 'CSV 셀 내부 줄바꿈 멀티라인 유지');
  eq(multi.h, 9, '09:05 → 9시');
  eq(r.messages.filter((m) => m.type === 'deleted').length, 1, '삭제된 메시지 분류');
  eq(r.participants.sort(), ['보리', '콩이'], '참여자 2명');
}

// ── parse() 통합 + 오류 ──────────────────────────────────
console.log('[parse] 자동 감지 통합 + 미지원 형식 오류');
{
  eq(P.parse(fx('ios-2-multiline.txt')).format, 'ios', 'parse() 자동 감지');
  let threw = false;
  try { P.parse('아무 내용도 아닌 텍스트\n두 번째 줄'); } catch (e) { threw = e.code === 'UNKNOWN_FORMAT'; }
  ok(threw, '미지원 텍스트는 UNKNOWN_FORMAT 오류');
}

// ── 분석기 ───────────────────────────────────────────────
console.log('[analyzer] 지표 계산');
{
  const parsed = P.parseAndroid(fx('android-1-basic.txt'));
  const r = A.analyze(parsed);
  eq(r.totals.messages, 9, '총 메시지 수');
  const moka = r.perUser.find((u) => u.name === '모카');
  const latte = r.perUser.find((u) => u.name === '라떼');
  eq(moka.messages, 5, '모카 메시지 수');
  eq(latte.messages, 4, '라떼 메시지 수');
  eq(moka.photos + latte.photos, 1, '사진 집계');
  eq(moka.emoticons, 1, '이모티콘 집계');
  ok(latte.laughK >= 1 && latte.laughH >= 1, 'ㅋㅋ/ㅎㅎ 별도 집계');
  // 답장 시간: 발신자 전환 간격 (8/17 13:05→13:07 = 2분 등)
  // 전환 간격: 2분(13:05→07), 2분(13:08→10), 15분(9:30→45), 4분(9:46→50)
  eq(latte.replyCount, 4, '라떼 답장 횟수(8시간 컷 내 전환)');
  eq(latte.medianReplyMs, 3 * 60 * 1000, '라떼 답장 중앙값 3분');
  // 먼저 말 걸기: 첫 메시지 + 8시간 이상 침묵 후 = 모카 2회
  eq(moka.initiations, 2, '모카 먼저 말 걸기 2회');
  eq(latte.initiations, 0, '라떼 먼저 말 걸기 0회');
  // 히트맵: 월요일(1) 13시에 5건
  eq(r.heatmap[1][13], 5, '히트맵 월 13시 = 5');
  eq(r.monthly.length, 1, '월별 1개 구간');
  eq(r.monthly[0].month, '2026-08', '월 키');
  ok(r.longestSilence.gap > 19 * 3600 * 1000, '최장 침묵(월 13:12 → 화 09:30) > 19시간');
  eq(r.longestSilence.endedBy, '모카', '침묵을 깬 사람');
}
console.log('[analyzer] 단어·이모지·글자 수');
{
  const parsed = P.parseIos(fx('ios-1-basic.txt'));
  const r = A.analyze(parsed);
  ok(r.topWords.every((w) => !/^ㅋ+$/.test(w.key) && !/^ㅎ+$/.test(w.key)),
    '단어 목록에 ㅋㅋ/ㅎㅎ 미포함');
  ok(r.topWords.every((w) => !A.STOPWORDS[w.key]), '불용어 제외');
  ok(r.topEmojis.some((e) => e.key === '🍜'), '이모지 🍜 집계');
  ok(r.topEmojis.some((e) => e.key === '💪'), '이모지 💪 집계');
  const doto = r.perUser.find((u) => u.name === '도토리');
  ok(doto.chars > 0, '글자 수(공백 제외) 집계');
  eq(r.goldenHour.hour, 18, '골든타임 18시');
}
console.log('[analyzer] 그룹방(3인) + 시스템 이벤트 제외');
{
  const parsed = P.parsePcTxt(fx('pc-2-multiline.txt'));
  const r = A.analyze(parsed);
  eq(r.totals.participants, 3, '참여자 3명');
  eq(r.totals.systemEvents, 1, '시스템 이벤트는 별도 집계');
  const sum = r.perUser.reduce((s, u) => s + u.messages, 0);
  eq(sum, r.totals.messages, '참여자 합 = 총 메시지');
}

console.log('');
console.log(`결과: ${pass} 통과, ${fail} 실패`);
if (fail > 0) { process.exit(1); }
