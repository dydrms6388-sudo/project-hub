"use client";

import { convertFile } from "./image";
import { yieldToUI, type EncodeOpts } from "./image-core";
import { attachWorker } from "./worker";

export type ConvertResult = {
  name: string;
  blob: Blob | null;
  width: number;
  height: number;
  error: string | null;
  inputSize: number;
};

type WorkerItem = {
  name: string;
  blob: Blob | null;
  width: number;
  height: number;
  error: string | null;
};

export type ProgressCb = (pct: number, label?: string) => void;

/** 워커에게 배치를 넘기고 결과를 받는다. 워커를 못 쓰면 null. */
function viaWorker(
  files: File[],
  opts: EncodeOpts,
  onProgress: ProgressCb,
): Promise<WorkerItem[] | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../tools/impl/img.worker.ts", import.meta.url));
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    let gotMessage = false;
    const finish = (v: WorkerItem[] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      detach();
      resolve(v);
    };
    const detach = attachWorker(worker, {
      onProgress: (value, label) => {
        gotMessage = true;
        onProgress(value, label);
      },
      onDone: (value) => finish(value as WorkerItem[]),
      onError: () => finish(null),
    });
    // 워커 스크립트 자체가 뜨지 않는 환경 대비 — 첫 메시지가 없으면 메인 스레드로 폴백한다.
    // (워커는 첫 파일을 처리하기 전에 progress 를 먼저 보낸다)
    const watchdog = setTimeout(() => {
      if (!gotMessage) finish(null);
    }, 15000);
    try {
      worker.postMessage({ files, opts });
    } catch {
      finish(null);
    }
  });
}

/**
 * 파일 여러 개를 변환한다.
 * 1) 가능하면 Web Worker(OffscreenCanvas) 에서 처리 — 메인 스레드가 멈추지 않는다.
 * 2) 워커가 없거나 개별 파일이 실패하면 메인 스레드에서 다시 시도한다.
 *    (HEIC 는 이 단계에서 heic2any wasm 으로 풀린다)
 *    파일 사이마다 이벤트 루프를 양보해 UI 가 얼지 않게 한다.
 */
export async function convertBatch(
  files: File[],
  opts: EncodeOpts,
  onProgress: ProgressCb,
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = files.map((f) => ({
    name: f.name,
    blob: null,
    width: 0,
    height: 0,
    error: "처리되지 않았습니다.",
    inputSize: f.size,
  }));

  const fromWorker = await viaWorker(files, opts, (pct, label) =>
    onProgress(pct * 0.9, label),
  );
  // 워커가 통째로 실패했으면 재시도 구간이 0~100%, 일부만 실패했으면 90~100% 를 쓴다
  const retryBase = fromWorker ? 90 : 0;
  if (fromWorker && fromWorker.length === files.length) {
    for (let i = 0; i < fromWorker.length; i++) {
      results[i] = { ...fromWorker[i], inputSize: files[i]?.size ?? 0 };
    }
  }

  // 워커가 실패했거나 개별 항목이 실패한 것만 메인 스레드에서 재시도
  const retry = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.blob);
  for (let k = 0; k < retry.length; k++) {
    const { i } = retry[k];
    const f = files[i];
    onProgress(retryBase + ((k + 1) / retry.length) * (100 - retryBase), f.name);
    try {
      const blob = await convertFile(f, opts);
      results[i] = {
        name: f.name,
        blob,
        width: 0,
        height: 0,
        error: null,
        inputSize: f.size,
      };
    } catch (err) {
      results[i] = {
        name: f.name,
        blob: null,
        width: 0,
        height: 0,
        error: err instanceof Error ? err.message : String(err),
        inputSize: f.size,
      };
    }
    await yieldToUI();
  }

  onProgress(100);
  return results;
}
