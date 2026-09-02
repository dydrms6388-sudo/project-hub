export interface RenderOpts {
  /** 속임수 벗기기 토글 상태 — true면 보조선·실제 값 오버레이를 그린다 */
  reveal: boolean;
  /** 애니메이션 시작 이후 경과 시간(초). 정지 상태에서는 마지막 값으로 고정 */
  t: number;
  /** 애니메이션 재생 중 여부 */
  running: boolean;
}

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: Record<string, number>,
  o: RenderOpts
) => void;

export interface Renderer {
  draw: DrawFn;
  /** true면 rAF 루프·정지 버튼·사전 경고 배너를 활성화한다 */
  animated?: boolean;
}

/** 공용 도우미: reveal 오버레이용 강조색 */
export const REVEAL_COLOR = "#e11d48";
export const REVEAL_COLOR_2 = "#2563eb";

export function revealLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
) {
  ctx.save();
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  const wpx = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(x - wpx / 2, y - 15, wpx, 20);
  ctx.fillStyle = REVEAL_COLOR;
  ctx.fillText(text, x, y);
  ctx.restore();
}
