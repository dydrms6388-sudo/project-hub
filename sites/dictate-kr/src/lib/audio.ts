"use client";

/**
 * 브라우저 오디오 입력 처리.
 * 파일(mp3/m4a/wav/mp4/mov…) → AudioContext.decodeAudioData → 모노 믹스 → 16kHz 리샘플.
 * 여기까지 전부 브라우저 메모리 안에서 일어나며 어떤 바이트도 네트워크로 나가지 않는다.
 */

import { TARGET_SAMPLE_RATE, mixToMono, resampleTo } from "./dsp";

export type DecodedAudio = {
  /** 16kHz mono Float32 PCM */
  pcm: Float32Array;
  sampleRate: number;
  /** 초 */
  duration: number;
  /** 원본 샘플레이트 */
  sourceRate: number;
  sourceChannels: number;
};

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

export function audioSupported(): boolean {
  return getAudioContextCtor() !== null;
}

/** Safari 구버전은 decodeAudioData 가 Promise 를 돌려주지 않아 콜백형으로 감싼다. */
function decode(ctx: BaseAudioContext, buf: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (b: AudioBuffer) => {
      if (!settled) {
        settled = true;
        resolve(b);
      }
    };
    const ng = (e: DOMException | Error | null) => {
      if (!settled) {
        settled = true;
        reject(e ?? new Error("decode failed"));
      }
    };
    try {
      const maybe = ctx.decodeAudioData(buf, ok, ng);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === "function") {
        (maybe as Promise<AudioBuffer>).then(ok, ng);
      }
    } catch (e) {
      ng(e as Error);
    }
  });
}

export class AudioDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioDecodeError";
  }
}

/**
 * Blob/File 을 Whisper 입력 규격(16kHz mono)으로 변환한다.
 *
 * mp4·mov 는 컨테이너 안의 오디오 트랙만 디코딩된다(영상 프레임은 무시).
 * 브라우저가 그 코덱을 못 열면 AudioDecodeError 로 명확히 알린다 — 조용히 넘어가지 않는다.
 */
export async function decodeToMono16k(
  source: Blob | ArrayBuffer,
  onStage?: (label: string) => void,
): Promise<DecodedAudio> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    throw new AudioDecodeError(
      "이 브라우저는 Web Audio API 를 지원하지 않아 오디오를 읽을 수 없습니다. 최신 크롬·엣지·사파리에서 열어 주세요.",
    );
  }

  onStage?.("파일 읽는 중");
  const raw = source instanceof Blob ? await source.arrayBuffer() : source;
  if (raw.byteLength === 0) throw new AudioDecodeError("빈 파일입니다.");

  const ctx = new Ctor();
  let buffer: AudioBuffer;
  try {
    onStage?.("오디오 디코딩 중");
    // decodeAudioData 는 넘긴 ArrayBuffer 를 detach 하므로 복사본을 준다.
    buffer = await decode(ctx, raw.slice(0));
  } catch {
    throw new AudioDecodeError(
      "오디오를 디코딩하지 못했습니다. 브라우저가 이 코덱을 지원하지 않을 수 있습니다. " +
        "mp3·wav·m4a(AAC) 로 변환한 뒤 다시 시도해 주세요. 영상이라면 오디오 트랙이 없는 파일일 수도 있습니다.",
    );
  } finally {
    void ctx.close().catch(() => undefined);
  }

  if (buffer.length === 0 || buffer.duration === 0) {
    throw new AudioDecodeError("오디오 트랙이 비어 있습니다. 소리가 녹음된 파일인지 확인해 주세요.");
  }

  onStage?.("모노 변환 중");
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const mono = mixToMono(channels);

  onStage?.(`16kHz 리샘플 중 (${Math.round(buffer.sampleRate / 1000)}kHz → 16kHz)`);
  const pcm = resampleTo(mono, buffer.sampleRate, TARGET_SAMPLE_RATE);

  return {
    pcm,
    sampleRate: TARGET_SAMPLE_RATE,
    duration: pcm.length / TARGET_SAMPLE_RATE,
    sourceRate: buffer.sampleRate,
    sourceChannels: buffer.numberOfChannels,
  };
}

/** 마이크 권한 오류를 사람이 읽을 수 있는 문장으로 바꾼다. */
export function describeMicError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "마이크 사용이 거부되었습니다. 주소창 왼쪽 자물쇠(또는 카메라·마이크) 아이콘을 눌러 이 사이트의 마이크 권한을 '허용'으로 바꾼 뒤 페이지를 새로고침해 주세요.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "사용할 수 있는 마이크를 찾지 못했습니다. 마이크가 연결되어 있는지, 시스템 설정에서 입력 장치로 선택돼 있는지 확인해 주세요.";
    case "NotReadableError":
      return "마이크를 다른 프로그램이 쓰고 있어 열 수 없습니다. 화상회의 앱이나 다른 녹음 프로그램을 종료한 뒤 다시 시도해 주세요.";
    case "AbortError":
      return "마이크 연결이 중단되었습니다. 다시 시도해 주세요.";
    default:
      if (typeof window !== "undefined" && !window.isSecureContext) {
        return "보안 연결(HTTPS)에서만 마이크를 쓸 수 있습니다. https:// 주소로 접속해 주세요.";
      }
      return `마이크를 열지 못했습니다. (${name || "알 수 없는 오류"})`;
  }
}

export function micSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/** MediaRecorder 가 실제로 지원하는 오디오 컨테이너를 고른다. */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

/** Float32 PCM → 16bit WAV Blob (녹음 원본 저장용) */
export function pcmToWav(pcm: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(bytes);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true); // PCM 청크 길이
  view.setUint16(20, 1, true); // 형식 1 = 선형 PCM
  view.setUint16(22, 1, true); // 채널 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // 바이트/초
  view.setUint16(32, 2, true); // 블록 정렬
  view.setUint16(34, 16, true); // 비트 심도
  w(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  let off = 44;
  for (let i = 0; i < pcm.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}
