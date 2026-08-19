/// <reference lib="webworker" />
/**
 * 이미지 디코딩 → 리사이즈 → 인코딩을 백그라운드 스레드에서 수행한다.
 * OffscreenCanvas 가 없거나 특정 파일에서 실패하면 해당 항목만 error 로 돌려주고,
 * 메인 스레드가 heic2any/<img> 폴백으로 다시 시도한다.
 *
 * 메시지 규약은 src/lib/worker.ts 와 동일하다.
 * { type: "progress" | "done" | "error", value }
 */
import { computeDraw } from "../../lib/image-core";
import type { EncodeOpts } from "../../lib/image-core";

type Req = { files: File[]; opts: EncodeOpts };
type Item = {
  name: string;
  blob: Blob | null;
  width: number;
  height: number;
  error: string | null;
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const post = (msg: unknown) => ctx.postMessage(msg);

async function bitmapFrom(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(blob);
  }
}

async function one(file: File, opts: EncodeOpts): Promise<Item> {
  const bmp = await bitmapFrom(file);
  try {
    const rect = computeDraw(bmp.width, bmp.height, opts.resize);
    const canvas = new OffscreenCanvas(rect.dw, rect.dh);
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2D 컨텍스트를 만들지 못했습니다.");
    const bg =
      opts.background === "transparent"
        ? opts.format === "image/jpeg"
          ? "#ffffff"
          : null
        : opts.background;
    if (bg) {
      c.fillStyle = bg;
      c.fillRect(0, 0, rect.dw, rect.dh);
    }
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(bmp, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.dw, rect.dh);
    const blob = await canvas.convertToBlob({ type: opts.format, quality: opts.quality });
    if (opts.format !== "image/png" && blob.type !== opts.format) {
      throw new Error(`이 브라우저는 ${opts.format} 인코딩을 지원하지 않습니다.`);
    }
    return { name: file.name, blob, width: rect.dw, height: rect.dh, error: null };
  } finally {
    bmp.close();
  }
}

ctx.addEventListener("message", async (e: MessageEvent<Req>) => {
  const { files, opts } = e.data ?? { files: [], opts: null as unknown as EncodeOpts };
  try {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("이 브라우저는 OffscreenCanvas 를 지원하지 않습니다.");
    }
    const out: Item[] = [];
    for (let i = 0; i < files.length; i++) {
      post({ type: "progress", value: (i / files.length) * 100, label: files[i].name });
      try {
        out.push(await one(files[i], opts));
      } catch (err) {
        out.push({
          name: files[i].name,
          blob: null,
          width: 0,
          height: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    post({ type: "progress", value: 100 });
    post({ type: "done", value: out });
  } catch (err) {
    post({ type: "error", value: err instanceof Error ? err.message : String(err) });
  }
});

export {};
