"use client";

import { useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, NumberInput, Panel, ToolLoading } from "@/components/ui";
import { celebrate } from "@/lib/confetti";
import { parseNames, sanitizeStrings } from "@/lib/names";
import { drawNames } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { n: string[]; c: number };

const MAX = 100;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = sanitizeStrings(o.n, MAX);
  if (!n || n.length < 2) return null;
  const c = Number(o.c);
  if (!Number.isInteger(c) || c < 1 || c > n.length) return null;
  return { n, c };
}

export default function NameDraw() {
  const s = useSeedState<D>(validate);
  const [namesText, setNamesText] = useState("가영\n나윤\n다온\n라온\n민서\n서준");
  const [count, setCount] = useState(1);
  const [opened, setOpened] = useState(0);
  const [err, setErr] = useState("");

  const names = useMemo(() => parseNames(namesText, MAX), [namesText]);
  const d = s.data;
  const drawn = useMemo(
    () => (d ? drawNames(s.seed, d.n, d.c) : []),
    [d, s.seed],
  );

  function start() {
    setErr("");
    if (names.length < 2) {
      setErr("2명 이상 입력해 주세요.");
      return;
    }
    if (count > names.length) {
      setErr("뽑을 인원이 참가자 수보다 많습니다.");
      return;
    }
    setOpened(0);
    s.run({ n: names, c: count });
  }

  function pull() {
    if (!d || opened >= drawn.length) return;
    setOpened((o) => o + 1);
    if (opened + 1 === drawn.length) void celebrate("big");
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field label="참가자 (줄바꿈 또는 쉼표로 구분)" htmlFor="nd-names">
            <textarea
              id="nd-names"
              rows={6}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </Field>
          <div className="w-32">
            <Field label="뽑을 인원" htmlFor="nd-c">
              <NumberInput id="nd-c" value={count} min={1} max={MAX} onChange={setCount} />
            </Field>
          </div>
          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="제비뽑기 시작">
            제비 만들기
          </Btn>
          <Notice>
            제비는 만드는 순간 seed 로 이미 정해집니다. 한 장씩 열어 보는 연출일 뿐, 누가 언제 뽑아도 결과는
            같습니다.
          </Notice>
        </Panel>
      </div>
    );
  }

  const slips = d.n.length;

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-4">
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: slips }, (_, i) => {
            const used = i < opened;
            return (
              <button
                key={i}
                type="button"
                onClick={pull}
                disabled={opened >= drawn.length}
                aria-label={used ? `${i + 1}번 제비 (뽑음)` : `${i + 1}번 제비 뽑기`}
                className={`h-16 w-11 rounded-md border-2 text-xs font-bold transition ${
                  used
                    ? "border-violet-300 bg-violet-100 text-violet-500"
                    : "border-amber-200 bg-amber-50 text-amber-500 hover:-translate-y-1 hover:bg-amber-100 disabled:hover:translate-y-0"
                }`}
              >
                {used ? "✓" : "제비"}
              </button>
            );
          })}
        </div>

        <div className="text-center">
          {opened < drawn.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Btn onClick={pull} ariaLabel="제비 한 장 뽑기">
                한 장 뽑기 ({opened}/{drawn.length})
              </Btn>
              <Btn variant="ghost" onClick={() => setOpened(drawn.length)} ariaLabel="결과 전체 공개">
                전체 공개
              </Btn>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-600">모두 뽑았습니다 🎉</p>
          )}
        </div>

        <ol className="space-y-2" aria-live="polite">
          {drawn.slice(0, opened).map((n, i) => (
            <li
              key={`${n}-${i}`}
              className="pf-pull rounded-xl border-2 border-violet-200 bg-white px-4 py-3 text-center text-lg font-bold text-violet-800"
            >
              <span className="mr-2 text-xs font-medium text-slate-400">{i + 1}번째</span>
              {n}
            </li>
          ))}
        </ol>

        {opened === 0 ? (
          <p className="text-center text-sm text-slate-500">제비를 눌러 한 장씩 열어 보세요.</p>
        ) : null}
      </Panel>

      <SeedBar
        s={s}
        shareTitle="제비뽑기 결과"
        shareText="같은 링크를 열면 같은 제비 결과가 나옵니다."
        onRerun={() => {
          setOpened(0);
          s.rerun();
        }}
      />
    </div>
  );
}
