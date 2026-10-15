"use client";

import PipelineTool from "@/components/docmind/PipelineTool";

export default function TranslateSummary() {
  return (
    <PipelineTool
      kind="translate"
      runLabel="한국어 요약 시작"
      busyLabel="번역·요약 중…"
      resultTitle="한국어 요약"
      uploadHint="영어 논문·리포트 PDF (최대 60MB)"
      intro={
        <>
          영어로 된 논문·리포트를 한국어로 옮겨 요약합니다. 전문 용어는 &quot;한국어(English)&quot;
          형태로 병기하고, 배경·방법·결과·한계 순서로 정리합니다. 전체 문장을 그대로 번역하는
          번역기가 아니라 <b>요약 번역</b>입니다.
        </>
      }
    />
  );
}
