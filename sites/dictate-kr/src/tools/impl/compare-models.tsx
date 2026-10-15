"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import AudioLoader from "@/components/whisper/AudioLoader";
import EngineBar from "@/components/whisper/EngineBar";
import Progress from "@/components/Progress";
import type { DecodedAudio } from "@/lib/audio";
import { MODELS, type Language, type ModelKey, formatBytes } from "@/lib/models";
import { charErrorRate, formatClock, plainText, wordErrorRate } from "@/lib/transcript";
import { useWhisper } from "@/lib/useWhisper";

type Row = {
  key: ModelKey;
  elapsedMs: number;
  audioSec: number;
  bytes: number;
  text: string;
  chars: number;
};

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

/**
 * 모델 비교.
 *
 * ⚠️ 속도·정확도는 미리 적어 둔 값이 아니라 **사용자 기기에서 그때그때 측정한 값**이다.
 * 같은 모델이라도 CPU/GPU·브라우저·양자화에 따라 몇 배씩 차이가 나므로,
 * 남의 기기에서 잰 숫자를 표에 박아 두는 것은 의미가 없다.
 */
export default function CompareModels() {
  const api = useWhisper();
  const { state } = api;

  const [language, setLanguage] = useState<Language>("ko");
  const [audio, setAudio] = useState<DecodedAudio | null>(null);
  const [picked, setPicked] = useState<ModelKey[]>(["tiny", "base", "small"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState<ModelKey | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const running = current !== null;
  const tooLong = audio !== null && audio.duration > 180;

  function toggle(k: ModelKey) {
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  async function runBenchmark() {
    if (!audio || picked.length === 0) return;
    setRows([]);
    setNote(null);
    const order = MODELS.filter((m) => picked.includes(m.key)).map((m) => m.key);
    const out: Row[] = [];
    for (const key of order) {
      setCurrent(key);
      try {
        const r = await api.run({
          pcm: audio.pcm,
          sampleRate: audio.sampleRate,
          modelKey: key,
          language,
          timestamps: true,
        });
        const text = plainText(r.segments);
        out.push({
          key,
          elapsedMs: r.elapsedMs,
          audioSec: r.audioSec,
          bytes: r.bytes,
          text,
          chars: text.length,
        });
        setRows([...out]);
      } catch (e) {
        setNote(`${key} 모델 측정에 실패했습니다. (${e instanceof Error ? e.message : String(e)})`);
        break;
      }
    }
    setCurrent(null);
  }

  const hasRef = reference.trim().length > 0;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-base font-bold text-slate-900">모델별 공개 사양</h3>
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          아래 파라미터 수는 OpenAI 가 공개한 Whisper 모델 사양입니다. 파일 용량과 처리 속도는 양자화 방식·브라우저·
          하드웨어에 따라 달라져 하나의 숫자로 적을 수 없으므로, <b>이 페이지에서 직접 측정</b>하도록 만들었습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">모델</th>
                <th className="py-2 pr-3 font-medium">파라미터 수</th>
                <th className="py-2 pr-3 font-medium">권장 용도</th>
                <th className="py-2 font-medium">원본</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.key} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 pr-3 font-semibold text-slate-800">whisper-{m.key}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-slate-700">{m.paramsLabel}</td>
                  <td className="py-2.5 pr-3 leading-relaxed text-slate-600">{m.use}</td>
                  <td className="py-2.5">
                    <a
                      href={m.hfUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-blue-600 hover:underline"
                    >
                      HF ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">내 기기에서 직접 재보기</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            같은 오디오를 고른 모델들에 차례로 넣고, 걸린 시간·내려받은 용량을 실제로 잽니다. 정답 텍스트를 직접
            입력하면 문자 오류율(CER)까지 계산합니다. 결과는 <b>지금 이 기기·브라우저 기준</b>이며 다른 환경에서는
            달라집니다.
          </p>
        </div>

        <EngineBar
          api={api}
          modelKey={picked[0] ?? "tiny"}
          onModelKey={() => undefined}
          language={language}
          onLanguage={setLanguage}
          hideModel
          disabled={running}
        />

        <AudioLoader
          extensions={["mp3", "m4a", "wav", "aac", "ogg", "oga", "opus", "flac", "webm", "mp4", "mov"]}
          accept="audio/*,video/mp4"
          hint="30초~1분짜리 한국어 샘플을 권장합니다 — 세 모델을 모두 돌리므로 길면 오래 걸립니다"
          onLoaded={(a) => {
            setAudio(a);
            setRows([]);
          }}
          onCleared={() => {
            setAudio(null);
            setRows([]);
          }}
        />

        {tooLong ? (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            {formatClock(audio.duration)} 짜리 파일입니다. 모델 수만큼 반복 처리하므로 시간이 오래 걸립니다. 1분
            이내 샘플을 권합니다.
          </p>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-600">비교할 모델</legend>
          <div className="flex flex-wrap gap-3">
            {MODELS.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={picked.includes(m.key)}
                  onChange={() => toggle(m.key)}
                  disabled={running}
                  aria-label={`whisper-${m.key} 비교 대상에 포함`}
                  className="h-4 w-4"
                />
                whisper-{m.key}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            고른 모델은 각각 한 번씩 내려받습니다. 처음 실행이라면 데이터 사용량이 큽니다.
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runBenchmark}
            disabled={!audio || picked.length === 0 || running}
            aria-label="벤치마크 실행"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {running ? `whisper-${current} 측정 중…` : "벤치마크 실행"}
          </button>
          {running ? (
            <button
              type="button"
              onClick={api.abort}
              aria-label="중단"
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              중단
            </button>
          ) : null}
        </div>

        {running ? <Progress value={state.progress} label={`whisper-${current} · ${state.label}`} /> : null}
        {note ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {note}
          </p>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900">측정 결과</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">모델</th>
                  <th className="py-2 pr-3 font-medium">처리 시간</th>
                  <th className="py-2 pr-3 font-medium">실시간 대비</th>
                  <th className="py-2 pr-3 font-medium">이번에 내려받은 용량</th>
                  <th className="py-2 pr-3 font-medium">인식 글자 수</th>
                  <th className="py-2 pr-3 font-medium">CER</th>
                  <th className="py-2 font-medium">WER</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const speed = r.audioSec > 0 ? r.audioSec / (r.elapsedMs / 1000) : 0;
                  return (
                    <tr key={r.key} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">whisper-{r.key}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700">
                        {(r.elapsedMs / 1000).toFixed(1)}초
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700">{speed.toFixed(1)}배속</td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700">
                        {r.bytes > 0 ? formatBytes(r.bytes) : "캐시됨"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700">{r.chars.toLocaleString()}자</td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-700">
                        {hasRef ? pct(charErrorRate(reference, r.text)) : "—"}
                      </td>
                      <td className="py-2.5 tabular-nums text-slate-700">
                        {hasRef ? pct(wordErrorRate(reference, r.text)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            &ldquo;실시간 대비&rdquo;는 오디오 길이 ÷ 처리 시간입니다. 2배속이면 10분 녹음을 5분에 처리한다는 뜻입니다.
            첫 실행에는 모델 다운로드 시간이 포함되지 않습니다(다운로드는 별도 단계로 진행됩니다).
            &ldquo;캐시됨&rdquo;은 이미 받아 둔 모델을 재사용했다는 뜻입니다.
          </p>

          <div>
            <label htmlFor="ref-text" className="mb-1 block text-sm font-medium text-slate-700">
              정답 텍스트 (선택) — 넣으면 오류율을 계산합니다
            </label>
            <textarea
              id="ref-text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="샘플 오디오에서 실제로 말한 내용을 그대로 적어 주세요. 문장부호와 띄어쓰기는 자동으로 무시하고 비교합니다."
              className="h-28 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              CER(문자 오류율)은 정답 글자 수 대비 고쳐야 할 글자 수입니다. 한국어는 띄어쓰기가 흔들려 WER 보다 CER 이
              더 안정적인 지표입니다. 낮을수록 좋습니다.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">모델별 인식 결과 전문</h4>
            {rows.map((r) => (
              <div key={r.key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">whisper-{r.key}</span>
                  <CopyButton value={r.text} label="복사" className="ml-auto" />
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{r.text || "(인식된 내용 없음)"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
