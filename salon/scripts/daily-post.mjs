// 정화 머리방 Phase 2 — 매일 콘텐츠 초안 1개 생성 (GitHub Actions 크론에서 실행).
//
//   node --experimental-strip-types scripts/daily-post.mjs   (= npm run daily-post)
//
// 출력: content/drafts/YYYY-MM-DD.md  — 사람이 확인하고 고친 뒤에 게시하는 "초안"이다.
// 자동 게시는 하지 않는다.
//
// 설계 메모
// - 고객 DB·사진에 접근하지 않는다. 주제 기반 일반 콘텐츠만 쓰므로 consent_photo 동의
//   문제가 구조적으로 발생할 수 없다 (스펙의 "consent_photo=false면 생성 차단"을
//   데이터를 아예 쓰지 않는 쪽으로 만족시킨다).
// - ANTHROPIC_API_KEY 가 없으면 경고만 남기고 성공 종료 (가드 스킵).
// - 같은 날짜 파일이 이미 있으면 재생성하지 않는다 (--force 로 강제).
// - 생성물이 금지 표현·구조 검사를 통과하지 못하면 1회 재작성시키고, 그래도 실패하면
//   아무것도 쓰지 않고 실패로 끝낸다 (나쁜 초안을 커밋하지 않는다).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { todayKST } from "../lib/dates.ts";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  pickHashtags,
  pickHook,
  pickTopic,
  renderDraft,
  usedTopicKeys,
  validateDraft,
} from "../lib/content.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const DRAFT_DIR = path.join(here, "..", "content", "drafts");
const MODEL = process.env.SALON_POST_MODEL?.trim() || "claude-opus-5-5";
const RECENT_WINDOW = 14; // 최근 2주 주제는 피한다
const force = process.argv.includes("--force");

function warn(msg) {
  // GitHub Actions 로그 주석 (로컬에서는 그냥 한 줄)
  console.warn(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `[warn] ${msg}`);
}

function summary(lines) {
  console.log(lines.join("\n"));
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) fs.appendFileSync(file, `${lines.join("\n")}\n`);
}

function textOf(message) {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function ask(client, messages) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM_PROMPT,
    messages,
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("모델이 생성을 거부했다 (stop_reason=refusal). 주제를 조정해야 한다.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("출력이 max_tokens 에서 잘렸다. 분량 지시를 줄여야 한다.");
  }
  return { text: textOf(message), usage: message.usage };
}

async function main() {
  const dateStr = process.env.SALON_POST_DATE?.trim() || todayKST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`SALON_POST_DATE 형식이 잘못됐다: ${dateStr}`);
  }

  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  const outPath = path.join(DRAFT_DIR, `${dateStr}.md`);
  if (fs.existsSync(outPath) && !force) {
    summary([`오늘(${dateStr}) 초안이 이미 있다 — 생성 스킵: content/drafts/${dateStr}.md`]);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    warn("ANTHROPIC_API_KEY 미설정 — 콘텐츠 생성 스킵 (리포 Settings → Secrets → Actions 에 등록)");
    return;
  }

  const existing = fs
    .readdirSync(DRAFT_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse()
    .slice(0, RECENT_WINDOW)
    .map((f) => fs.readFileSync(path.join(DRAFT_DIR, f), "utf8"));

  const topic = pickTopic(dateStr, usedTopicKeys(existing));
  const hook = pickHook(dateStr);
  const hashtags = pickHashtags(dateStr);
  const userPrompt = buildUserPrompt(topic, hook, dateStr);

  const client = new Anthropic();
  let attempt = await ask(client, [{ role: "user", content: userPrompt }]);
  let check = validateDraft(attempt.text);

  if (!check.ok) {
    warn(`1차 초안 검사 실패 — 재작성 요청: ${check.problems.join(" / ")}`);
    attempt = await ask(client, [
      { role: "user", content: userPrompt },
      { role: "assistant", content: attempt.text },
      {
        role: "user",
        content: [
          "아래 문제를 고쳐서 전체를 처음부터 다시 출력한다. 섹션 제목과 순서는 그대로 유지한다.",
          ...check.problems.map((p) => `- ${p}`),
        ].join("\n"),
      },
    ]);
    check = validateDraft(attempt.text);
  }

  if (!check.ok) {
    throw new Error(`초안이 검사를 통과하지 못했다 (파일 쓰지 않음):\n- ${check.problems.join("\n- ")}`);
  }

  fs.writeFileSync(
    outPath,
    renderDraft({ dateStr, topic, hook, hashtags, body: attempt.text, model: MODEL }),
    "utf8",
  );

  summary([
    `### 정화 머리방 콘텐츠 초안 ${dateStr}`,
    "",
    `- 주제: ${topic.title} (\`${topic.key}\`)`,
    `- 후킹 형식: ${hook.label}`,
    `- 해시태그: ${hashtags.length}개`,
    `- 파일: \`salon/content/drafts/${dateStr}.md\``,
    `- 토큰: in ${attempt.usage.input_tokens} / out ${attempt.usage.output_tokens}`,
    "",
    "> 사장님 확인 후 게시. 자동 게시는 하지 않는다.",
  ]);
}

try {
  await main();
} catch (err) {
  if (err instanceof Anthropic.APIError) {
    console.error(`[error] Claude API ${err.status ?? ""} ${err.name}: ${err.message}`);
  } else {
    console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exitCode = 1;
}
