"use client";

import Workbench from "@/components/whisper/Workbench";

/**
 * 강의 녹음 정리.
 * 전사 엔진은 동일하고, 문단을 나누는 무음 기준을 길게(2초) 잡아
 * 판서·질문 대기처럼 호흡이 긴 강의에서 덩어리가 잘게 쪼개지지 않게 한다.
 * 요약·핵심정리는 하지 않는다(그건 별도 로컬 LLM 도구의 몫).
 */
export default function Lecture() {
  return (
    <Workbench
      extensions={["mp3", "m4a", "wav", "aac", "ogg", "oga", "opus", "flac", "webm", "mp4", "mov", "m4v"]}
      accept="audio/*,video/mp4,video/quicktime"
      hint="90분짜리 강의 녹음도 됩니다 — mp3 · m4a · wav · mp4, 최대 500MB"
      runLabel="강의 녹음 정리하기"
      initialMode="paragraph"
      gapSec={2}
      docTitle="강의 녹취록"
      notice={
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          <p className="font-semibold text-slate-900">이 도구가 하는 일 / 하지 않는 일</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              말이 <b>2초 이상 끊긴 지점</b>을 문단 경계로 삼아, 읽을 수 있는 덩어리로 자동으로 나눕니다.
            </li>
            <li>
              <b>요약·핵심 정리는 하지 않습니다.</b> 들린 말을 그대로 옮기는 것까지가 이 도구의 범위입니다.
              말한 적 없는 문장이 요약이라는 이름으로 섞여 들어가지 않도록 일부러 뺐습니다.
            </li>
            <li>강의는 대부분 한 사람이 말하므로 화자 구분 없이도 대체로 읽힙니다.</li>
          </ul>
        </div>
      }
    />
  );
}
