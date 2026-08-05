/// <reference lib="webworker" />
import { rasterRegistry } from "../lib/core/raster";

interface Req {
  id: number;
  slug: string;
  params: Record<string, number>;
  width: number;
  height: number;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, slug, params, width, height } = e.data;
  const fn = rasterRegistry[slug];
  if (!fn) {
    (self as unknown as Worker).postMessage({ id, error: `unknown slug: ${slug}` });
    return;
  }
  try {
    const pixels = fn(params, width, height);
    (self as unknown as Worker).postMessage({ id, width, height, pixels }, [
      pixels.buffer,
    ]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
