/**
 * 전사 결과 자료구조 · 자막 포맷 변환 — 순수 함수만. DOM 의존성 없음.
 * SRT: SubRip. 시:분:초,밀리초 (쉼표)
 * VTT: WebVTT (W3C). 시:분:초.밀리초 (마침표) + "WEBVTT" 헤더 필수
 */

export type Segment = {
  /** 초 단위 시작 */
  start: number;
  /** 초 단위 끝 */
  end: number;
  text: string;
  /** 사용자가 직접 붙인 화자 라벨 (자동 화자분리 아님) */
  speaker?: string;
};

const pad = (n: number, w: number) => String(Math.max(0, Math.floor(n))).padStart(w, "0");

/**
 * 초 → "HH:MM:SS<sep>mmm"
 * 예) 3661.5, "," → "01:01:01,500"
 */
export function formatTimestamp(seconds: number, sep: "," | "." = ","): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  // 부동소수 누적 오차를 피하려고 밀리초 정수로 먼저 반올림한다.
  const totalMs = Math.round(safe * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${sep}${pad(ms, 3)}`;
}

/** "MM:SS" — 화면 표시용 짧은 형식 (1시간 넘으면 H:MM:SS) */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const t = Math.floor(safe);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m, 2)}:${pad(s, 2)}` : `${pad(m, 2)}:${pad(s, 2)}`;
}

/**
 * 모델이 뱉은 타임스탬프를 자막으로 쓸 수 있게 정리한다.
 * - 빈 텍스트 제거, 앞뒤 공백 정리
 * - start > end 이거나 end 가 없는 조각의 길이 보정
 * - 시작 시각 기준 정렬 후, 앞 자막이 뒤 자막을 침범하지 않도록 end 를 당김
 */
export function normalizeSegments(segments: Segment[], totalDuration?: number): Segment[] {
  const cleaned = segments
    .map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((s) => s.text.length > 0)
    .map((s) => {
      const start = Number.isFinite(s.start) && s.start > 0 ? s.start : 0;
      let end = Number.isFinite(s.end) ? s.end : start;
      // 타임스탬프가 없거나 뒤집힌 경우: 글자 수 기준으로 대략적인 길이를 준다.
      if (end <= start) end = start + Math.min(8, Math.max(1, s.text.length / 7));
      return { ...s, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (let i = 0; i < cleaned.length - 1; i++) {
    if (cleaned[i].end > cleaned[i + 1].start) {
      cleaned[i].end = Math.max(cleaned[i].start + 0.1, cleaned[i + 1].start);
    }
  }
  if (typeof totalDuration === "number" && totalDuration > 0) {
    for (const s of cleaned) {
      if (s.end > totalDuration) s.end = totalDuration;
      if (s.start > totalDuration) s.start = totalDuration;
    }
  }
  return cleaned;
}

/** 화자 라벨을 앞에 붙인 한 줄 텍스트 */
function lineOf(s: Segment): string {
  return s.speaker ? `${s.speaker}: ${s.text}` : s.text;
}

export function toSrt(segments: Segment[]): string {
  const list = normalizeSegments(segments);
  return (
    list
      .map((s, i) => {
        const a = formatTimestamp(s.start, ",");
        const b = formatTimestamp(s.end, ",");
        return `${i + 1}\n${a} --> ${b}\n${lineOf(s)}\n`;
      })
      .join("\n") + (list.length ? "" : "")
  );
}

export function toVtt(segments: Segment[]): string {
  const list = normalizeSegments(segments);
  const body = list
    .map((s, i) => {
      const a = formatTimestamp(s.start, ".");
      const b = formatTimestamp(s.end, ".");
      return `${i + 1}\n${a} --> ${b}\n${lineOf(s)}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** 문단(또는 타임스탬프) 형태의 평문 */
export function toTxt(segments: Segment[], opts: { timestamps?: boolean; gapSec?: number } = {}): string {
  const list = normalizeSegments(segments);
  if (opts.timestamps) {
    return list.map((s) => `[${formatClock(s.start)}] ${lineOf(s)}`).join("\n");
  }
  return toParagraphs(list, opts.gapSec ?? 1.2)
    .map((p) => p.text)
    .join("\n\n");
}

export type Paragraph = { start: number; end: number; text: string; speaker?: string };

/**
 * 무음(=자막 사이 공백 시간)이 gapSec 이상이면 새 문단으로 나눈다.
 * 강의처럼 호흡이 긴 녹음에서 사람이 읽을 수 있는 덩어리를 만드는 용도.
 * maxChars 를 넘으면 문단이 지나치게 길어지지 않도록 강제로 끊는다.
 */
export function toParagraphs(
  segments: Segment[],
  gapSec = 1.2,
  maxChars = 600,
): Paragraph[] {
  const list = normalizeSegments(segments);
  const out: Paragraph[] = [];
  let cur: Paragraph | null = null;

  for (const s of list) {
    const speakerChanged = cur != null && (cur.speaker ?? "") !== (s.speaker ?? "");
    const gap = cur ? s.start - cur.end : 0;
    if (!cur || gap >= gapSec || speakerChanged || cur.text.length >= maxChars) {
      if (cur) out.push(cur);
      cur = { start: s.start, end: s.end, text: s.text, speaker: s.speaker };
    } else {
      cur.text = `${cur.text} ${s.text}`.replace(/\s+/g, " ").trim();
      cur.end = s.end;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** 너무 짧은 조각을 뒤 조각과 합친다(자막 가독성). */
export function mergeShort(segments: Segment[], minSec = 1.0, maxChars = 42): Segment[] {
  const list = normalizeSegments(segments);
  const out: Segment[] = [];
  for (const s of list) {
    const prev = out[out.length - 1];
    const tooShort = s.end - s.start < minSec;
    const fits = prev && prev.text.length + s.text.length + 1 <= maxChars;
    const sameSpeaker = prev && (prev.speaker ?? "") === (s.speaker ?? "");
    if (prev && tooShort && fits && sameSpeaker) {
      prev.text = `${prev.text} ${s.text}`.trim();
      prev.end = s.end;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/** 전체 텍스트 */
export function plainText(segments: Segment[]): string {
  return normalizeSegments(segments)
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* 정확도 측정 (모델 비교용) — 사용자가 정답 텍스트를 입력했을 때만 계산   */
/* ------------------------------------------------------------------ */

/** 편집 거리 (Levenshtein). 메모리 절약을 위해 1행 롤링. */
export function levenshtein(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[b.length];
}

/** 비교 전 정규화: 공백 정리, 문장부호 제거, 소문자화 */
export function normalizeForScoring(text: string): string {
  return text
    .replace(/[.,!?;:~"'`‘’“”()\[\]{}<>·…\-—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 문자 오류율 (CER). 한국어는 어절 경계가 불안정해 CER 이 더 안정적이다. */
export function charErrorRate(reference: string, hypothesis: string): number | null {
  const ref = [...normalizeForScoring(reference).replace(/ /g, "")];
  const hyp = [...normalizeForScoring(hypothesis).replace(/ /g, "")];
  if (ref.length === 0) return null;
  return levenshtein(ref, hyp) / ref.length;
}

/** 어절 오류율 (WER). 참고 지표. */
export function wordErrorRate(reference: string, hypothesis: string): number | null {
  const ref = normalizeForScoring(reference).split(" ").filter(Boolean);
  const hyp = normalizeForScoring(hypothesis).split(" ").filter(Boolean);
  if (ref.length === 0) return null;
  return levenshtein(ref, hyp) / ref.length;
}
