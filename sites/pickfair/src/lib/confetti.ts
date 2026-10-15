/** 결과 확정 순간에만 canvas-confetti 를 받아온다 (초기 번들에 포함되지 않게) */
export async function celebrate(intensity: "small" | "big" = "small") {
  try {
    const { default: confetti } = await import("canvas-confetti");
    if (intensity === "big") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
      setTimeout(
        () => confetti({ particleCount: 60, spread: 110, origin: { y: 0.5 }, disableForReducedMotion: true }),
        220,
      );
    } else {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.65 }, disableForReducedMotion: true });
    }
  } catch {
    /* 축포는 실패해도 결과에 영향 없음 */
  }
}
