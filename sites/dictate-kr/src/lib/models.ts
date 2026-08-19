/**
 * Whisper 모델 카탈로그.
 *
 * ⚠️ 여기 적힌 수치는 **공개된 사실만** 담는다.
 *   - 파라미터 수: OpenAI Whisper 공개 모델 카드의 값.
 *   - 다운로드 용량·처리 속도: 기기/브라우저/양자화에 따라 달라지므로 **적지 않는다.**
 *     실제 값은 /tools/compare-models 의 벤치마크가 사용자 기기에서 직접 측정한다.
 */

export type ModelKey = "tiny" | "base" | "small";
export type Device = "webgpu" | "wasm";
export type Dtype = "fp32" | "fp16" | "q8" | "q4";

export type ModelInfo = {
  key: ModelKey;
  /** Hugging Face 리포지터리 ID */
  id: string;
  label: string;
  /** OpenAI 공개 파라미터 수 */
  params: number;
  paramsLabel: string;
  /** 어떤 상황에 쓰라는 안내 */
  use: string;
  hfUrl: string;
};

export const MODELS: ModelInfo[] = [
  {
    key: "tiny",
    id: "onnx-community/whisper-tiny",
    label: "tiny — 가장 빠름",
    params: 39_000_000,
    paramsLabel: "3,900만",
    use: "모바일, 짧은 메모, 초안. 조용한 환경의 또박또박한 발화에 적당합니다.",
    hfUrl: "https://huggingface.co/onnx-community/whisper-tiny",
  },
  {
    key: "base",
    id: "onnx-community/whisper-base",
    label: "base — 중간",
    params: 74_000_000,
    paramsLabel: "7,400만",
    use: "속도와 정확도의 절충. 노트북에서 10분 내외 녹음에 무난합니다.",
    hfUrl: "https://huggingface.co/onnx-community/whisper-base",
  },
  {
    key: "small",
    id: "onnx-community/whisper-small",
    label: "small — 가장 정확 (기본값)",
    params: 244_000_000,
    paramsLabel: "2억 4,400만",
    use: "회의록·강의처럼 정확도가 중요한 긴 녹음. PC 크롬/엣지 권장.",
    hfUrl: "https://huggingface.co/onnx-community/whisper-small",
  },
];

export const modelByKey = (k: ModelKey): ModelInfo =>
  MODELS.find((m) => m.key === k) ?? MODELS[2];

/** 첫 방문 기본값: 모바일이면 tiny, 아니면 small */
export function defaultModelKey(mobile: boolean): ModelKey {
  return mobile ? "tiny" : "small";
}

/**
 * 실행 백엔드 선택.
 * WebGPU 가 있으면 GPU 로, 없으면 WebAssembly 로 떨어뜨린다.
 * WASM 경로에서는 8비트 정수 양자화(q8)를 써야 CPU 로도 견딜 만한 속도가 나온다.
 */
export function pickBackend(hasWebGPU: boolean): { device: Device; dtype: Dtype } {
  return hasWebGPU ? { device: "webgpu", dtype: "fp32" } : { device: "wasm", dtype: "q8" };
}

/** 1차 시도가 실패했을 때 떨어질 안전한 조합 */
export const FALLBACK_BACKEND: { device: Device; dtype: Dtype } = { device: "wasm", dtype: "q8" };

export type Language = "auto" | "ko";

/** transformers.js 가 받는 언어 이름. auto 는 모델이 직접 판별한다. */
export function languageArg(lang: Language): string | null {
  return lang === "ko" ? "korean" : null;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** transformers.js 가 쓰는 브라우저 캐시 이름 */
export const CACHE_NAME_HINT = "transformers-cache";

/** 내려받아 둔 모델 캐시를 지운다. 지운 캐시 이름 목록을 돌려준다. */
export async function clearModelCache(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const names = await caches.keys();
  const targets = names.filter((n) => n.includes("transformers"));
  await Promise.all(targets.map((n) => caches.delete(n)));
  return targets;
}
