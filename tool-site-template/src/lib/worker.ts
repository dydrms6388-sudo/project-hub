import * as Comlink from "comlink";

/** 워커 ↔ 메인 진행률 메시지 규약 */
export type ProgressMsg =
  | { type: "progress"; value: number; label?: string }
  | { type: "done"; value?: unknown }
  | { type: "error"; message: string };

/**
 * 사용 예:
 *   const api = wrapWorker<MyApi>(new Worker(new URL("./my.worker.ts", import.meta.url), { type: "module" }));
 *   await api.run(file, Comlink.proxy((p: ProgressMsg) => setProgress(p)));
 */
export function wrapWorker<T>(worker: Worker) {
  return Comlink.wrap<T>(worker);
}
export { Comlink };
