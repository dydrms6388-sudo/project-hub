"use client";

/**
 * 문장 임베딩 (@huggingface/transformers + Xenova/multilingual-e5-small).
 *
 * ⚠️ transformers 도 정적 import 하지 않는다. 사용자가 "문서 색인"을 시작한 뒤에만
 *    await import 로 받아 초기 번들을 가볍게 유지한다.
 *
 * e5 계열 모델은 접두사가 성능에 직접 영향을 준다.
 *   - 검색 질의: "query: " + 문장
 *   - 본문 문단: "passage: " + 문장
 */

import { EMBED_MODEL } from "./models";

export type EmbedProgress = { pct: number; text: string };

type ProgressEvent = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type Extractor = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let extractor: Extractor | null = null;
let inflight: Promise<Extractor> | null = null;

export function isEmbedderReady(): boolean {
  return extractor !== null;
}

export async function getEmbedder(onProgress?: (p: EmbedProgress) => void): Promise<Extractor> {
  if (extractor) return extractor;
  if (inflight) return inflight;
  inflight = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // 로컬 /models 경로 탐색을 끄고 허브에서 바로 받는다(브라우저 캐시에 저장됨).
    env.allowLocalModels = false;
    const pipe = await pipeline("feature-extraction", EMBED_MODEL.id, {
      dtype: "q8",
      progress_callback: (e: ProgressEvent) => {
        const pct = typeof e.progress === "number" ? e.progress : 0;
        onProgress?.({
          pct: Math.max(0, Math.min(100, pct)),
          text: e.status === "progress" ? `임베딩 모델 내려받는 중 ${e.file ?? ""}` : (e.status ?? ""),
        });
      },
    } as Parameters<typeof pipeline>[2]);
    extractor = pipe as unknown as Extractor;
    return extractor;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

const BATCH = 8;

/** 여러 문단을 임베딩(검색 대상). 반환 벡터는 L2 정규화되어 있다. */
export async function embedPassages(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: { aborted: boolean },
): Promise<number[][]> {
  const pipe = await getEmbedder();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    if (signal?.aborted) throw new Error("작업이 취소되었습니다.");
    const batch = texts.slice(i, i + BATCH).map((t) => `passage: ${t}`);
    const res = await pipe(batch, { pooling: "mean", normalize: true });
    out.push(...res.tolist());
    onProgress?.(Math.min(i + BATCH, texts.length), texts.length);
  }
  return out;
}

/** 질의 1건 임베딩. */
export async function embedQuery(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const res = await pipe([`query: ${text}`], { pooling: "mean", normalize: true });
  return res.tolist()[0];
}
