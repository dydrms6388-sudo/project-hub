"use client";

import { detectWebGPU } from "@/lib/capability";

/**
 * 배경 제거 (briaai/RMBG-1.4 · transformers.js).
 *
 * 이 모듈의 전제:
 *  1. `@huggingface/transformers` 와 모델 가중치(약 40MB)는 **사용자가 버튼을 누른 뒤에만** 받는다.
 *     따라서 아래 import 는 전부 함수 안의 `await import(...)` 이다. 초기 번들에 들어가지 않는다.
 *  2. 모델 가중치는 리포에 커밋하지 않고 런타임에 Hugging Face 허브에서 받는다.
 *  3. **실패해도 사이트가 죽지 않는다.** 호출부는 예외를 잡아 배경 제거만 건너뛰고
 *     크롭·규격 맞춤·300dpi 저장·인화 배치를 그대로 제공해야 한다.
 */

export type BgProgress = {
  /** 0~100 */
  percent: number;
  /** 사용자에게 보여줄 단계 문구 */
  label: string;
};

export type BgBackend = "webgpu" | "wasm";

export type MaskData = Uint8Array | Uint8ClampedArray;

export type BgMask = {
  data: MaskData;
  width: number;
  height: number;
  backend: BgBackend;
};

const MODEL_ID = "briaai/RMBG-1.4";

type LoadedModel = {
  // transformers.js 타입을 정적으로 끌어오면 초기 번들에 타입 외 코드가 섞일 위험이 있어
  // 의도적으로 구조만 최소한으로 명시한다.
  model: (inputs: { input: unknown }) => Promise<{ output: unknown[] }>;
  processor: (image: unknown) => Promise<{ pixel_values: unknown }>;
  RawImage: {
    fromURL: (url: string) => Promise<{ width: number; height: number }>;
    fromTensor: (t: unknown) => { resize: (w: number, h: number) => Promise<{ data: MaskData }> };
  };
  backend: BgBackend;
};

let cached: Promise<LoadedModel> | null = null;

/** WebGPU 지원 여부에 따른 백엔드 선택 */
export function pickBackend(): BgBackend {
  return detectWebGPU() ? "webgpu" : "wasm";
}

async function load(onProgress: (p: BgProgress) => void): Promise<LoadedModel> {
  if (cached) return cached;

  cached = (async () => {
    onProgress({ percent: 1, label: "라이브러리 준비 중…" });

    // ⚠️ 여기서 처음 로드된다. 정적 import 로 올리지 말 것.
    const tf = await import("@huggingface/transformers");
    const { AutoModel, AutoProcessor, RawImage, env } = tf;

    // 로컬 모델 폴더를 찾지 않도록(정적 사이트라 없음) 허브에서만 받는다.
    env.allowLocalModels = false;

    const backend = pickBackend();

    // 여러 파일(모델·설정)의 다운로드 진행률을 합산해서 하나의 퍼센트로 보여 준다.
    const bytes = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (e: unknown) => {
      const p = e as { status?: string; file?: string; loaded?: number; total?: number };
      if (p.status === "progress" && p.file && typeof p.total === "number" && p.total > 0) {
        bytes.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        let l = 0;
        let t = 0;
        for (const v of bytes.values()) {
          l += v.loaded;
          t += v.total;
        }
        const pct = t > 0 ? Math.min(97, Math.round((l / t) * 95) + 2) : 2;
        onProgress({
          percent: pct,
          label: `모델 내려받는 중 ${(l / 1024 / 1024).toFixed(1)} / ${(t / 1024 / 1024).toFixed(1)} MB`,
        });
      } else if (p.status === "ready") {
        onProgress({ percent: 98, label: "모델 준비 완료" });
      }
    };

    const model = (await AutoModel.from_pretrained(MODEL_ID, {
      // RMBG-1.4 는 표준 아키텍처가 아니라 custom 으로 로드한다.
      config: { model_type: "custom" } as never,
      device: backend,
      // q8 로 떨어지면 머리카락 경계가 뭉개진다 — 품질을 위해 fp32 를 명시한다(약 44MB).
      dtype: "fp32",
      progress_callback,
    })) as unknown as LoadedModel["model"];

    const processor = (await AutoProcessor.from_pretrained(MODEL_ID, {
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        image_std: [1, 1, 1],
        feature_extractor_type: "ImageFeatureExtractor",
        resample: 2,
        size: { width: 1024, height: 1024 },
      } as never,
      progress_callback,
    })) as unknown as LoadedModel["processor"];

    onProgress({ percent: 99, label: "모델 준비 완료" });
    return { model, processor, RawImage: RawImage as unknown as LoadedModel["RawImage"], backend };
  })();

  try {
    return await cached;
  } catch (e) {
    cached = null; // 실패한 캐시는 버려서 재시도가 가능하게 한다
    throw e;
  }
}

/**
 * 이미지 URL(blob:/data:) 에서 인물 알파 마스크를 뽑는다.
 * 반환 마스크는 원본 이미지 크기와 같은 1채널 Uint8Array (255 = 인물).
 */
export async function extractMask(
  imageUrl: string,
  onProgress: (p: BgProgress) => void,
): Promise<BgMask> {
  const { model, processor, RawImage, backend } = await load(onProgress);

  onProgress({ percent: 99, label: "배경을 분리하는 중…" });
  const image = await RawImage.fromURL(imageUrl);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });

  const first = output[0] as { mul: (n: number) => { to: (t: string) => unknown } };
  const mask = await RawImage.fromTensor(first.mul(255).to("uint8")).resize(
    image.width,
    image.height,
  );

  onProgress({ percent: 100, label: "완료" });
  return { data: mask.data, width: image.width, height: image.height, backend };
}

/** 이미 로드된 모델이 있는지 (버튼 문구 전환용) */
export const isModelLoaded = () => cached !== null;
