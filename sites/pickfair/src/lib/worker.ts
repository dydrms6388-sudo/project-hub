/** Web Worker 진행률 메시지 규약 */
export type WorkerMessage =
  | { type: "progress"; value: number; label?: string }
  | { type: "done"; value: unknown }
  | { type: "error"; value: string };

export type WorkerHandlers = {
  onProgress?: (value: number, label?: string) => void;
  onDone?: (value: unknown) => void;
  onError?: (message: string) => void;
};

/**
 * new Worker(new URL("./x.worker.ts", import.meta.url)) 로 만든 워커를
 * 진행률 규약에 맞춰 감싸준다.
 */
export function attachWorker(worker: Worker, handlers: WorkerHandlers) {
  const onMessage = (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "progress") handlers.onProgress?.(msg.value, msg.label);
    else if (msg.type === "done") handlers.onDone?.(msg.value);
    else if (msg.type === "error") handlers.onError?.(msg.value);
  };
  const onError = (e: ErrorEvent) => handlers.onError?.(e.message);
  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onError);
  return () => {
    worker.removeEventListener("message", onMessage);
    worker.removeEventListener("error", onError);
    worker.terminate();
  };
}
