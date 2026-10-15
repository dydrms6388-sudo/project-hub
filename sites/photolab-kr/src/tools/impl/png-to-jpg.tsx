"use client";

import BatchConvert from "./_batch";

export default function PngToJpg() {
  return (
    <BatchConvert
      extensions={["png", "jpg", "jpeg", "webp"]}
      accept="image/png,image/jpeg,image/webp"
      hint="PNG → JPG (배경색 지정), JPG → PNG 도 가능"
      formats={["image/jpeg", "image/png"]}
      defaultFormat="image/jpeg"
      resizeMode="simple"
      showBackground
      defaultQuality={90}
      zipName="png-to-jpg.zip"
      runLabel="변환하기"
      notice={
        <>
          PNG 의 투명한 부분은 JPG 로 저장할 수 없습니다. 아래에서 고른 배경색으로 채워지며, 기본값인
          흰색이 문서·인쇄용으로 가장 무난합니다. 로고처럼 투명이 꼭 필요하면 PNG 또는 WEBP 로
          두세요.
        </>
      }
    />
  );
}
