"use client";

import PipelineTool from "@/components/docmind/PipelineTool";

export default function Keypoints() {
  return (
    <PipelineTool
      kind="keypoints"
      runLabel="핵심 정리 시작"
      busyLabel="정리 중…"
      resultTitle="핵심 10가지 + 용어 5개"
      intro={
        <>
          보고서·논문·회의록에서 <b>핵심 10가지</b>와 <b>꼭 알아야 할 용어 5개</b>를 뽑아냅니다.
          구간별로 뽑은 뒤 중복을 제거해 합치므로, 문서가 길수록 시간이 더 걸립니다.
        </>
      }
    />
  );
}
