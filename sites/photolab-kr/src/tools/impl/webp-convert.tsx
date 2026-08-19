"use client";

import BatchConvert from "./_batch";

export default function WebpConvert() {
  return (
    <BatchConvert
      extensions={["webp", "jpg", "jpeg", "png", "heic", "heif"]}
      accept="image/webp,image/jpeg,image/png,.heic,.heif"
      hint="WEBP → JPG/PNG, 또는 JPG/PNG → WEBP 양방향 (여러 개 가능)"
      formats={["image/jpeg", "image/png", "image/webp"]}
      defaultFormat="image/jpeg"
      resizeMode="simple"
      showBackground
      defaultQuality={85}
      zipName="webp-convert.zip"
      runLabel="변환하기"
      notice={
        <>
          출력 형식만 바꾸면 양방향으로 씁니다. WEBP 파일을 넣고 JPG 를 고르면 WEBP→JPG, JPG 를 넣고
          WEBP 를 고르면 JPG→WEBP 가 됩니다. WEBP 인코딩은 사파리 14 이상·크롬·엣지·파이어폭스에서
          지원되며, 지원하지 않는 브라우저에서는 결과 표에 실패로 표시됩니다.
        </>
      }
    />
  );
}
