"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "@/lib/storage";
import { kstToday } from "@/lib/kst";

type Phase = "focus" | "short" | "long";
type Durations = { focus: number; short: number; long: number }; // 분

const DEFAULTS: Durations = { focus: 25, short: 5, long: 15 };
const SETS_PER_CYCLE = 4;

const PHASE_LABEL: Record<Phase, string> = { focus: "집중", short: "짧은 휴식", long: "긴 휴식" };
const PHASE_HINT: Record<Phase, string> = {
  focus: "지금은 한 가지만 합니다.",
  short: "일어나서 눈을 쉬게 하세요.",
  long: "충분히 쉬고 다시 시작합니다.",
};

const clampMinutes = (n: number) => Math.min(180, Math.max(1, Math.round(n)));

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 종료음 — 짧은 비프 두 번. 첫 재생은 사용자가 시작을 누른 뒤라 자동재생 정책에 걸리지 않는다. */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const beep = useCallback(() => {
    const ctx = ensure();
    if (!ctx) return;
    [0, 0.32].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const t = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }, [ensure]);

  return { beep, ensure };
}

/** 타이머가 도는 동안 화면이 꺼지지 않게 한다. 미지원 브라우저에서는 조용히 넘어간다. */
function useWakeLock(active: boolean) {
  const lockRef = useRef<{ release(): Promise<void> } | null>(null);

  useEffect(() => {
    const api = (
      navigator as unknown as {
        wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
      }
    ).wakeLock;
    if (!api) return;

    let cancelled = false;

    const acquire = async () => {
      if (!active || document.visibilityState !== "visible" || lockRef.current) return;
      try {
        const lock = await api.request("screen");
        if (cancelled) void lock.release().catch(() => {});
        else lockRef.current = lock;
      } catch {
        /* 배터리 절약 모드 등 — 무시 */
      }
    };

    const release = () => {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };

    if (active) void acquire();
    else release();

    // 탭을 벗어나면 락이 자동 해제되므로 돌아올 때 다시 잡는다.
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      release();
    };
  }, [active]);
}

export default function Pomodoro() {
  const [durations, setDurations] = useLocalStorage<Durations>("studyroom:pomodoro:durations", DEFAULTS);
  const [today, setToday] = useLocalStorage<{ date: string; count: number }>(
    "studyroom:pomodoro:today",
    { date: "", count: 0 }
  );

  const [phase, setPhase] = useState<Phase>("focus");
  const [cycle, setCycle] = useState(0); // 이번 사이클에서 끝낸 집중 세트
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(DEFAULTS.focus * 60_000);

  const { beep, ensure } = useBeep();
  useWakeLock(running);

  const fullMs = durations[phase] * 60_000;

  // 멈춰 있을 때는 설정한 길이를 그대로 보여준다.
  useEffect(() => {
    if (!running && endsAt === null) setLeft(durations[phase] * 60_000);
  }, [durations, phase, running, endsAt]);

  // 날짜가 바뀌면 오늘 세션 수를 0부터 다시 센다.
  useEffect(() => {
    const t = kstToday();
    if (today.date !== t) setToday({ date: t, count: 0 });
  }, [today.date, setToday]);

  /** 한 구간이 끝났을 때 다음 구간으로 넘어간다. */
  const complete = useCallback(() => {
    beep();
    if (phase === "focus") {
      const next = cycle + 1;
      setCycle(next % SETS_PER_CYCLE);
      setToday((t) => ({ date: t.date || kstToday(), count: t.count + 1 }));
      const nextPhase: Phase = next % SETS_PER_CYCLE === 0 ? "long" : "short";
      setPhase(nextPhase);
      setEndsAt(Date.now() + durations[nextPhase] * 60_000);
    } else {
      setPhase("focus");
      setEndsAt(Date.now() + durations.focus * 60_000);
    }
  }, [beep, phase, cycle, durations, setToday]);

  // 남은 시간은 뺄셈이 아니라 '끝나는 시각 − 지금'으로 잰다.
  // 백그라운드 탭에서 setInterval 이 느려져도 값이 밀리지 않는다.
  useEffect(() => {
    if (!running || endsAt === null) return;
    const tick = () => {
      const remain = endsAt - Date.now();
      if (remain <= 0) complete();
      else setLeft(remain);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, endsAt, complete]);

  // 탭 제목에 남은 시간
  useEffect(() => {
    const original = document.title;
    if (running) document.title = `${fmt(left)} · ${PHASE_LABEL[phase]}`;
    return () => {
      document.title = original;
    };
  }, [running, left, phase]);

  const start = () => {
    ensure(); // 사용자 제스처 안에서 오디오를 깨워 둔다
    setEndsAt(Date.now() + left);
    setRunning(true);
  };

  const pause = () => {
    if (endsAt !== null) setLeft(Math.max(0, endsAt - Date.now()));
    setRunning(false);
    setEndsAt(null);
  };

  const reset = () => {
    setRunning(false);
    setEndsAt(null);
    setLeft(durations[phase] * 60_000);
  };

  const jump = (p: Phase) => {
    setRunning(false);
    setEndsAt(null);
    setPhase(p);
    setLeft(durations[p] * 60_000);
  };

  const progress = fullMs > 0 ? 1 - Math.min(1, left / fullMs) : 0;
  const R = 88;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      {/* 구간 선택 */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="구간">
          {(["focus", "short", "long"] as Phase[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => jump(p)}
              aria-pressed={phase === p}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                phase === p ? "bg-ink text-white" : "text-muted"
              }`}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 타이머 */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label={`${PHASE_LABEL[phase]} 남은 시간 ${fmt(left)}`}>
            <circle cx="100" cy="100" r={R} fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="#16181d"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 100 100)"
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold tabular-nums text-ink">{fmt(left)}</span>
            <span className="mt-1 text-sm text-muted">{PHASE_LABEL[phase]}</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">{PHASE_HINT[phase]}</p>
      </div>

      {/* 조작 */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={running ? pause : start}
          className="rounded-lg bg-ink px-6 py-2.5 text-[15px] font-medium text-white"
        >
          {running ? "일시정지" : left === fullMs ? "시작" : "이어서"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line px-4 py-2.5 text-[15px] font-medium"
        >
          되돌리기
        </button>
      </div>

      {/* 세트 표시 */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex gap-1.5" aria-label={`이번 사이클 ${cycle}/${SETS_PER_CYCLE} 세트`}>
          {Array.from({ length: SETS_PER_CYCLE }, (_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${i < cycle ? "bg-ink" : "bg-line"}`}
            />
          ))}
        </div>
        <span className="text-sm text-muted">
          오늘 <strong className="text-ink">{today.count}</strong>세션
        </span>
      </div>

      {/* 길이 설정 */}
      <div className="rounded-xl bg-paper p-3">
        <h3 className="text-[15px] font-bold text-ink">시간 설정 (분)</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["focus", "short", "long"] as Phase[]).map((p) => (
            <label key={p} className="text-sm text-muted">
              {PHASE_LABEL[p]}
              <input
                type="number"
                min={1}
                max={180}
                value={durations[p]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setDurations((d) => ({ ...d, [p]: clampMinutes(n) }));
                }}
                aria-label={`${PHASE_LABEL[p]} 시간(분)`}
                className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[15px] text-ink outline-none focus:border-ink"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDurations(DEFAULTS)}
          className="mt-2 text-sm text-muted underline underline-offset-2"
        >
          25 · 5 · 15 로 되돌리기
        </button>
      </div>

      <p className="text-xs text-muted">
        집중 {SETS_PER_CYCLE}세트마다 긴 휴식이 옵니다. 오늘 세션 수는 이 브라우저에만 저장되고 날짜가 바뀌면 초기화됩니다.
      </p>
    </div>
  );
}
