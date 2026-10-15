"use client";

/**
 * IndexedDB 벡터 저장소.
 * 같은 문서를 다시 열면 임베딩을 다시 계산하지 않는다. 파일 원본은 저장하지 않고
 * 청크 텍스트와 벡터만 사용자의 브라우저에 남는다(서버 전송 없음).
 */

import type { Chunk } from "./chunk";

const DB_NAME = "docmind-local";
const DB_VERSION = 1;
const STORE_VEC = "vectors";
const STORE_DOC = "docs";

export type StoredChunk = {
  /** `${docId}#${chunkId}` */
  key: string;
  docId: string;
  chunkId: number;
  text: string;
  startPage: number;
  endPage: number;
  vector: number[];
};

export type StoredDoc = {
  docId: string;
  name: string;
  chunks: number;
  chars: number;
  embedModel: string;
  updatedAt: number;
};

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB 요청 실패"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openVectorDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("이 브라우저는 IndexedDB 를 지원하지 않습니다."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE_VEC)) {
        const s = db.createObjectStore(STORE_VEC, { keyPath: "key" });
        s.createIndex("docId", "docId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_DOC)) {
        db.createObjectStore(STORE_DOC, { keyPath: "docId" });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB 열기 실패"));
  });
  return dbPromise;
}

export async function saveDocVectors(
  doc: Omit<StoredDoc, "updatedAt">,
  chunks: Chunk[],
  vectors: number[][],
): Promise<void> {
  const db = await openVectorDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_VEC, STORE_DOC], "readwrite");
    const vs = tx.objectStore(STORE_VEC);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const row: StoredChunk = {
        key: `${doc.docId}#${c.id}`,
        docId: doc.docId,
        chunkId: c.id,
        text: c.text,
        startPage: c.startPage,
        endPage: c.endPage,
        vector: vectors[i] ?? [],
      };
      vs.put(row);
    }
    tx.objectStore(STORE_DOC).put({ ...doc, updatedAt: Date.now() } satisfies StoredDoc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("벡터 저장 실패"));
    tx.onabort = () => reject(tx.error ?? new Error("벡터 저장 중단"));
  });
}

export async function getDocMeta(docId: string): Promise<StoredDoc | undefined> {
  const db = await openVectorDB();
  const tx = db.transaction(STORE_DOC, "readonly");
  return req(tx.objectStore(STORE_DOC).get(docId) as IDBRequest<StoredDoc | undefined>);
}

export async function loadDocVectors(docId: string): Promise<StoredChunk[]> {
  const db = await openVectorDB();
  const tx = db.transaction(STORE_VEC, "readonly");
  const idx = tx.objectStore(STORE_VEC).index("docId");
  const rows = await req(idx.getAll(IDBKeyRange.only(docId)) as IDBRequest<StoredChunk[]>);
  return rows.sort((a, b) => a.chunkId - b.chunkId);
}

export async function listDocs(): Promise<StoredDoc[]> {
  const db = await openVectorDB();
  const tx = db.transaction(STORE_DOC, "readonly");
  const rows = await req(tx.objectStore(STORE_DOC).getAll() as IDBRequest<StoredDoc[]>);
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDoc(docId: string): Promise<void> {
  const db = await openVectorDB();
  const rows = await loadDocVectors(docId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_VEC, STORE_DOC], "readwrite");
    const vs = tx.objectStore(STORE_VEC);
    for (const r of rows) vs.delete(r.key);
    tx.objectStore(STORE_DOC).delete(docId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("삭제 실패"));
  });
}

export async function clearAllDocs(): Promise<void> {
  const db = await openVectorDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_VEC, STORE_DOC], "readwrite");
    tx.objectStore(STORE_VEC).clear();
    tx.objectStore(STORE_DOC).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("초기화 실패"));
  });
}
