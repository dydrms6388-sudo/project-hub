"use client";

import Workbench from "@/components/whisper/Workbench";

/**
 * 회의록 받아쓰기.
 * Whisper 는 화자 분리(diarization) 기능이 없다. 그 사실을 숨기지 않고 먼저 알린 뒤,
 * 타임스탬프를 강조하고 화자 라벨을 사람이 직접 붙일 수 있게 한다.
 */
export default function Meeting() {
  return (
    <Workbench
      extensions={["mp3", "m4a", "wav", "aac", "ogg", "oga", "opus", "flac", "webm", "mp4", "mov", "m4v"]}
      accept="audio/*,video/mp4,video/quicktime"
      hint="회의 녹음 — mp3 · m4a · wav · mp4(화상회의 녹화), 최대 500MB"
      runLabel="회의록 받아쓰기"
      initialMode="timestamp"
      gapSec={1.0}
      allowSpeaker
      emphasizeTime
      docTitle="회의록"
      notice={
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <p className="font-semibold">화자 구분(누가 말했는지)은 되지 않습니다</p>
          <p className="mt-2">
            Whisper 는 &ldquo;무슨 말을 했는지&rdquo;만 알아내는 모델입니다. 목소리를 구분해 A·B·C 로 나누는
            화자 분리(speaker diarization)는 다른 종류의 모델이 필요하고, 이 사이트는 그 기능을 제공하지 않습니다.
            여러 사람이 겹쳐 말한 구간은 한 덩어리로 합쳐져 나올 수 있습니다.
          </p>
          <p className="mt-2">
            대신 <b>구간별 시각이 굵게 표시</b>되고, 각 구간에 <b>화자 이름을 직접 적어 넣는 칸</b>이 있습니다.
            입력한 이름은 TXT·DOCX·자막 내보내기에 그대로 반영됩니다.
          </p>
        </div>
      }
    />
  );
}
