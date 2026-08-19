"use client";

/**
 * @mlc-ai/web-llm 래퍼.
 *
 * ⚠️ 이 파일은 web-llm 을 정적으로 import 하지 않는다(타입만 import type).
 *    실제 라이브러리는 사용자가 "모델 준비" 버튼을 누른 뒤에만 await import 로 받는다.
 *    → 초기 번들(First Load JS)에 web-llm 이 들어가지 않는다.
 */

import type { InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";
import type { ChatMessage } from "./prompts";

export type LoadProgress = {
  /** 0~100 */
  pct: number;
  text: string;
  /** 남은 시간(초). 계산 불가면 null */
  etaSec: number | null;
  elapsedSec: number;
};

let engine: MLCEngineInterface | null = null;
let loadedModelId: string | null = null;
let inflight: Promise<MLCEngineInterface> | null = null;

export function currentModelId(): string | null {
  return loadedModelId;
}

/** 브라우저 Cache Storage 에 모델이 이미 받아져 있는지 */
export async function isModelCached(modelId: string): Promise<boolean> {
  try {
    const webllm = await import("@mlc-ai/web-llm");
    return await webllm.hasModelInCache(modelId);
  } catch {
    return false;
  }
}

export async function deleteModelFromCache(modelId: string): Promise<void> {
  const webllm = await import("@mlc-ai/web-llm");
  if (loadedModelId === modelId) await unloadEngine();
  await webllm.deleteModelAllInfoInCache(modelId);
}

export async function unloadEngine(): Promise<void> {
  if (engine) {
    try {
      await engine.unload();
    } catch {
      /* 이미 내려간 경우 무시 */
    }
  }
  engine = null;
  loadedModelId = null;
  inflight = null;
}

/**
 * 엔진 확보. 같은 모델이면 이미 로드된 인스턴스를 재사용한다.
 * 다운로드는 Cache Storage 에 샤드 단위로 저장되므로, 중간에 탭을 닫아도
 * 다시 호출하면 받다 만 지점부터 이어받는다.
 */
export async function getEngine(
  modelId: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<MLCEngineInterface> {
  if (engine && loadedModelId === modelId) return engine;
  if (inflight && loadedModelId === modelId) return inflight;
  if (engine && loadedModelId !== modelId) await unloadEngine();

  loadedModelId = modelId;
  const started = Date.now();
  inflight = (async () => {
    const webllm = await import("@mlc-ai/web-llm");
    const initProgressCallback = (r: InitProgressReport) => {
      const elapsed = r.timeElapsed || (Date.now() - started) / 1000;
      const p = Math.max(0, Math.min(1, r.progress));
      const eta = p > 0.02 && p < 1 ? Math.round((elapsed * (1 - p)) / p) : null;
      onProgress?.({
        pct: p * 100,
        text: r.text,
        etaSec: eta,
        elapsedSec: Math.round(elapsed),
      });
    };
    const e = await webllm.CreateMLCEngine(modelId, { initProgressCallback });
    engine = e;
    loadedModelId = modelId;
    return e;
  })();

  try {
    return await inflight;
  } catch (err) {
    engine = null;
    loadedModelId = null;
    throw err;
  } finally {
    inflight = null;
  }
}

export type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
  /** 토큰이 나올 때마다 호출(스트리밍 표시용) */
  onToken?: (delta: string, full: string) => void;
  signal?: { aborted: boolean };
};

/** 현재 생성 중인 응답을 중단한다. */
export async function interrupt(): Promise<void> {
  if (engine) await engine.interruptGenerate();
}

/**
 * 스트리밍 생성. onToken 으로 델타를 흘려보내고 전체 문자열을 반환한다.
 */
export async function generate(
  messages: ChatMessage[],
  opts: GenerateOptions = {},
): Promise<string> {
  if (!engine) throw new Error("모델이 아직 준비되지 않았습니다.");
  const stream = await engine.chat.completions.create({
    stream: true,
    messages: messages as unknown as Parameters<
      MLCEngineInterface["chat"]["completions"]["create"]
    >[0]["messages"],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 700,
  });
  let full = "";
  for await (const chunk of stream) {
    if (opts.signal?.aborted) {
      await engine.interruptGenerate();
      break;
    }
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      opts.onToken?.(delta, full);
    }
  }
  return full.trim();
}

/** 모델 응답에서 흔한 군더더기 제거 */
export function tidy(text: string): string {
  return text
    .replace(/^(네[,.]?|알겠습니다[,.]?|물론입니다[,.]?)\s*/g, "")
    .replace(/^(다음은|아래는)[^\n]*요약입니다[.:]\s*/g, "")
    .trim();
}
