export type P = Record<string, number>;

export interface Metric {
  label: string;
  value: string;
  unit?: string;
}

export interface DrawOpts {
  /** 쌍둥이 비교 겹쳐 그리기용 보조 시뮬레이션 상태 */
  twin?: Sim | null;
  reveal?: boolean;
}

export interface Sim {
  /** 고정 타임스텝 한 스텝 전진 */
  step(dt: number): void;
  /** 현재 상태를 캔버스에 그린다 */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, opts: DrawOpts): void;
  /** 실시간 수치 패널 항목 */
  metrics(): Metric[];
  /** 보존계면 현재 총에너지, 아니면 null */
  energy(): number | null;
  /** 발산했는지 */
  diverged(): boolean;
  /** 시뮬레이션 시각(초) */
  time: number;
}

export interface SimSpec {
  /** 파라미터로 시뮬레이션 인스턴스를 만든다. twinDelta가 주어지면 초기조건을 미세 교란 */
  create(p: P, twinDelta?: number): Sim;
  /** 고정 타임스텝(초) */
  dt: number;
  /** 한 화면 프레임당 스텝 수(느린 현상 가속·빠른 현상 안정화용) */
  stepsPerFrame?: number;
  /** 보존계 여부(에너지 드리프트 패널 표시) */
  conservative?: boolean;
  /** 자동 재생 여부(false면 사용자가 시작해야 함, 예: 정적 장 표시) */
  autoplay?: boolean;
  /** 배경색 */
  bg?: string;
}

export const INK = "#e2e8f0";
export const BG = "#0b0f19";
export const ACCENT = "#38bdf8";
export const TWIN = "#f472b6";
export const GRID = "#1e293b";

export function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function clearBg(ctx: CanvasRenderingContext2D, w: number, h: number, bg = BG) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}
