"use client";

import { useEffect, useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, NumberInput, Panel, ToolLoading } from "@/components/ui";
import { rollDice } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { c: number; f: number };

const FACES = [4, 6, 8, 10, 12, 20, 100];
const MAXC = 10;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const c = Number(o.c);
  const f = Number(o.f);
  if (!Number.isInteger(c) || c < 1 || c > MAXC) return null;
  if (!FACES.includes(f)) return null;
  return { c, f };
}

/** 6면체 눈 배치 */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

function Die({ value, faces, rolling }: { value: number; faces: number; rolling: boolean }) {
  return (
    <div
      className={`flex size-16 items-center justify-center rounded-xl border-2 border-slate-200 bg-white shadow-sm ${
        rolling ? "pf-shake" : "pf-pop"
      }`}
      aria-label={`${faces}면체 주사위 ${value}`}
    >
      {faces === 6 ? (
        <svg viewBox="0 0 100 100" className="size-11" aria-hidden="true">
          {(PIPS[value] ?? []).map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={9} fill="#7c3aed" />
          ))}
        </svg>
      ) : (
        <span className="text-xl font-bold tabular-nums text-violet-700">{value}</span>
      )}
    </div>
  );
}

export default function Dice() {
  const s = useSeedState<D>(validate);
  const [count, setCount] = useState(2);
  const [faces, setFaces] = useState(6);
  const [rolling, setRolling] = useState(false);
  const [flick, setFlick] = useState<number[]>([]);

  const d = s.data;
  const rolls = useMemo(() => {
    if (!d) return [];
    return rollDice(s.seed, d.c, d.f);
  }, [d, s.seed]);

  useEffect(() => {
    if (!d) return;
    setRolling(true);
    const iv = window.setInterval(() => {
      setFlick(Array.from({ length: d.c }, () => 1 + Math.floor(Math.random() * d.f)));
    }, 70);
    const t = window.setTimeout(() => {
      window.clearInterval(iv);
      setRolling(false);
    }, 900);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(t);
    };
  }, [d, s.seed]);

  const shown = rolling && flick.length === rolls.length ? flick : rolls;
  const sum = rolls.reduce((a, b) => a + b, 0);

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="주사위 개수 (1~10)" htmlFor="dc-count">
              <NumberInput id="dc-count" value={count} min={1} max={MAXC} onChange={setCount} />
            </Field>
            <Field label="면 수">
              <div className="flex flex-wrap gap-1.5">
                {FACES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-label={`${f}면체 선택`}
                    onClick={() => setFaces(f)}
                    className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                      faces === f
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    D{f}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Btn onClick={() => s.run({ c: count, f: faces })} ariaLabel="주사위 굴리기">
            주사위 굴리기
          </Btn>
          <Notice>
            각 주사위는 1부터 면 수까지 완전히 동일한 확률로 나옵니다. 값은 seed 로부터 계산되므로 결과 링크를
            먼저 공유한 뒤 함께 열어봐도 됩니다.
          </Notice>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-4">
        <div className="flex flex-wrap justify-center gap-2">
          {shown.map((v, i) => (
            <Die key={i} value={v} faces={d.f} rolling={rolling} />
          ))}
        </div>
        <div aria-live="polite" className="text-center">
          <p className="text-sm text-slate-500">
            D{d.f} × {d.c}개
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            합계 {rolling ? "…" : sum}
          </p>
          {!rolling && d.c > 1 ? (
            <p className="mt-1 text-sm text-slate-600">{rolls.join(" + ")} = {sum}</p>
          ) : null}
        </div>
      </Panel>

      <SeedBar s={s} shareTitle="주사위 결과" shareText={`D${d.f} ${d.c}개 → 합계 ${sum}`} />
    </div>
  );
}
