"use client";

import BatchConvert from "./_batch";

export default function BatchResize() {
  return (
    <BatchConvert
      extensions={["jpg", "jpeg", "png", "webp", "heic", "heif", "hif", "gif", "bmp", "avif"]}
      accept="image/*,.heic,.heif"
      hint="JPG · PNG · WEBP · HEIC 등 (여러 개 한 번에 가능)"
      formats={["image/jpeg", "image/png", "image/webp"]}
      defaultFormat="image/jpeg"
      resizeMode="full"
      defaultResize="maxSide"
      defaultQuality={85}
      zipName="resized.zip"
      runLabel="크기 조절하기"
      notice={
        <>
          줄이기(다운스케일)는 원본 픽셀을 평균 내는 방식이라 결과가 깨끗하지만, 늘리기(업스케일)는
          없던 정보를 만들어낼 수 없어 흐려집니다. 카카오톡·블로그 업로드용이라면 긴 변 1600~2048px,
          이메일 첨부라면 1280px 정도면 충분합니다.
        </>
      }
    />
  );
}
