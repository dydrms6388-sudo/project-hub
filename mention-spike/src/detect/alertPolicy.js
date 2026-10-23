// 순수 함수: (사용자·코인) 단위 이벤트 상태 머신. 중복 알림 방지 / 쿨다운 / 재알림 임계치.
//
// 이벤트 = 조건 충족이 시작된 시점부터, 조건 미충족이 eventResetSec 동안 지속될 때까지.
// - 새 이벤트 시작                         → 알림 (new_event)
// - 같은 이벤트 진행 중, 쿨다운 이내       → 억제 (cooldown)
// - 쿨다운 경과 + 언급량 ≥ 마지막 알림 × realertMultiplier → 재알림 (realert)
// - 쿨다운 경과했지만 재알림 임계치 미달   → 억제 (below_realert_threshold)
//
// state: { eventId, startedAt, lastMatchAt, lastAlertAt, lastAlertCount, seq } | null
// 반환: { action: "alert" | "suppress" | "none", reason, state }

export function decideAlert({ state, match, count, nowMs, coin, th }) {
  const resetMs = th.eventResetSec * 1000;
  const eventOpen = state && nowMs - state.lastMatchAt < resetMs;

  if (!match) {
    if (state && !eventOpen) return { action: "none", reason: "event_closed", state: null };
    return { action: "none", reason: "no_match", state: state || null };
  }

  if (!eventOpen) {
    const next = { eventId: `${coin}-${nowMs}`, startedAt: nowMs, lastMatchAt: nowMs, lastAlertAt: nowMs, lastAlertCount: count, seq: 1 };
    return { action: "alert", reason: "new_event", state: next };
  }

  const next = { ...state, lastMatchAt: nowMs };
  if (nowMs - state.lastAlertAt < th.cooldownSec * 1000) return { action: "suppress", reason: "cooldown", state: next };
  if (count < state.lastAlertCount * th.realertMultiplier) return { action: "suppress", reason: "below_realert_threshold", state: next };
  return { action: "alert", reason: "realert", state: { ...next, lastAlertAt: nowMs, lastAlertCount: count, seq: state.seq + 1 } };
}
