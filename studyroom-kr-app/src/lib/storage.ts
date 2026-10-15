"use client";

import { useEffect, useState } from "react";

/**
 * localStorage 에 붙은 useState.
 * 서버 렌더 결과와 어긋나지 않도록 첫 렌더는 항상 `initial` 로 하고,
 * 마운트 후 effect 에서 저장값을 읽어 덮어쓴다. `loaded` 가 true 가 되기 전에는
 * 저장하지 않으므로 초기값이 실제 저장값을 지우는 일이 없다.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 손상된 값·시크릿 모드 — 초기값으로 계속 */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 용량 초과·저장 차단 — 화면 동작은 유지 */
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}

/** 짧은 고유 id. crypto 를 못 쓰는 환경에서도 충돌하지 않을 정도면 충분하다. */
export function newId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}
