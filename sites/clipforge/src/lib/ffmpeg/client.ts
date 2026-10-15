"use client";

/**
 * ffmpeg.wasm 로더.
 *
 * - 코어(js + wasm ≈32MB)는 **도구에서 실행 버튼을 누른 시점**에 받는다.
 *   페이지 진입만으로는 받지 않는다(초기 번들·트래픽 보호).
 * - 받은 바이트는 IndexedDB 에 저장하고 다음부터는 네트워크를 타지 않는다.
 * - crossOriginIsolated(=COOP/COEP 적용) 이면 멀티스레드 코어(core-mt),
 *   아니면 싱글스레드 코어(core)로 자동 폴백한다.
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { detectWasmThreads, isMobile } from "@/lib/capability";
import { idbGet, idbPut } from "./idb";

export const CORE_VERSION = "0.12.10";

/** 코어 배포처. 자체 호스팅으로 바꾸려면 이 환경변수만 바꾸면 된다. */
const CDN = process.env.NEXT_PUBLIC_FFMPEG_CDN ?? "https://unpkg.com";

export type CoreVariant = "mt" | "st";

/** UI 표시용 대략 용량(byte) — 진행률 가중치에 쓴다 */
const APPROX: Record<string, number> = {
  "ffmpeg-core.js": 130_000,
  "ffmpeg-core.wasm": 32_800_000,
  "ffmpeg-core.worker.js": 3_000,
};

function baseUrl(variant: CoreVariant): string {
  const pkg = variant === "mt" ? "core-mt" : "core";
  return `${CDN}/@ffmpeg/${pkg}@${CORE_VERSION}/dist/esm`;
}

export type LoadProgress = (info: { percent: number; label: string }) => void;

async function fetchWithCache(
  url: string,
  onChunk: (delta: number) => void,
): Promise<ArrayBuffer> {
  const cached = await idbGet(url);
  if (cached) {
    onChunk(cached.byteLength);
    return cached;
  }
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`코어 다운로드 실패 (${res.status}) — ${url}`);

  // 스트리밍으로 받아 진행률을 갱신한다.
  if (res.body) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        onChunk(value.byteLength);
      }
    }
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    const buf = merged.buffer as ArrayBuffer;
    await idbPut(url, buf);
    return buf;
  }

  const buf = await res.arrayBuffer();
  onChunk(buf.byteLength);
  await idbPut(url, buf);
  return buf;
}

let instance: FFmpeg | null = null;
let loadedVariant: CoreVariant | null = null;
let loading: Promise<FFmpeg> | null = null;

/** 로그 구독 — silencedetect 파싱 등에 쓴다 */
type LogHandler = (line: string) => void;
const logHandlers = new Set<LogHandler>();

export function onFFmpegLog(handler: LogHandler): () => void {
  logHandlers.add(handler);
  return () => logHandlers.delete(handler);
}

type ProgressHandler = (ratio: number) => void;
const progressHandlers = new Set<ProgressHandler>();

export function onFFmpegProgress(handler: ProgressHandler): () => void {
  progressHandlers.add(handler);
  return () => progressHandlers.delete(handler);
}

/** 이 브라우저에서 멀티스레드 코어를 쓸 수 있는가 */
export function canUseThreads(): boolean {
  // 모바일은 메모리 한계로 멀티스레드 코어가 자주 실패한다 → 싱글스레드로 간다.
  return detectWasmThreads() && !isMobile();
}

export function currentVariant(): CoreVariant | null {
  return loadedVariant;
}

/**
 * ffmpeg 인스턴스를 준비한다. 이미 로드돼 있으면 즉시 반환.
 * @param onProgress 코어 다운로드 진행률(0~100)
 */
export async function getFFmpeg(onProgress?: LoadProgress): Promise<FFmpeg> {
  if (instance && instance.loaded) return instance;
  if (loading) return loading;

  loading = (async () => {
    const variant: CoreVariant = canUseThreads() ? "mt" : "st";
    const base = baseUrl(variant);
    const names = variant === "mt"
      ? ["ffmpeg-core.js", "ffmpeg-core.wasm", "ffmpeg-core.worker.js"]
      : ["ffmpeg-core.js", "ffmpeg-core.wasm"];
    const totalBytes = names.reduce((s, n) => s + APPROX[n], 0);

    onProgress?.({ percent: 0, label: "엔진 내려받는 중" });

    let received = 0;
    const bump = (delta: number) => {
      received += delta;
      const percent = Math.min(99, (received / totalBytes) * 100);
      onProgress?.({ percent, label: "엔진 내려받는 중" });
    };

    const buffers = await Promise.all(names.map((n) => fetchWithCache(`${base}/${n}`, bump)));

    onProgress?.({ percent: 99, label: "엔진 준비 중" });

    const blobUrl = (buf: ArrayBuffer, type: string) => URL.createObjectURL(new Blob([buf], { type }));
    const coreURL = blobUrl(buffers[0], "text/javascript");
    const wasmURL = blobUrl(buffers[1], "application/wasm");
    const workerURL = buffers[2] ? blobUrl(buffers[2], "text/javascript") : undefined;

    const { FFmpeg: FFmpegClass } = await import("@ffmpeg/ffmpeg");
    const ff = new FFmpegClass();
    ff.on("log", ({ message }) => {
      for (const h of logHandlers) h(message);
    });
    ff.on("progress", ({ progress }) => {
      for (const h of progressHandlers) h(progress);
    });

    await ff.load(workerURL ? { coreURL, wasmURL, workerURL } : { coreURL, wasmURL });

    instance = ff;
    loadedVariant = variant;
    onProgress?.({ percent: 100, label: "준비 완료" });
    return ff;
  })();

  try {
    return await loading;
  } catch (e) {
    instance = null;
    loadedVariant = null;
    throw e;
  } finally {
    loading = null;
  }
}

/** 실행 중인 작업을 강제로 끊는다(다음 실행 때 코어를 다시 로드). */
export function terminateFFmpeg() {
  try {
    instance?.terminate();
  } catch {
    /* noop */
  }
  instance = null;
  loadedVariant = null;
  loading = null;
}
