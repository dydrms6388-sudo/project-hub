"use client";

import CopyButton from "@/components/CopyButton";
import { AI_NOTICE } from "@/lib/docmind/prompts";

/** 아주 가벼운 마크다운 표시(제목/불릿/번호만). 외부 렌더러를 쓰지 않는다. */
export function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: { key: string; body: string }[] = [];
  let ordered = false;

  const flush = () => {
    if (list.length === 0) return;
    const items = list.map((l) => <li key={l.key}>{l.body}</li>);
    out.push(
      ordered ? (
        <ol key={`ol-${out.length}`} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${out.length}`} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      ),
    );
    list = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d{1,2})[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      out.push(
        <h3 key={`h-${i}`} className="mt-4 text-base font-bold text-slate-900 first:mt-0">
          {heading[1]}
        </h3>,
      );
    } else if (bullet) {
      if (ordered) flush();
      ordered = false;
      list.push({ key: `b-${i}`, body: bullet[1] });
    } else if (numbered) {
      if (!ordered) flush();
      ordered = true;
      list.push({ key: `n-${i}`, body: numbered[2] });
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(
        <p key={`p-${i}`} className="leading-relaxed">
          {line}
        </p>,
      );
    }
  });
  flush();
  return <div className="space-y-2 break-words text-[15px] text-slate-800">{out}</div>;
}

export default function ResultView({
  text,
  streaming = false,
  title = "결과",
  children,
}: {
  text: string;
  streaming?: boolean;
  title?: string;
  children?: React.ReactNode;
}) {
  if (!text && !streaming) return null;
  return (
    <section className="rounded-xl border border-slate-200 p-4" aria-label={title} aria-live="polite">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <CopyButton value={() => text} label="결과 복사" />
      </div>
      <MiniMarkdown text={text} />
      {streaming ? (
        <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-slate-400 align-middle" aria-hidden="true" />
      ) : null}
      {children}
      <p className="mt-4 rounded-lg bg-amber-50 p-2.5 text-xs font-medium leading-relaxed text-amber-900">
        ⚠️ {AI_NOTICE}
      </p>
    </section>
  );
}
