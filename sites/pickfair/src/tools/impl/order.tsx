"use client";

import { useMemo, useRef, useState } from "react";
import { saveBlob } from "@/components/DownloadButton";
import SeedBar, { BrokenBadge, ReplayBadge } from "@/components/SeedBar";
import { Btn, Field, Notice, Panel, ToolLoading } from "@/components/ui";
import { parseNames, sanitizeStrings } from "@/lib/names";
import { makeOrder } from "@/lib/draws";
import { useSeedState } from "@/lib/seedstate";

type D = { n: string[]; t: string };

const MAXN = 100;

function validate(raw: unknown): D | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const n = sanitizeStrings(o.n, MAXN);
  if (!n || n.length < 2) return null;
  const t = typeof o.t === "string" ? o.t.slice(0, 40) : "";
  return { n, t };
}

export default function OrderTool() {
  const s = useSeedState<D>(validate);
  const [namesText, setNamesText] = useState("가영\n나윤\n다온\n라온\n민서");
  const [title, setTitle] = useState("발표 순서");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const d = s.data;
  const ordered = useMemo(
    () => (d ? makeOrder(s.seed, d.n) : []),
    [d, s.seed],
  );

  function start() {
    setErr("");
    const names = parseNames(namesText, MAXN);
    if (names.length < 2) {
      setErr("2명 이상 입력해 주세요.");
      return;
    }
    s.run({ n: names, t: title.trim().slice(0, 40) || "순서" });
  }

  async function savePng() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      if (blob) saveBlob(blob, `${(d?.t || "순서").replace(/[\\/:*?"<>|]/g, "")}-${s.seed}.png`);
    } catch {
      setErr("이미지 저장에 실패했습니다. 브라우저를 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (!s.ready) return <ToolLoading />;

  if (!d) {
    return (
      <div className="space-y-4">
        {s.broken ? <BrokenBadge /> : null}
        <Panel className="space-y-4">
          <Field label="제목" htmlFor="od-title">
            <input
              id="od-title"
              value={title}
              maxLength={40}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="발표 순서 / 청소 순서"
            />
          </Field>
          <Field label="대상 (줄바꿈 또는 쉼표로 구분)" htmlFor="od-names">
            <textarea
              id="od-names"
              rows={6}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
          </Field>
          {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
          <Btn onClick={start} ariaLabel="순서 정하기 실행">
            순서 정하기
          </Btn>
          <Notice>결과는 이미지(PNG)로 저장할 수 있어 단톡방·게시판에 그대로 올릴 수 있습니다.</Notice>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      {s.replay ? <ReplayBadge /> : null}
      <Panel className="space-y-3">
        <div ref={cardRef} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold text-slate-900">{d.t}</h3>
          <p className="mt-0.5 text-xs text-slate-400">seed {s.seed} · pickfair.vercel.app</p>
          <ol className="mt-3 space-y-1.5">
            {ordered.map((n, i) => (
              <li key={`${n}-${i}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-800">{n}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="soft" onClick={savePng} disabled={busy} ariaLabel="순서 목록 이미지로 저장">
            {busy ? "만드는 중…" : "이미지로 저장 (PNG)"}
          </Btn>
        </div>
        {err ? <p className="text-sm font-medium text-rose-600">{err}</p> : null}
      </Panel>

      <SeedBar s={s} shareTitle={`${d.t} 결과`} shareText={`${d.t}: ${ordered.slice(0, 3).join(" → ")}…`} />
    </div>
  );
}
