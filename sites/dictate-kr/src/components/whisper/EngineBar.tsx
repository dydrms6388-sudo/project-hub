"use client";

import { useEffect, useState } from "react";
import Progress from "@/components/Progress";
import { MODELS, type Language, type ModelKey, clearModelCache, formatBytes, modelByKey } from "@/lib/models";
import type { WhisperApi } from "@/lib/useWhisper";

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export type EngineBarProps = {
  api: WhisperApi;
  modelKey: ModelKey;
  onModelKey: (k: ModelKey) => void;
  language: Language;
  onLanguage: (l: Language) => void;
  /** 모델 선택을 숨긴다(모델 비교 도구처럼 직접 관리하는 경우) */
  hideModel?: boolean;
  disabled?: boolean;
};

/**
 * 모든 받아쓰기 도구가 공유하는 엔진 제어 줄.
 * 모델·언어 선택, 실행 백엔드 표시, 모델 다운로드 안내/진행률, 오류 UI를 한곳에 모았다.
 */
export default function EngineBar({
  api,
  modelKey,
  onModelKey,
  language,
  onLanguage,
  hideModel,
  disabled,
}: EngineBarProps) {
  const { state, caps } = api;
  const [ios, setIos] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);

  useEffect(() => setIos(isIosSafari()), []);

  const busy = state.phase === "loading" || state.phase === "running";

  async function onClearCache() {
    const names = await clearModelCache();
    setCacheMsg(
      names.length > 0
        ? "저장된 모델을 지웠습니다. 다음 실행 때 다시 내려받습니다."
        : "지울 모델 캐시가 없습니다.",
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        {!hideModel && (
          <div className="min-w-0 flex-1 basis-48">
            <label htmlFor="engine-model" className="mb-1 block text-xs font-medium text-slate-600">
              인식 모델
            </label>
            <select
              id="engine-model"
              value={modelKey}
              onChange={(e) => onModelKey(e.target.value as ModelKey)}
              disabled={disabled || busy}
              aria-label="인식 모델 선택"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {MODELS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-w-0 flex-1 basis-40">
          <span className="mb-1 block text-xs font-medium text-slate-600">언어</span>
          <div className="inline-flex w-full overflow-hidden rounded-lg border border-slate-300">
            {(
              [
                ["ko", "한국어 고정"],
                ["auto", "자동 감지"],
              ] as [Language, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={language === v}
                aria-label={`언어 ${label}`}
                disabled={disabled || busy}
                onClick={() => onLanguage(v)}
                className={`flex-1 px-3 py-2 text-sm transition disabled:opacity-50 ${
                  language === v ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${
            caps.webgpu ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {caps.webgpu ? "WebGPU 가속 사용" : "WebAssembly(CPU) 사용"}
        </span>
        {state.bytes ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            내려받은 모델 {formatBytes(state.bytes)}
          </span>
        ) : null}
        {ios ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
            아이폰·아이패드 사파리 — tiny 모델과 5분 이하 녹음을 권장합니다
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClearCache}
          aria-label="저장된 모델 지우기"
          className="ml-auto rounded-lg border border-slate-300 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50"
        >
          저장된 모델 지우기
        </button>
      </div>
      {cacheMsg ? <p className="text-xs text-slate-500">{cacheMsg}</p> : null}

      <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
        처음 실행할 때 <b>{modelByKey(modelKey).label.split(" ")[0]}</b> 모델 파일을 한 번 내려받습니다(모델에 따라
        수십~수백 MB, 정확한 용량은 아래 진행률에 실제 바이트로 표시됩니다). 한 번 받아 두면 브라우저 저장소에 남아
        <b> 다음부터는 오프라인에서도</b> 동작합니다. 녹음 파일과 인식 결과는 서버로 전송되지 않습니다.
      </p>

      {state.notice ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900" role="status">
          <span className="flex-1">{state.notice}</span>
          <button
            type="button"
            onClick={api.dismissNotice}
            aria-label="알림 닫기"
            className="shrink-0 rounded px-1.5 text-amber-700 hover:bg-amber-100"
          >
            닫기
          </button>
        </div>
      ) : null}

      {busy ? (
        <div className="space-y-1">
          <Progress value={state.progress} label={state.label || state.stage || "처리 중"} />
          {state.stage ? <p className="text-xs text-slate-500">{state.stage}</p> : null}
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">처리에 실패했습니다</p>
          <p className="mt-1 leading-relaxed">{state.error}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
            <li>더 작은 모델(tiny/base)로 바꿔 보세요.</li>
            <li>다른 탭·프로그램을 닫아 메모리를 확보한 뒤 다시 시도해 보세요.</li>
            <li>사파리·파이어폭스에서 실패한다면 크롬 또는 엣지에서 열어 보세요.</li>
            <li>모델 다운로드가 끊겼다면 &ldquo;저장된 모델 지우기&rdquo; 후 다시 시도해 보세요.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
