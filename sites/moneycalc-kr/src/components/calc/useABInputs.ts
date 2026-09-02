"use client";

import { useState } from "react";
import { useAB, type ABState } from "./CalcFrame";

/**
 * 모든 계산기가 공유하는 A안/B안 입력 상태.
 * 비교 모드가 꺼져 있으면 A안만 쓰고, 켜면 탭에 따라 A/B 를 각각 편집한다.
 */
export function useABInputs<T extends object>(init: T, initB?: Partial<T>) {
  const ab: ABState = useAB();
  const [a, setA] = useState<T>(init);
  const [b, setB] = useState<T>({ ...init, ...initB });

  const cur = ab.tab === "a" ? a : b;
  const setCur = ab.tab === "a" ? setA : setB;

  const set =
    <K extends keyof T>(key: K) =>
    (value: T[K]) =>
      setCur((prev) => ({ ...prev, [key]: value }));

  return { ab, a, b, cur, set };
}
