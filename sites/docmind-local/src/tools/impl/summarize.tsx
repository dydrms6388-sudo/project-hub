"use client";

import PipelineTool from "@/components/docmind/PipelineTool";

export default function Summarize() {
  return (
    <PipelineTool
      kind="summary"
      showLength
      runLabel="요약 시작"
      busyLabel="요약 중…"
      resultTitle="요약 결과"
      intro={
        <>
          PDF·DOCX·TXT 를 브라우저 안에서 직접 요약합니다. 문서를 구간(청크)으로 나눠 각각 요약한
          뒤 그 결과를 다시 합치는 <b>맵리듀스</b> 방식이라, 문맥 4,096토큰짜리 작은 모델로도 긴
          문서를 다룰 수 있습니다.
        </>
      }
    />
  );
}
