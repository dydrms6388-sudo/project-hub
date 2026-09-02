"use client";

/** 신고 조치 폼: triage(우선순위 상향·가져오기) / resolve(confirmed+제재 레벨 | dismissed | need_info) */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Label, Textarea } from "@duckmate/ui";
import { SANCTION_LEVELS } from "@duckmate/db";
import type { Enums, SanctionLevel } from "@duckmate/db";
import { resolveReport, triageReport } from "@/lib/admin/actions";
import type { AdminRole } from "@/lib/admin/constants";
import { REPORT_PRIORITIES } from "@/lib/admin/constants";
import { allowedSanctionLevels } from "@/lib/admin/permissions";

type Props = {
  reportId: string;
  role: AdminRole;
  status: Enums["report_status"];
  priority: Enums["report_priority"];
  handledBy: string | null;
  myUserId: string;
  /** A5 §4.2 사유별 기본 제재 등급(제안값) */
  suggestedLevel: SanctionLevel | null;
  targetActiveLevel: number;
};

export function ReportActions(p: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const open = p.status === "queued" || p.status === "in_review" || p.status === "need_info";
  const levels = allowedSanctionLevels(p.role);
  const [decision, setDecision] = React.useState<"confirmed" | "dismissed" | "need_info">("confirmed");
  const [level, setLevel] = React.useState<number>(p.suggestedLevel && levels.includes(p.suggestedLevel) ? p.suggestedLevel : 0);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; data?: unknown }>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (r.ok) {
        const via = (r.data as { via?: string } | undefined)?.via;
        setMsg({ ok: true, text: `처리됐어요${via === "fallback" ? " (D8 폴백 경로)" : ""}` });
        router.refresh();
      } else setMsg({ ok: false, text: r.message ?? "실패" });
    });

  if (!open) {
    return <p className="text-body-sm text-muted-foreground">종결된 신고예요. 재개는 불가하며 새 신고로 처리해요.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-h3">1. 가져오기 / 우선순위</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const pr = fd.get("priority");
            run(() => triageReport({ reportId: p.reportId, priority: pr && pr !== "" ? String(pr) : undefined, assignToMe: fd.get("assign") === "on", note: (fd.get("note") as string) || undefined }));
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-caption text-muted-foreground">
            우선순위 (상향만)
            <select name="priority" defaultValue="" className="h-10 rounded-md border border-input bg-card px-3 text-body-sm text-foreground">
              <option value="">유지 ({p.priority})</option>
              {REPORT_PRIORITIES.filter((x) => x < p.priority).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-1 text-body-sm">
            <input type="checkbox" name="assign" defaultChecked={p.handledBy !== p.myUserId} /> 내가 담당 (in_review)
          </label>
          <input name="note" placeholder="메모(선택)" className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-body-sm" />
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            적용
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-h3">2. 판정</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const note = String(fd.get("note") ?? "").trim();
            if (decision === "confirmed") {
              const dur = String(fd.get("durationHours") ?? "").trim();
              run(() => resolveReport({ reportId: p.reportId, decision, sanctionLevel: level, durationHours: dur ? Number(dur) : undefined, note }));
            } else run(() => resolveReport({ reportId: p.reportId, decision, note }));
          }}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex gap-4 text-body-sm">
            {(["confirmed", "dismissed", "need_info"] as const).map((d) => (
              <label key={d} className="flex items-center gap-1">
                <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} />
                {d === "confirmed" ? "확정 (confirmed)" : d === "dismissed" ? "기각 (dismissed · AUTO 조치 해제)" : "추가 정보 (need_info)"}
              </label>
            ))}
          </div>
          {decision === "confirmed" ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-caption text-muted-foreground">
                제재 레벨 {p.role === "moderator" ? "(moderator ≤ 3)" : "(admin 1~6)"}
                <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="h-10 rounded-md border border-input bg-card px-3 text-body-sm text-foreground">
                  <option value={0}>제재 없음 (확정만)</option>
                  {levels.map((l) => (
                    <option key={l} value={l}>
                      {l} · {SANCTION_LEVELS[l].label}
                    </option>
                  ))}
                  {p.role === "moderator"
                    ? ([4, 5, 6] as const).map((l) => (
                        <option key={l} value={l} disabled>
                          {l} · {SANCTION_LEVELS[l].label} (admin)
                        </option>
                      ))
                    : null}
                </select>
              </label>
              {level >= 1 && level <= 5 ? (
                <label className="flex flex-col gap-1 text-caption text-muted-foreground">
                  기간(시간, 비우면 기본값)
                  <input name="durationHours" type="number" min={1} className="h-10 w-36 rounded-md border border-input bg-card px-3 text-body-sm" placeholder={String(SANCTION_LEVELS[level as SanctionLevel].durationHours ?? "")} />
                </label>
              ) : null}
              <span className="text-caption text-muted-foreground">
                제안값 {p.suggestedLevel ?? "수동"} · 현재 활성 제재 {p.targetActiveLevel}
              </span>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <Label htmlFor="resolve-note" required hint="피신고자 통보 문구는 별도(사유 카테고리·기간·이의신청 안내)">
              판정 메모 (resolution_note · audit)
            </Label>
            <Textarea id="resolve-note" name="note" required maxLength={500} placeholder="근거가 되는 메시지/사진, 적용 규칙" />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant={decision === "confirmed" && level > 0 ? "destructive" : "default"} loading={pending}>
              {decision === "confirmed" ? (level > 0 ? `확정 + 레벨 ${level} 제재 발급` : "확정 (제재 없음)") : decision === "dismissed" ? "기각" : "추가 정보 요청"}
            </Button>
            {msg ? (
              <span role="status" className={`text-body-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
                {msg.text}
              </span>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
