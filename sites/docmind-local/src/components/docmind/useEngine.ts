"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectWebGPU, isMobile } from "@/lib/capability";
import {
  currentModelId,
  deleteModelFromCache,
  getEngine,
  isModelCached,
  type LoadProgress,
} from "@/lib/docmind/engine";
import { DEFAULT_MODEL_ID, MODELS } from "@/lib/docmind/models";

const STORAGE_KEY = "docmind:model";

export type EngineStatus = "idle" | "loading" | "ready" | "error";

export type UseEngine = {
  gpu: "checking" | "ok" | "none";
  mobile: boolean;
  status: EngineStatus;
  modelId: string;
  setModelId: (id: string) => void;
  progress: LoadProgress | null;
  error: string | null;
  cached: boolean | null;
  /** 모델을 내려받고 로드한다. 성공하면 true */
  load: () => Promise<boolean>;
  clearCache: () => Promise<void>;
};

export function useEngine(): UseEngine {
  const [gpu, setGpu] = useState<"checking" | "ok" | "none">("checking");
  const [mobile, setMobile] = useState(false);
  const [status, setStatus] = useState<EngineStatus>("idle");
  const [modelId, setModelIdState] = useState<string>(DEFAULT_MODEL_ID);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setGpu(detectWebGPU() ? "ok" : "none");
    setMobile(isMobile());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && MODELS.some((m) => m.id === saved)) setModelIdState(saved);
    } catch {
      /* 프라이빗 모드 등 — 기본값 사용 */
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  // 이미 로드돼 있는 엔진이 있으면(같은 탭에서 다른 도구를 쓰다 온 경우) 상태 반영
  useEffect(() => {
    if (currentModelId() === modelId) setStatus("ready");
  }, [modelId]);

  useEffect(() => {
    let alive = true;
    if (gpu !== "ok") return;
    setCached(null);
    isModelCached(modelId).then((c) => {
      if (alive) setCached(c);
    });
    return () => {
      alive = false;
    };
  }, [modelId, gpu]);

  const setModelId = useCallback((id: string) => {
    setModelIdState(id);
    setStatus(currentModelId() === id ? "ready" : "idle");
    setProgress(null);
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* 무시 */
    }
  }, []);

  const load = useCallback(async () => {
    if (gpu !== "ok") {
      setError("이 브라우저에서는 WebGPU 를 쓸 수 없습니다.");
      setStatus("error");
      return false;
    }
    setStatus("loading");
    setError(null);
    try {
      await getEngine(modelId, (p) => {
        if (mounted.current) setProgress(p);
      });
      if (mounted.current) {
        setStatus("ready");
        setCached(true);
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (mounted.current) {
        setError(msg);
        setStatus("error");
      }
      return false;
    }
  }, [gpu, modelId]);

  const clearCache = useCallback(async () => {
    await deleteModelFromCache(modelId);
    setCached(false);
    setStatus("idle");
    setProgress(null);
  }, [modelId]);

  return {
    gpu,
    mobile,
    status,
    modelId,
    setModelId,
    progress,
    error,
    cached,
    load,
    clearCache,
  };
}
