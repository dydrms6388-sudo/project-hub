"use client";

import BatchConvert from "./_batch";

export default function HeicToJpg() {
  return (
    <BatchConvert
      extensions={["heic", "heif", "hif"]}
      accept=".heic,.heif,.hif,image/heic,image/heif"
      hint="아이폰에서 찍은 .HEIC / .HEIF 파일 (여러 개 한 번에 가능)"
      formats={["image/jpeg", "image/png"]}
      defaultFormat="image/jpeg"
      resizeMode="simple"
      defaultQuality={90}
      zipName="heic-to-jpg.zip"
      runLabel="JPG 로 변환"
      notice={
        <>
          사파리(아이폰·맥)는 HEIC 을 브라우저가 직접 풀기 때문에 가장 빠릅니다. 크롬·엣지·파이어폭스는
          내장된 libheif(WebAssembly)로 풀기 때문에 사진 1장당 1~3초가 걸릴 수 있습니다. 10bit HDR
          이나 시퀀스로 저장된 일부 HEIC 은 풀지 못할 수 있으며, 그런 파일은 결과 표에 실패 사유가
          그대로 표시됩니다.
        </>
      }
    />
  );
}
