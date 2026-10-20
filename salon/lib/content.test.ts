import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GENERAL_TAGS,
  HOOKS,
  LOCAL_TAGS,
  SERVICE_TAGS,
  TOPICS,
  buildUserPrompt,
  dayIndex,
  pickHashtags,
  pickHook,
  pickTopic,
  renderDraft,
  usedTopicKeys,
  validateDraft,
} from "./content.ts";

test("주제 키는 중복되지 않는다", () => {
  assert.equal(new Set(TOPICS.map((t) => t.key)).size, TOPICS.length);
  assert.ok(TOPICS.length >= 30, "한 달 이상 돌 수 있어야 한다");
});

test("해시태그 풀에 중복이 없다", () => {
  for (const pool of [LOCAL_TAGS, SERVICE_TAGS, GENERAL_TAGS]) {
    assert.equal(new Set(pool).size, pool.length);
    assert.ok(pool.every((t) => t.startsWith("#")));
  }
});

test("dayIndex 는 하루에 1씩 증가한다", () => {
  assert.equal(dayIndex("2026-10-21") - dayIndex("2026-10-20"), 1);
  assert.equal(dayIndex("2027-01-01") - dayIndex("2026-12-31"), 1);
});

test("pickTopic 은 날짜마다 돌아가고 최근 주제를 피한다", () => {
  const a = pickTopic("2026-10-20");
  const b = pickTopic("2026-10-21");
  assert.notEqual(a.key, b.key);
  const avoided = pickTopic("2026-10-20", [a.key]);
  assert.notEqual(avoided.key, a.key);
  // 전부 최근에 썼으면 회전 순서대로 되돌아간다 (무한루프 금지)
  const all = TOPICS.map((t) => t.key);
  assert.equal(pickTopic("2026-10-20", all).key, a.key);
});

test("pickHook 은 5종을 순환한다", () => {
  const keys = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"].map(
    (d) => pickHook(d).key,
  );
  assert.equal(new Set(keys).size, HOOKS.length);
  assert.equal(pickHook("2026-10-25").key, keys[0], "6일째에 처음 형식으로 돌아온다");
});

test("해시태그는 로컬 5 + 시술 5 + 일반 5 = 15개", () => {
  const tags = pickHashtags("2026-10-20");
  assert.equal(tags.length, 15);
  assert.equal(new Set(tags).size, 15);
  assert.equal(tags.slice(0, 5).filter((t) => LOCAL_TAGS.includes(t)).length, 5);
  assert.equal(tags.slice(5, 10).filter((t) => SERVICE_TAGS.includes(t)).length, 5);
  assert.equal(tags.slice(10).filter((t) => GENERAL_TAGS.includes(t)).length, 5);
  assert.notDeepEqual(pickHashtags("2026-10-21"), tags, "날짜마다 조합이 바뀐다");
});

test("buildUserPrompt 에 주제·형식·섹션 구조가 들어간다", () => {
  const p = buildUserPrompt(TOPICS[0], HOOKS[0], "2026-10-20");
  assert.match(p, /2026-10-20/);
  assert.match(p, new RegExp(TOPICS[0].title));
  assert.match(p, /## 블로그 본문/);
  assert.match(p, /해시태그는 쓰지 않는다/);
});

const GOOD = `## 제목
원주 붙임머리, 처음이라 망설여질 때

## 블로그 본문

### 먼저 확인하는 것
${"붙임머리를 처음 하시는 분들은 모발 상태를 먼저 보는 편이 좋습니다. ".repeat(11)}

### 유지 기간
${"유지 기간은 사람마다 다르고, 보통 몇 주 단위로 다시 보게 됩니다. ".repeat(11)}

원주에서 가발이나 붙임머리로 고민 중이시면 편하게 물어보셔도 됩니다. 상담만 받고 가셔도 괜찮습니다.

## 스레드 캡션
처음 붙임머리를 알아볼 때 가장 많이 듣는 질문을 모아봤습니다.

모발 상태부터 보고 방식을 정하는 편이 덜 번거롭습니다.

## 사장님 확인
- 유지 기간 표현이 실제 설명과 같은지
- 방식 이름이 우리 시술과 맞는지
- 상담 안내 문장이 과하지 않은지
`;

test("정상 초안은 통과한다", () => {
  const v = validateDraft(GOOD);
  assert.deepEqual(v.problems, []);
  assert.ok(v.ok);
});

test("섹션이 빠지면 잡아낸다", () => {
  const v = validateDraft(GOOD.replace("## 스레드 캡션", "## 캡션"));
  assert.ok(!v.ok);
  assert.ok(v.problems.some((p) => p.includes("## 스레드 캡션")));
});

test("의학적 주장·보장·비하·개인정보를 잡아낸다", () => {
  for (const [bad, why] of [
    ["탈모 치료 효과가 있습니다", "치료"],
    ["부작용 없이 100% 유지됩니다", "보장"],
    ["못생긴 얼굴형도 커버", "비하"],
    ["연락처는 010-1234-5678", "전화"],
    ["주민번호를 적어주세요", "민감정보"],
  ] as const) {
    const v = validateDraft(`${GOOD}\n${bad}`);
    assert.ok(!v.ok, `${why} 표현을 통과시켰다`);
  }
});

test("본문에 해시태그가 섞이면 잡아낸다", () => {
  const v = validateDraft(`${GOOD}\n#원주미용실`);
  assert.ok(v.problems.some((p) => p.includes("해시태그")));
});

test("renderDraft 는 front matter 와 해시태그를 붙인다", () => {
  const out = renderDraft({
    dateStr: "2026-10-20",
    topic: TOPICS[0],
    hook: HOOKS[0],
    hashtags: pickHashtags("2026-10-20"),
    body: GOOD,
    model: "test-model",
  });
  assert.match(out, /^---\ndate: 2026-10-20\n/);
  assert.match(out, new RegExp(`topic: ${TOPICS[0].key}`));
  assert.match(out, /status: draft/);
  assert.match(out, /## 해시태그/);
  assert.match(out, /사장님이 사실 확인하고/);
  assert.deepEqual(usedTopicKeys([out]), [TOPICS[0].key]);
});
