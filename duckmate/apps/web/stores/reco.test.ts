import { describe, expect, it } from "vitest";
import { formatCountdown, initialRecoState, recoReducer, UNDO_WINDOW_SEC, undoRemainingSec, type RecoState } from "./reco";

const T0 = 1_700_000_000_000;

describe("recoReducer", () => {
  it("reset: loop_date 가 바뀌면 전부 초기화, 같으면 유지", () => {
    const s1 = recoReducer(initialRecoState, { type: "reset", loopDate: "2026-09-02" });
    expect(s1).toEqual({ ...initialRecoState, loopDate: "2026-09-02" });
    const s2 = recoReducer({ ...s1, index: 3 }, { type: "reset", loopDate: "2026-09-02" });
    expect(s2.index).toBe(3);
    const s3 = recoReducer({ ...s1, index: 3 }, { type: "reset", loopDate: "2026-09-03" });
    expect(s3.index).toBe(0);
    expect(s3.loopDate).toBe("2026-09-03");
  });

  it("setIndex: 음수 방지, 동일 값이면 같은 참조", () => {
    const s = recoReducer(initialRecoState, { type: "setIndex", index: -2 });
    expect(s.index).toBe(0);
    expect(recoReducer(s, { type: "setIndex", index: 0 })).toBe(s);
  });

  it("acted: 마지막 액션 저장 + 300초 되돌리기 창", () => {
    const s = recoReducer(initialRecoState, { type: "acted", recoId: "r1", targetId: "t1", action: "pass", at: T0, matched: false });
    expect(s.lastAction).toEqual({ recoId: "r1", targetId: "t1", action: "pass", at: T0, matched: false });
    expect(s.undoUntil).toBe(T0 + UNDO_WINDOW_SEC * 1000);
    expect(undoRemainingSec(s, T0)).toBe(300);
    expect(undoRemainingSec(s, T0 + 299_500)).toBe(1);
    expect(undoRemainingSec(s, T0 + 300_000)).toBe(0);
  });

  it("acted(matched): 매칭된 좋아요는 되돌리기 창 없음", () => {
    const s = recoReducer(initialRecoState, { type: "acted", recoId: "r1", targetId: "t1", action: "like", at: T0, matched: true });
    expect(s.undoUntil).toBeNull();
    expect(undoRemainingSec(s, T0)).toBe(0);
  });

  it("expire: 만료 시각 이후에만 창을 닫는다", () => {
    const acted = recoReducer(initialRecoState, { type: "acted", recoId: "r1", targetId: "t1", action: "like", at: T0, matched: false });
    expect(recoReducer(acted, { type: "expire", now: T0 + 1000 })).toBe(acted);
    const expired = recoReducer(acted, { type: "expire", now: T0 + 300_000 });
    expect(expired.undoUntil).toBeNull();
    expect(expired.lastAction).not.toBeNull();
  });

  it("undone: 마지막 액션·타이머 제거", () => {
    const acted: RecoState = recoReducer(initialRecoState, { type: "acted", recoId: "r1", targetId: "t1", action: "super", at: T0, matched: false });
    const s = recoReducer(acted, { type: "undone" });
    expect(s.lastAction).toBeNull();
    expect(s.undoUntil).toBeNull();
  });

  it("formatCountdown: mm:ss", () => {
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(61)).toBe("1:01");
    expect(formatCountdown(0)).toBe("0:00");
  });
});
