"use client";

import { useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, NumberInput, Panel, ToolLoading } from "@/components/ui";
import { parseNames, sanitizeStrings } from "@/lib/names";
import { seatLayout } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { r: number; c: number; n: string[]; b: number[] };

const MAXR = 12;
const MAXC = 12;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const r = Number(o.r);
  const c = Number(o.c);
  if (!Number.isInteger(r) || r < 1 || r > MAXR) return null;
  if (!Number.isInteger(c) || c < 1 || c > MAXC) return null;
  const n = sanitizeStrings(o.n, MAXR * MAXC);
  if (!n || n.length < 1) return null;
  const b = Array.isArray(o.b)
    ? o.b.map(Number).filter((v) => Number.isInteger(v) && v >= 0 && v < r * c)
    : [];
  if (n.length > r * c - b.length) return null;
  return { r, c, n, b };
}

export default function Seat() {
  const s = useSeedState<D>(validate);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(5);
  const [namesText, setNamesText] = useState(
    "가영\n나윤\n다온\n라온\n민서\n서준\n하준\n지우\n예린\n윤호",
  );
  const [blocked, setBlocked] = useState<number[]>([]);
  const [err, setErr] = useState("");

  const names = useMemo(() => parseNames(namesText, MAXR * MAXC), [namesText]);
  const d = s.data;
  const grid = useMemo(() => (d ? seatLayout(d, s.seed) : []), [d, s.seed]);

  function toggle(i: number) {
    setBlocked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  function start() {
    setErr("");
    const total = rows * cols;
    const b = blocked.filter((i) => i < total);
    if (names.length === 0) {
      setErr("이름을 1명 이상 입력해 주세요.");
      return;
    }
    if (names.length > total - b.length) {
      setErr(`앉을 자리가 부족합니다. (빈 자리 ${total - b.length}개 / 인원 ${names.length}명)`);
      return;
    }
    s.run({ r: rows, c: cols, n: names, b });
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    const total = rows * cols;
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="행 (세로)" htmlFor="st-r">
              <NumberInput id="st-r" value={rows} min={1} max={MAXR} onChange={setRows} />
            </Field>
            <Field label="열 (가로)" htmlFor="st-c">
              <NumberInput id="st-c" value={cols} min={1} max={MAXC} onChange={setCols} />
            </Field>
          </div>

          <Field label="이름 (줄바꿈 또는 쉼표로 구분)" htmlFor="st-names">
            <textarea
              id="st-names"
              rows={5}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </Field>
          <p className="text-xs text-slate-500">
            인원 {names.length}명 / 자리 {total - blocked.filter((i) => i < total).length}개
          </p>

          <Field label="빈 자리 지정" hint="칸을 눌러 '사용 안 함'으로 바꿉니다. 교탁 앞, 고장난 자리 등에 씁니다.">
            <div className="overflow-x-auto pb-1">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(38px, 1fr))`, minWidth: cols * 42 }}
              >
                {Array.from({ length: total }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(i)}
                    aria-label={`${Math.floor(i / cols) + 1}행 ${(i % cols) + 1}열 ${blocked.includes(i) ? "사용" : "사용 안 함"}으로`}
                    aria-pressed={blocked.includes(i)}
                    className={`h-10 rounded-md border text-xs transition ${
                      blocked.includes(i)
                        ? "border-slate-300 bg-slate-200 text-slate-400 line-through"
                        : "border-slate-300 bg-white text-slate-500 hover:bg-violet-50"
                    }`}
                  >
                    {blocked.includes(i) ? "×" : i + 1}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="자리 배치 실행">
            자리 배치하기
          </Btn>
        </Panel>
      </div>
    );
  }

  const blockedSet = new Set(d.b);

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-3">
        <p className="text-center text-xs font-semibold tracking-widest text-slate-400">— 앞 (칠판) —</p>
        <div className="overflow-x-auto pb-1">
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${d.c}, minmax(56px, 1fr))`, minWidth: d.c * 60 }}
          >
            {grid.map((name, i) => (
              <div
                key={i}
                className={`pf-pop flex h-14 items-center justify-center rounded-lg border px-1 text-center text-xs font-medium ${
                  blockedSet.has(i)
                    ? "border-dashed border-slate-200 bg-slate-50 text-slate-300"
                    : name
                      ? "border-violet-200 bg-violet-50 text-slate-800"
                      : "border-slate-200 bg-white text-slate-300"
                }`}
                style={{ animationDelay: `${Math.min(i, 24) * 25}ms` }}
              >
                {blockedSet.has(i) ? "—" : (name ?? "빈자리")}
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400">seed {s.seed} · pickfair.vercel.app</p>
        <div className="pf-noprint flex flex-wrap gap-2">
          <Btn variant="soft" onClick={() => window.print()} ariaLabel="자리 배치표 인쇄">
            인쇄 / PDF 저장
          </Btn>
        </div>
        <Notice>인쇄 시 머리말·꼬리말과 버튼은 빠지고 배치표만 출력됩니다.</Notice>
      </Panel>

      <SeedBar s={s} shareTitle="자리 배치 결과" shareText="같은 링크를 열면 같은 자리 배치가 나옵니다." />
    </div>
  );
}
