/**
 * ffmpeg 코어(≈32MB) 를 IndexedDB 에 캐시한다.
 * 브라우저 HTTP 캐시는 용량 압박 시 먼저 버려지기 때문에 별도로 보관한다.
 */

const DB_NAME = "clipforge-cache";
const DB_VERSION = 1;
const STORE = "assets";

type Entry = { url: string; buffer: ArrayBuffer; savedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 를 쓸 수 없는 환경입니다"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "url" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 열기 실패"));
  });
}

export async function idbGet(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return await new Promise<ArrayBuffer | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => resolve(((req.result as Entry | undefined)?.buffer as ArrayBuffer) ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function idbPut(url: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ url, buffer, savedAt: Date.now() } satisfies Entry);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* 시크릿 모드·용량 초과 등 — 캐시 실패는 무시하고 그냥 매번 받는다 */
  }
}

/** 캐시된 코어 용량(byte) */
export async function idbUsage(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve(((req.result as Entry[]) ?? []).reduce((sum, e) => sum + (e.buffer?.byteLength ?? 0), 0));
      req.onerror = () => resolve(0);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return 0;
  }
}

export async function idbClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch {
    /* noop */
  }
}
