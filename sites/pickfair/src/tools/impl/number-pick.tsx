"use client";

import { useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, NumberInput, Panel, ToolLoading } from "@/components/ui";
import { drawNumbers } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { lo: number; hi: number; c: number; dup: boolean; sort: boolean };

const LIMIT = 1_000_000;
const MAXC = 100;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lo = Number(o.lo);
  const hi = Number(o.hi);
  const c = Number(o.c);
  if (![lo, hi, c].every(Number.isInteger)) return null;
  if (lo < -LIMIT || hi > LIMIT || hi < lo) return null;
  if (c < 1 || c > MAXC) return null;
  const dup = Boolean(o.dup);
  if (!dup && c > hi - lo + 1) return null;
  return { lo, hi, c, dup, sort: Boolean(o.sort) };
}

export default function NumberPick() {
  const s = useSeedState<D>(validate);
  const [lo, setLo] = useState(1);
  const [hi, setHi] = useState(45);
  const [c, setC] = useState(6);
  const [dup, setDup] = useState(false);
  const [sort, setSort] = useState(true);
  const [err, setErr] = useState("");

  const d = s.data;
  const nums = useMemo(() => (d ? drawNumbers(d, s.seed) : []), [d, s.seed]);

  function start(over?: Partial<D>) {
    setErr("");
    const next: D = { lo, hi, c, dup, sort, ...over };
    if (next.hi < next.lo) {
      setErr("최댓값이 최솟값보다 작습니다.");
      return;
    }
    if (!next.dup && next.c > next.hi - next.lo + 1) {
      setErr("중복 없이 뽑기에는 범위가 좁습니다. 범위를 넓히거나 개수를 줄여 주세요.");
      return;
    }
    if (next.c > MAXC) {
      setErr(`한 번에 최대 ${MAXC}개까지 뽑을 수 있습니다.`);
      return;
    }
    s.run(next);
  }

  function lotto() {
    setLo(1);
    setHi(45);
    setC(6);
    setDup(false);
    setSort(true);
    start({ lo: 1, hi: 45, c: 6, dup: false, sort: true });
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="최솟값" htmlFor="np-lo">
              <NumberInput id="np-lo" value={lo} min={-LIMIT} max={LIMIT} onChange={setLo} />
            </Field>
            <Field label="최댓값" htmlFor="np-hi">
              <NumberInput id="np-hi" value={hi} min={-LIMIT} max={LIMIT} onChange={setHi} />
            </Field>
            <Field label="뽑을 개수" htmlFor="np-c">
              <NumberInput id="np-c" value={c} min={1} max={MAXC} onChange={setC} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={dup} onChange={(e) => setDup(e.target.checked)} className="size-4" />
              중복 허용
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={sort} onChange={(e) => setSort(e.target.checked)} className="size-4" />
              오름차순 정렬
            </label>
          </div>
          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => start()} ariaLabel="숫자 뽑기">
              숫자 뽑기
            </Btn>
            <Btn variant="soft" onClick={lotto} ariaLabel="로또 프리셋으로 뽑기">
              로또 프리셋 (1~45 중 6개)
            </Btn>
          </div>
          <Notice>
            로또 프리셋은 1~45 중 중복 없이 6개를 고르는 방식만 흉내 낸 것입니다. 당첨 확률을 높여 주지 않으며,
            실제 추첨과는 아무 관련이 없습니다.
          </Notice>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-3">
        <p className="text-sm text-slate-500">
          {d.lo} ~ {d.hi} 중 {d.c}개 · {d.dup ? "중복 허용" : "중복 없음"}
        </p>
        <ul className="flex flex-wrap gap-2" aria-live="polite">
          {nums.map((n, i) => (
            <li
              key={`${n}-${i}`}
              className="pf-pop flex min-w-12 items-center justify-center rounded-full bg-violet-600 px-3 py-2 text-base font-bold tabular-nums text-white"
              style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
            >
              {n}
            </li>
          ))}
        </ul>
      </Panel>

      <SeedBar s={s} shareTitle="숫자 뽑기 결과" shareText={`뽑은 숫자: ${nums.join(", ")}`} />
    </div>
  );
}
