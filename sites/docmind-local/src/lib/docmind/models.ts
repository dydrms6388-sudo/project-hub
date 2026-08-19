/**
 * 브라우저에서 돌릴 LLM 후보 목록.
 *
 * 여기 적힌 model_id / vram_required_MB / context_window_size 는 설치된
 * @mlc-ai/web-llm 패키지의 prebuiltAppConfig.model_list 값을 그대로 옮긴 것이다.
 * (node -e "require('@mlc-ai/web-llm').prebuiltAppConfig.model_list" 로 확인 가능)
 *
 * ⚠️ 한국어 출력 품질은 이 저장소에서 측정하지 않았다. GPU/WebGPU 가 없는 환경에서
 *    작성됐기 때문이다. 기본값은 아래 "근거"에 적힌 공개 정보만으로 골랐으며,
 *    사용자가 UI 에서 직접 바꿔 비교할 수 있게 해 두었다. (README 참고)
 */

export type ModelInfo = {
  id: string;
  label: string;
  /** 파라미터 수 표기 */
  params: string;
  /** web-llm 모델 목록의 vram_required_MB */
  vramMB: number;
  /** 컨텍스트 윈도(토큰) */
  contextWindow: number;
  /** WebGPU 확장 요구사항 */
  requiredFeatures?: string[];
  /** 선택 근거(측정값 아님) */
  note: string;
};

export const MODELS: ModelInfo[] = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 1.5B Instruct (4bit)",
    params: "15억",
    vramMB: 1629.75,
    contextWindow: 4096,
    note: "기본값. 모델 카드가 한국어를 포함한 29개 이상 언어 지원을 명시하고, 후보 중 VRAM 요구가 가장 낮으며 shader-f16 확장이 필요 없다.",
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    label: "Gemma 2 2B IT (4bit)",
    params: "26억",
    vramMB: 1895.3,
    contextWindow: 4096,
    requiredFeatures: ["shader-f16"],
    note: "파라미터가 더 많아 문장이 매끄러울 수 있으나, 구글 모델 카드는 영어 중심으로 기술한다. shader-f16 미지원 GPU 에서는 로드되지 않는다.",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 3B Instruct (4bit)",
    params: "30억",
    vramMB: 2504.76,
    contextWindow: 4096,
    note: "같은 계열의 큰 모델. VRAM 2.5GB 이상 여유가 있는 PC 전용. 다운로드가 가장 오래 걸린다.",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 0.5B Instruct (4bit)",
    params: "5억",
    vramMB: 944.62,
    contextWindow: 4096,
    note: "저사양/동작 확인용. 가장 빠르고 가볍지만 요약 품질이 눈에 띄게 떨어진다.",
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

export function modelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

/** 사용자에게 보여줄 대략적인 최초 다운로드 용량(가중치 크기 ≈ VRAM 요구량) */
export function approxDownloadLabel(m: ModelInfo): string {
  return `약 ${(m.vramMB / 1024).toFixed(1)}GB`;
}

/** 임베딩 모델(문서 검색용) — 요약 모델과 별개로 한 번 더 받는다. */
export const EMBED_MODEL = {
  id: "Xenova/multilingual-e5-small",
  label: "multilingual-e5-small",
  note: "다국어(한국어 포함) 문장 임베딩. 8bit 양자화 기준 100MB대이며, 질의에는 'query: ', 문단에는 'passage: ' 접두사를 붙여야 성능이 나온다.",
} as const;
