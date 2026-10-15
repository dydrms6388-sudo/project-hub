"use client";

import { useEffect, useMemo, useState } from "react";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, Panel, ToolLoading } from "@/components/ui";
import { celebrate } from "@/lib/confetti";
import { decideYesNo } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { q: string; p: number };

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const q = typeof o.q === "string" ? o.q.slice(0, 80) : "";
  const p = Number(o.p);
  if (!Number.isInteger(p) || p < 0 || p > 100) return null;
  return { q, p };
}

export default function YesNo() {
  const s = useSeedState<D>(validate);
  const [q, setQ] = useState("");
  const [p, setP] = useState(50);
  const [spin, setSpin] = useState(false);

  const d = s.data;
  const yes = useMemo(() => {
    if (!d) return false;
    return decideYesNo(s.seed, d.p);
  }, [d, s.seed]);

  useEffect(() => {
    if (!d) return;
    setSpin(true);
    const t = window.setTimeout(() => {
      setSpin(false);
      void celebrate("small");
    }, 1000);
    return () => window.clearTimeout(t);
  }, [d, s.seed]);

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field label="질문 (선택)" htmlFor="yn-q">
            <input
              id="yn-q"
              value={q}
              maxLength={80}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="오늘 야식 시킬까?"
            />
          </Field>
          <Field label={`'예'가 나올 확률: ${p}%`} htmlFor="yn-p" hint="50%면 완전한 동전 던지기입니다.">
            <input
              id="yn-p"
              type="range"
              min={0}
              max={100}
              step={5}
              value={p}
              onChange={(e) => setP(Number(e.target.value))}
              className="w-full accent-violet-600"
              aria-label="예가 나올 확률"
            />
          </Field>
          <Btn onClick={() => s.run({ q: q.trim().slice(0, 80), p })} ariaLabel="예 아니오 결정하기">
            결정하기
          </Btn>
          <Notice>
            결정을 대신해 주는 도구가 아니라, 이미 반반인 선택을 빨리 끝내기 위한 도구입니다. 중요한 결정에는
            사용하지 마세요.
          </Notice>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-4 text-center">
        {d.q ? <p className="text-sm text-slate-600">{d.q}</p> : null}
        <div className="flex justify-center py-2" aria-live="polite">
          {spin ? (
            <div className="flex size-28 items-center justify-center rounded-full border-8 border-slate-200 border-t-violet-600 animate-spin">
              <span className="sr-only">결정하는 중</span>
            </div>
          ) : (
            <div
              className={`pf-pop flex size-28 items-center justify-center rounded-full text-3xl font-extrabold text-white ${
                yes ? "bg-violet-600" : "bg-slate-500"
              }`}
            >
              {yes ? "예" : "아니오"}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          설정된 &apos;예&apos; 확률 {d.p}% · seed {s.seed}
        </p>
      </Panel>

      <SeedBar
        s={s}
        shareTitle="예/아니오 결과"
        shareText={`${d.q ? `${d.q} → ` : ""}${yes ? "예" : "아니오"}`}
      />
    </div>
  );
}
