"use client";

import { toPng } from "html-to-image";

/** 폰 잠금화면 프리셋 — 대부분의 기기가 9:16 이다. */
export const WALLPAPER = { width: 1080, height: 1920 } as const;

type Options = {
  /** 노드의 CSS 크기와 다른 픽셀 크기로 뽑고 싶을 때 */
  width?: number;
  height?: number;
  pixelRatio?: number;
  backgroundColor?: string;
};

/**
 * DOM 노드를 PNG 로 내려받는다.
 * @font-face 가 가리키는 폰트 파일이 없으면 html-to-image 의 폰트 인라인 단계가
 * 실패할 수 있어, 실패 시 폰트 임베드를 끄고 한 번 더 시도한다(시스템 폰트로 렌더).
 */
export async function downloadPng(node: HTMLElement, filename: string, opts: Options = {}) {
  const config = {
    cacheBust: true,
    pixelRatio: opts.pixelRatio ?? 2,
    width: opts.width,
    height: opts.height,
    backgroundColor: opts.backgroundColor ?? "#ffffff",
  };

  let dataUrl: string;
  try {
    dataUrl = await toPng(node, config);
  } catch {
    dataUrl = await toPng(node, { ...config, skipFonts: true });
  }

  // 앵커는 문서에 붙여야 download 속성이 확실히 먹는다.
  // 파일명은 ASCII 로 둔다 — 한글 파일명을 넣으면 일부 크로미움이 속성을 통째로 버려
  // 확장자 없는 "download" 파일로 저장된다.
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * 캡처 전용 노드를 화면 밖에 두는 래퍼 스타일.
 * 반드시 캡처 대상의 **부모**에 준다 — html-to-image 는 대상 노드의 계산된 스타일을
 * 그대로 복제하므로, 대상 자신이 position:fixed/left:-99999px 이면 결과 이미지에서도
 * 화면 밖에 그려져 빈 PNG 가 나온다. display:none 도 같은 이유로 쓸 수 없다.
 */
export const offscreen: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: -99999,
  pointerEvents: "none",
  zIndex: -1,
};
