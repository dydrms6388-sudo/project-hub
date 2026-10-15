"use client";

import type { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";

/**
 * ffmpeg 가상 파일시스템 헬퍼.
 *
 * 큰 영상은 WORKERFS 로 **마운트**한다. writeFile 은 파일 전체를 wasm 힙에 복사하므로
 * 500MB 영상이면 그 자체로 메모리가 터진다. WORKERFS 는 File 을 필요한 부분만 읽는다.
 * (지원되지 않는 환경에서는 writeFile 로 자동 폴백)
 */

const MOUNT = "/mnt";
const WORKERFS = "WORKERFS" as FFFSType;

export type MountedInput = { path: string; cleanup: () => Promise<void> };

let mounted = false;

/** 확장자만 남기고 ffmpeg 이 다루기 쉬운 ASCII 이름으로 바꾼다 */
export function safeName(name: string, fallbackExt = "bin"): string {
  const ext = (name.split(".").pop() ?? fallbackExt).toLowerCase().replace(/[^a-z0-9]/g, "") || fallbackExt;
  return `in_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export async function mountInputs(ff: FFmpeg, files: File[]): Promise<{ paths: string[]; cleanup: () => Promise<void> }> {
  const names = files.map((f) => safeName(f.name));
  try {
    if (!mounted) {
      try {
        await ff.createDir(MOUNT);
      } catch {
        /* 이미 있음 */
      }
    }
    await ff.mount(WORKERFS, { blobs: files.map((f, i) => ({ name: names[i], data: f })) }, MOUNT);
    mounted = true;
    return {
      paths: names.map((n) => `${MOUNT}/${n}`),
      cleanup: async () => {
        try {
          await ff.unmount(MOUNT);
        } catch {
          /* noop */
        }
        mounted = false;
      },
    };
  } catch {
    // WORKERFS 실패 → 메모리 복사 폴백
    for (let i = 0; i < files.length; i++) {
      await ff.writeFile(names[i], new Uint8Array(await files[i].arrayBuffer()));
    }
    return {
      paths: names,
      cleanup: async () => {
        for (const n of names) {
          try {
            await ff.deleteFile(n);
          } catch {
            /* noop */
          }
        }
      },
    };
  }
}

export async function readOutput(ff: FFmpeg, path: string, mime: string): Promise<Blob> {
  const data = await ff.readFile(path);
  if (typeof data === "string") return new Blob([data], { type: mime });
  const view = data as Uint8Array;
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  try {
    await ff.deleteFile(path);
  } catch {
    /* noop */
  }
  return new Blob([copy], { type: mime });
}

export async function writeText(ff: FFmpeg, path: string, text: string) {
  await ff.writeFile(path, new TextEncoder().encode(text));
}

export async function removeQuiet(ff: FFmpeg, path: string) {
  try {
    await ff.deleteFile(path);
  } catch {
    /* noop */
  }
}

/**
 * ffmpeg 필터 그래프에 넣는 문자열 이스케이프.
 * 필터 인자 안에서는 \ : ' 가 특수문자다(drawtext/subtitles 등).
 */
export function escapeFilterValue(v: string): string {
  return v.replace(/\\/g, "\\\\\\\\").replace(/:/g, "\\\\:").replace(/'/g, "\\\\'").replace(/,/g, "\\,");
}

/** subtitles=파일명 처럼 경로를 넣을 때 */
export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\\\:").replace(/'/g, "\\\\'");
}

export const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
  png: "image/png",
  jpg: "image/jpeg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

export function mimeOf(ext: string): string {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}
