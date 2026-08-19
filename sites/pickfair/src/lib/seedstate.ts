"use client";

/**
 * 픽페어 URL 상태 훅 — 10개 도구가 전부 공유한다.
 *
 * URL 규약:  /tools/<slug>/#s=<seed>&d=<lz-string 압축 입력>
 *   - 서버가 없으므로(정적 배포) 결과 상태는 전부 `location.hash` 에 담는다.
 *     해시는 서버로 전송되지 않으므로, 입력 내용이 어떤 서버에도 남지 않는 부수 효과도 있다.
 *   - 해시가 있는 채로 페이지가 열리면 **재현 모드**: 입력이 잠기고, 배지가 뜨고,
 *     "새로 뽑기" 로만 새 seed 를 만들 수 있다.
 *   - 결과는 언제나 (seed, data) 의 순수 함수여야 한다. 그래야 링크 = 결과가 성립한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { newSeed } from "./rng";

type LZ = typeof import("lz-string");
let lzPromise: Promise<LZ> | null = null;
/** lz-string 은 실제로 인코딩/디코딩이 필요한 순간에만 받아온다 */
function lz(): Promise<LZ> {
  lzPromise ??= import("lz-string");
  return lzPromise;
}

export type SeedState<D> = {
  /** 해시 해석이 끝났는지 (false 면 로딩 표시) */
  ready: boolean;
  /** 현재 결과의 seed */
  seed: string;
  /** 현재 결과의 입력. null 이면 아직 결과 없음(입력 화면) */
  data: D | null;
  /** URL 로 들어온 재현 모드인지 */
  replay: boolean;
  /** 공유용 절대 URL */
  shareUrl: string;
  /** 해시를 읽었지만 해석에 실패했는지 */
  broken: boolean;
  /** 새 결과 생성 (seed 를 주면 그 seed 로 고정) */
  run: (data: D, seed?: string) => void;
  /** 같은 입력, 새 seed 로 다시 뽑기 */
  rerun: () => void;
  /** 결과를 지우고 입력 화면으로 */
  reset: () => void;
};

function readHash(): { seed: string; d: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const seed = params.get("s");
  const d = params.get("d");
  if (!seed) return null;
  return { seed, d: d ?? "" };
}

function absUrl(hash: string): string {
  if (typeof window === "undefined") return "";
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${hash}`;
}

export function useSeedState<D>(validate: (raw: unknown) => D | null): SeedState<D> {
  const [state, setState] = useState<{
    ready: boolean;
    seed: string;
    data: D | null;
    replay: boolean;
    hash: string;
    broken: boolean;
  }>({ ready: false, seed: "", data: null, replay: false, hash: "", broken: false });

  const validateRef = useRef(validate);
  validateRef.current = validate;

  const syncFromHash = useCallback(async () => {
    const h = readHash();
    if (!h) {
      setState({ ready: true, seed: newSeed(), data: null, replay: false, hash: "", broken: false });
      return;
    }
    let parsed: D | null = null;
    let broken = false;
    if (h.d) {
      try {
        const { decompressFromEncodedURIComponent } = await lz();
        const json = decompressFromEncodedURIComponent(h.d);
        parsed = json ? validateRef.current(JSON.parse(json)) : null;
      } catch {
        parsed = null;
      }
      if (!parsed) broken = true;
    }
    setState({
      ready: true,
      seed: h.seed,
      data: parsed,
      replay: parsed != null,
      hash: window.location.hash,
      broken,
    });
  }, []);

  useEffect(() => {
    void syncFromHash();
    const onNav = () => void syncFromHash();
    window.addEventListener("hashchange", onNav);
    window.addEventListener("popstate", onNav);
    return () => {
      window.removeEventListener("hashchange", onNav);
      window.removeEventListener("popstate", onNav);
    };
  }, [syncFromHash]);

  const lastData = useRef<D | null>(null);
  lastData.current = state.data ?? lastData.current;

  const run = useCallback((data: D, seed?: string) => {
    const s = seed ?? newSeed();
    lastData.current = data;
    // 낙관적으로 먼저 반영 → 압축이 끝나면 주소만 갱신 (결과 표시가 지연되지 않도록)
    setState((prev) => ({ ...prev, ready: true, seed: s, data, replay: false, broken: false }));
    void (async () => {
      const { compressToEncodedURIComponent } = await lz();
      const d = compressToEncodedURIComponent(JSON.stringify(data));
      const hash = `#s=${encodeURIComponent(s)}&d=${d}`;
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
      setState((prev) => (prev.seed === s ? { ...prev, hash } : prev));
    })();
  }, []);

  const rerun = useCallback(() => {
    const d = lastData.current;
    if (!d) return;
    run(d);
  }, [run]);

  const reset = useCallback(() => {
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    setState({ ready: true, seed: newSeed(), data: null, replay: false, hash: "", broken: false });
  }, []);

  return {
    ready: state.ready,
    seed: state.seed,
    data: state.data,
    replay: state.replay,
    broken: state.broken,
    shareUrl: absUrl(state.hash),
    run,
    rerun,
    reset,
  };
}
