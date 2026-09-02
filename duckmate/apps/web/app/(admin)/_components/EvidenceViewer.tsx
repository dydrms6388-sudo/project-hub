"use client";

/** 증거 스냅샷 뷰어: 메시지 50개 원문 ↔ 마스킹 토글, 탐지 hit 강조, 사진 서명 URL. 원문은 화면에만(복사·다운로드 버튼 없음). */
import * as React from "react";
import { Badge, Button } from "@duckmate/ui";
import type { ReportEvidence } from "@duckmate/db";
import { fmtDateTime, shortId } from "@/lib/admin/format";

export function EvidenceViewer({ evidence, photoUrls, targetId, reporterId }: { evidence: ReportEvidence; photoUrls: Record<string, string | null>; targetId: string | null; reporterId: string | null }) {
  const [masked, setMasked] = React.useState(true);
  const hits = new Map<string, string[]>();
  for (const h of evidence.detector_hits ?? []) hits.set(h.message_id, [...(hits.get(h.message_id) ?? []), h.rule_id]);
  const who = (id: string) => (id === targetId ? "대상" : id === reporterId ? "신고자" : shortId(id));
  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-h3">
            메시지 <span className="tnum text-muted-foreground">{evidence.messages?.length ?? 0}</span>
          </h3>
          <Button type="button" size="sm" variant={masked ? "outline" : "secondary"} onClick={() => setMasked((m) => !m)} aria-pressed={!masked}>
            {masked ? "원문 보기" : "마스킹 보기"}
          </Button>
        </div>
        {(evidence.messages?.length ?? 0) === 0 ? (
          <p className="text-body-sm text-muted-foreground">채팅 증거 없음(프로필 신고 또는 매칭 없음)</p>
        ) : (
          <ol className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2">
            {evidence.messages.map((m) => {
              const ids = hits.get(m.id);
              const isTarget = m.sender_id === targetId;
              return (
                <li key={m.id} className={`flex flex-col rounded-md px-3 py-1.5 ${isTarget ? "bg-card" : "bg-secondary/60"} ${ids ? "border border-destructive" : ""}`}>
                  <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    <span className={isTarget ? "font-semibold text-foreground" : ""}>{who(m.sender_id)}</span>
                    <span className="tnum">{fmtDateTime(m.created_at)}</span>
                    {m.is_held ? <Badge variant="warning" size="sm">held</Badge> : null}
                    {ids?.map((r) => (
                      <Badge key={r} variant="danger" size="sm">
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <div className="whitespace-pre-wrap text-body-sm">{masked ? (m.masked_body ?? "") : (m.body ?? m.masked_body ?? "")}</div>
                  {m.image_path ? <div className="text-caption text-muted-foreground">이미지: {m.image_path}</div> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-h3">
          대상 사진 <span className="tnum text-muted-foreground">{evidence.target_photos?.length ?? 0}</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {(evidence.target_photos ?? []).map((p) => {
            const url = photoUrls[p.photo_id];
            return (
              <figure key={p.photo_id} className="w-36">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`대상 사진 ${shortId(p.photo_id)}`} className="aspect-square w-36 rounded-md border border-border object-cover" />
                ) : (
                  <div className="flex aspect-square w-36 items-center justify-center rounded-md border border-dashed border-border text-caption text-muted-foreground">미리보기 없음</div>
                )}
                <figcaption className="text-caption text-muted-foreground">
                  {p.review_status}
                  {p.is_primary ? " · 대표" : ""}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>
    </div>
  );
}
