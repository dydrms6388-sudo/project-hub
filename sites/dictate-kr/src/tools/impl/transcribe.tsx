"use client";

import Workbench from "@/components/whisper/Workbench";

export default function Transcribe() {
  return (
    <Workbench
      extensions={["mp3", "m4a", "wav", "aac", "ogg", "oga", "opus", "flac", "webm", "mp4", "mov", "m4v"]}
      accept="audio/*,video/mp4,video/quicktime"
      hint="mp3 · m4a · wav · flac · mp4 · mov (영상은 오디오 트랙만 사용) — 최대 500MB"
      runLabel="받아쓰기 시작"
      initialMode="paragraph"
      gapSec={1.2}
      docTitle="받아쓰기 결과"
    />
  );
}
