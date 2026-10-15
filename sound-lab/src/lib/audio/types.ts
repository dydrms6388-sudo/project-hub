/** 빌더가 받는 컨텍스트: 모든 출력은 반드시 out(프리-리미터 버스)에만 연결한다. */
export interface BuildCtx {
  ac: AudioContext;
  out: GainNode;
}

/** 재생 중 파라미터 변경·정지를 담당하는 핸들 */
export interface SoundHandle {
  update(params: Record<string, number>): void;
  stop(): void;
}

export type Builder = (
  b: BuildCtx,
  params: Record<string, number>
) => SoundHandle;
