"use client";

import Link from "next/link";
import Progress from "@/components/Progress";
import { approxDownloadLabel, MODELS, modelById } from "@/lib/docmind/models";
import type { UseEngine } from "./useEngine";

function fmtEta(sec: number | null): string {
  if (sec === null) return "계산 중";
  if (sec < 60) return `약 ${sec}초 남음`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `약 ${m}분 ${s}초 남음`;
}

export function WebGpuBlocked() {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4" role="alert">
      <p className="font-semibold text-red-800">이 브라우저에서는 사용할 수 없습니다</p>
      <p className="mt-1 text-sm leading-relaxed text-red-700">
        이 도구는 브라우저 안에서 직접 LLM 을 돌리기 때문에 <b>WebGPU</b> 가 반드시 필요합니다.
        WebGPU 가 없으면 CPU(WASM)로도 돌릴 수는 있지만 한 문단 요약에 수십 분이 걸려 제공하지
        않습니다.
      </p>
      <Link
        href="/browser-support/"
        className="mt-3 inline-block rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        aria-label="지원 브라우저 안내 보기"
      >
        지원 브라우저 안내 보기 →
      </Link>
    </div>
  );
}

export default function EnginePanel({ engine }: { engine: UseEngine }) {
  const info = modelById(engine.modelId);

  if (engine.gpu === "checking") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        브라우저 성능을 확인하는 중…
      </div>
    );
  }
  if (engine.gpu === "none") return <WebGpuBlocked />;

  return (
    <section className="rounded-xl border border-slate-200 p-4" aria-label="AI 모델 준비">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">1단계 · AI 모델 준비</h2>
        {engine.status === "ready" ? (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            준비 완료
          </span>
        ) : engine.cached ? (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            내려받기 완료 · 불러오기만 하면 됨
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            최초 1회 다운로드 필요
          </span>
        )}
      </div>

      {engine.mobile ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
          모바일에서는 메모리 부족으로 실패할 가능성이 높습니다. <b>PC 크롬/엣지</b>를 권장합니다.
        </p>
      ) : null}

      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-600" htmlFor="model-select">
          모델 선택
        </label>
        <select
          id="model-select"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
          value={engine.modelId}
          onChange={(e) => engine.setModelId(e.target.value)}
          disabled={engine.status === "loading"}
          aria-label="사용할 AI 모델 선택"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {approxDownloadLabel(m)}
            </option>
          ))}
        </select>
        {info ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            파라미터 {info.params} · 필요 VRAM 약 {Math.round(info.vramMB)}MB · 컨텍스트{" "}
            {info.contextWindow.toLocaleString()}토큰
            {info.requiredFeatures?.length ? ` · ${info.requiredFeatures.join(", ")} 필요` : ""}
            <br />
            {info.note}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void engine.load()}
          disabled={engine.status === "loading" || engine.status === "ready"}
          aria-label="AI 모델 내려받고 준비하기"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {engine.status === "ready"
            ? "준비 완료"
            : engine.status === "loading"
              ? "준비 중…"
              : engine.cached
                ? "모델 불러오기"
                : "모델 내려받기"}
        </button>
        {engine.cached ? (
          <button
            type="button"
            onClick={() => void engine.clearCache()}
            disabled={engine.status === "loading"}
            aria-label="내려받은 모델 캐시 삭제"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            캐시 삭제
          </button>
        ) : null}
      </div>

      {engine.status === "loading" && engine.progress ? (
        <div className="mt-3 space-y-1">
          <Progress value={engine.progress.pct} label="모델 준비" />
          <p className="text-xs text-slate-500">
            {fmtEta(engine.progress.etaSec)} · 경과 {engine.progress.elapsedSec}초
          </p>
          <p className="break-words text-xs text-slate-400">{engine.progress.text}</p>
        </div>
      ) : null}

      {engine.error ? (
        <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs leading-relaxed text-red-700" role="alert">
          모델 준비 실패: {engine.error}
          <br />
          VRAM 이 부족하거나 다운로드가 끊긴 경우입니다. 더 작은 모델을 고르거나 다시 시도하면
          받다 만 지점부터 이어받습니다.
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        모델 파일은 브라우저 Cache Storage 에 저장됩니다. 중간에 창을 닫아도 다음에 <b>이어받기</b>
        가 되고, 두 번째부터는 다운로드 없이 바로 시작합니다. 문서와 모델 모두 서버로 전송되지
        않습니다.
      </p>
    </section>
  );
}
