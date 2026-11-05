/**
 * FaceDetector 어댑터 — 얼굴 **개수·신뢰도만** 반환. 임베딩·랜드마크 반환/저장 금지(B1 §3.1 생체정보 회피).
 *
 *  - none     : 항상 unknown(faces=-1). 사람 검수 대기(Phase 1 기본).
 *  - external : env FACE_API_URL 로 POST(이미지 바이트, content-type image/*) → { faces:number, confidence:number }.
 *               인증은 FACE_API_KEY(Bearer). 실패/타임아웃 시 unknown 으로 폴백(자동 반려 없음).
 */
export type FaceDetection = {
  /** -1 = 판정 불가(unknown) */
  faces: number;
  /** 0~1, unknown 이면 0 */
  confidence: number;
  detector: "none" | "external";
  error?: string;
};

export interface FaceDetector {
  readonly name: "none" | "external";
  detect(bytes: Uint8Array, contentType: string): Promise<FaceDetection>;
}

export const UNKNOWN: FaceDetection = { faces: -1, confidence: 0, detector: "none" };

export class NoneDetector implements FaceDetector {
  readonly name = "none" as const;
  async detect(): Promise<FaceDetection> {
    return UNKNOWN;
  }
}

export class ExternalDetector implements FaceDetector {
  readonly name = "external" as const;
  constructor(
    private readonly url: string,
    private readonly apiKey: string | undefined,
    private readonly timeoutMs = 8000,
  ) {}

  async detect(bytes: Uint8Array, contentType: string): Promise<FaceDetection> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": contentType, ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) },
        body: bytes,
        signal: ctrl.signal,
      });
      if (!res.ok) return { ...UNKNOWN, detector: "external", error: `http_${res.status}` };
      const data = (await res.json()) as { faces?: unknown; confidence?: unknown };
      const faces = typeof data.faces === "number" && Number.isFinite(data.faces) ? Math.max(-1, Math.trunc(data.faces)) : -1;
      const confidence = typeof data.confidence === "number" && Number.isFinite(data.confidence) ? Math.min(1, Math.max(0, data.confidence)) : 0;
      return { faces, confidence, detector: "external" };
    } catch (e) {
      return { ...UNKNOWN, detector: "external", error: e instanceof Error ? e.name : "error" };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getFaceDetector(): FaceDetector {
  const url = Deno.env.get("FACE_API_URL");
  if (url && url.startsWith("https://")) return new ExternalDetector(url, Deno.env.get("FACE_API_KEY"));
  return new NoneDetector();
}
