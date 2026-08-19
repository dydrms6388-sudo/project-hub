"use client";

/**
 * 맵리듀스 요약 파이프라인 (도구 4개가 공유).
 * mapreduce.ts(순수 로직) 에 실제 LLM 호출을 끼워 넣는 얇은 층이다.
 */

import type { Chunk } from "./chunk";
import { generate, tidy } from "./engine";
import { mapReduce } from "./mapreduce";
import {
  keypointsMap,
  keypointsReduce,
  summarizeMap,
  summarizeReduce,
  translateMap,
  translateReduce,
  type SummaryLength,
} from "./prompts";

export type PipelineKind = "summary" | "keypoints" | "translate";

/** 한 번의 실행에서 map 단계로 처리할 최대 청크 수(체감 속도 보호) */
export const MAX_MAP_CHUNKS = 60;

/** reduce 한 번에 넣을 부분 요약 총 길이(문자) */
const REDUCE_BUDGET = 2800;

export type RunOptions = {
  chunks: Chunk[];
  kind: PipelineKind;
  length?: SummaryLength;
  onStep?: (done: number, total: number, label: string) => void;
  /** 최종 요약 스트리밍 */
  onToken?: (delta: string, full: string) => void;
  signal?: { aborted: boolean };
};

export type RunResult = {
  text: string;
  truncated: boolean;
  usedChunks: number;
  calls: number;
};

export async function runSummaryPipeline(opts: RunOptions): Promise<RunResult> {
  const all = opts.chunks;
  const used = all.slice(0, MAX_MAP_CHUNKS);
  const length: SummaryLength = opts.length ?? "문단";

  const mapPrompt = (c: Chunk) => {
    if (opts.kind === "keypoints") return keypointsMap(c);
    if (opts.kind === "translate") return translateMap(c);
    return summarizeMap(c);
  };
  const reducePrompt = (parts: string[], isFinal: boolean) => {
    if (opts.kind === "keypoints") return keypointsReduce(parts, isFinal);
    if (opts.kind === "translate") return translateReduce(parts, isFinal);
    return summarizeReduce(parts, length, isFinal);
  };

  const finalTokens = opts.kind === "summary" && length === "3줄" ? 260 : 900;

  const res = await mapReduce<Chunk>({
    items: used,
    budget: REDUCE_BUDGET,
    signal: opts.signal,
    onStep: opts.onStep,
    map: async (chunk) => {
      const out = await generate(mapPrompt(chunk), {
        maxTokens: 320,
        temperature: 0.2,
        signal: opts.signal,
      });
      return tidy(out);
    },
    reduce: async (parts, _round, isFinal) => {
      const out = await generate(reducePrompt(parts, isFinal), {
        maxTokens: isFinal ? finalTokens : 500,
        temperature: isFinal ? 0.3 : 0.2,
        signal: opts.signal,
        onToken: isFinal ? opts.onToken : undefined,
      });
      return tidy(out);
    },
  });

  return {
    text: res.result,
    truncated: all.length > used.length,
    usedChunks: used.length,
    calls: res.calls,
  };
}
