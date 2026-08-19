"use client";

/** 브라우저 자체 디코더로 얻을 수 있는 정보 — ffmpeg 코어를 받기 전에도 쓸 수 있다. */
export type MediaInfo = {
  duration: number; // 초
  width: number;
  height: number;
  hasVideo: boolean;
};

export function probeMedia(file: File): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    const cleanup = () => {
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(url);
    };
    el.onloadedmetadata = () => {
      const info: MediaInfo = {
        duration: Number.isFinite(el.duration) ? el.duration : 0,
        width: el.videoWidth,
        height: el.videoHeight,
        hasVideo: el.videoWidth > 0,
      };
      cleanup();
      resolve(info);
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("이 브라우저가 미리 읽을 수 없는 형식입니다. 변환은 그래도 시도할 수 있습니다."));
    };
    el.src = url;
  });
}

/** 지정 시각의 프레임을 캔버스로 뜬다(미리보기용). 브라우저 디코더 사용. */
export function captureFrame(file: File, timeSec: number, maxWidth = 640): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    const fail = (msg: string) => {
      URL.revokeObjectURL(url);
      reject(new Error(msg));
    };
    el.onloadeddata = () => {
      el.currentTime = Math.max(0, Math.min(timeSec, Math.max(0, (el.duration || 0) - 0.05)));
    };
    el.onseeked = () => {
      const scale = el.videoWidth > maxWidth ? maxWidth / el.videoWidth : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(el.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(el.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("캔버스를 만들 수 없습니다");
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    el.onerror = () => fail("미리보기를 만들 수 없는 형식입니다");
    el.src = url;
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

/** 초 → "HH:MM:SS.mmm" (ffmpeg -ss/-to 인자에 그대로 넣을 수 있는 형식) */
export function toFfTime(sec: number): string {
  const v = Math.max(0, sec);
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = v % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

/** 초 → "MM:SS" (화면 표시용) */
export function toClock(sec: number): string {
  const v = Math.max(0, Math.round(sec));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = v % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "01:23", "1:02:03", "83.5" 등을 초로 */
export function parseClock(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(":");
  if (parts.length > 3 || parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function baseName(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}
