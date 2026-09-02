"use client";

/**
 * 사진 검수 그리드. 키보드: A 승인 / R 반려(코드 선택 열림) / X 선택 토글 / J·K 이동. 일괄 처리 = 선택된 항목 전부.
 * 자동 반려 없음(A5 §8). 승인/반려 시 트리거가 verify_level 을 재계산한다(0009 trg_photos_recompute_level).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@duckmate/ui";
import { reviewPhotos } from "@/lib/admin/actions";
import { PHOTO_KEYS, PHOTO_REVIEW_DECISIONS, type PhotoReviewDecision } from "@/lib/admin/constants";
import type { PhotoQueueItem } from "@/lib/admin/types";
import { fmtDateTime, shortId } from "@/lib/admin/format";

export function PhotoReviewGrid({ items }: { items: PhotoQueueItem[] }) {
  const router = useRouter();
  const [cursor, setCursor] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const targets = React.useCallback((): string[] => {
    if (selected.size > 0) return [...selected];
    const cur = items[cursor];
    return cur ? [cur.id] : [];
  }, [selected, items, cursor]);

  const submit = React.useCallback(
    (decision: "approved" | PhotoReviewDecision) => {
      const ids = targets();
      if (ids.length === 0) return;
      if (decision === "held" && !note.trim()) {
        setMsg("보류 사유(메모)를 입력해 주세요");
        return;
      }
      start(async () => {
        const r = await reviewPhotos({ photoIds: ids, decision, note: note.trim() || undefined });
        if (!r.ok) {
          setMsg(r.message);
          return;
        }
        setMsg(`${r.data.done.length}건 처리${r.data.failed.length ? `, 실패 ${r.data.failed.length}건: ${r.data.failed[0]?.message ?? ""}` : ""}${r.data.via === "fallback" ? " (D8 폴백)" : ""}`);
        setSelected(new Set());
        setRejectOpen(false);
        setNote("");
        router.refresh();
      });
    },
    [targets, note, router],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const k = e.key.toLowerCase();
      if (rejectOpen) {
        const d = PHOTO_REVIEW_DECISIONS.find((x) => x.key === k);
        if (d) {
          e.preventDefault();
          submit(d.code);
        } else if (k === "escape") setRejectOpen(false);
        return;
      }
      if (k === PHOTO_KEYS.approve) {
        e.preventDefault();
        submit("approved");
      } else if (k === PHOTO_KEYS.reject) {
        e.preventDefault();
        setRejectOpen(true);
      } else if (k === PHOTO_KEYS.next) setCursor((c) => Math.min(items.length - 1, c + 1));
      else if (k === PHOTO_KEYS.prev) setCursor((c) => Math.max(0, c - 1));
      else if (k === PHOTO_KEYS.select) {
        const cur = items[cursor];
        if (cur) setSelected((s) => {
          const n = new Set(s);
          if (n.has(cur.id)) n.delete(cur.id);
          else n.add(cur.id);
          return n;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, cursor, rejectOpen, submit]);

  if (items.length === 0) return <p className="rounded-lg border border-border bg-card p-8 text-center text-body-sm text-muted-foreground">검수 대기 사진이 없어요</p>;

  const count = selected.size > 0 ? selected.size : 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <span className="text-body-sm">
          대상 <span className="tnum font-semibold">{count}</span>건 {selected.size > 0 ? "(선택)" : "(커서)"}
        </span>
        <Button size="sm" onClick={() => submit("approved")} loading={pending}>
          승인 (A)
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setRejectOpen((o) => !o)} disabled={pending}>
          반려 (R)
        </Button>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모(보류 시 필수)" className="h-9 w-64 rounded-md border border-input bg-card px-3 text-body-sm" />
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
          전체 선택
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
          선택 해제
        </Button>
        <span className="text-caption text-muted-foreground">J/K 이동 · X 선택 · 승인/반려 시 verify_level 자동 재계산(트리거)</span>
        {msg ? (
          <span role="status" className="w-full text-body-sm text-foreground">
            {msg}
          </span>
        ) : null}
        {rejectOpen ? (
          <div role="menu" className="grid w-full grid-cols-2 gap-1 border-t border-border pt-2 lg:grid-cols-4">
            {PHOTO_REVIEW_DECISIONS.map((d) => (
              <button key={d.code} type="button" role="menuitem" onClick={() => submit(d.code)} className="flex flex-col items-start rounded-md border border-border px-3 py-2 text-left text-body-sm hover:bg-muted">
                <span>
                  <kbd className="mr-1 rounded bg-muted px-1 text-caption">{d.key}</kbd>
                  {d.label}
                </span>
                <span className="text-caption text-muted-foreground">사용자 안내: {d.userMessage}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {items.map((p, i) => {
          const isCur = i === cursor;
          const isSel = selected.has(p.id);
          const face = p.auto_flags.face ?? "unknown";
          return (
            <li
              key={p.id}
              onClick={() => setCursor(i)}
              className={`flex flex-col gap-1 rounded-lg border bg-card p-2 ${isCur ? "border-primary outline-2 outline-offset-2 outline-ring" : "border-border"} ${isSel ? "bg-secondary/50" : ""}`}
            >
              <div className="relative">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={`검수 대기 사진 ${shortId(p.id)}`} className="aspect-square w-full rounded-md object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border text-caption text-muted-foreground">미리보기 없음</div>
                )}
                <label className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-card/90 px-2 py-1 text-caption">
                  <input type="checkbox" checked={isSel} onChange={() => setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(p.id)) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  })} />
                  선택
                </label>
                {p.is_primary ? <Badge variant="primary" size="sm" className="absolute right-2 top-2">대표</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant={p.review_status === "held" ? "warning" : "muted"} size="sm">{p.review_status}</Badge>
                <Badge variant={face === "one" ? "success" : face === "none" || face === "many" ? "danger" : "muted"} size="sm">
                  얼굴 {face}
                  {p.face_count !== null ? ` (${p.face_count})` : ""}
                </Badge>
                {p.face_confidence !== null ? <Badge variant="outline" size="sm" className="tnum">conf {Number(p.face_confidence).toFixed(2)}</Badge> : null}
                <Badge variant="outline" size="sm">{p.auto_flags.detector ?? "detector ?"}</Badge>
                {p.recent_rejections >= 3 ? <Badge variant="danger" size="sm">24h 반려 {p.recent_rejections}</Badge> : null}
              </div>
              <div className="text-caption text-muted-foreground">
                <a href={`/admin/users/${p.profile_id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {p.nickname ?? shortId(p.profile_id)}
                </a>{" "}
                · L{p.profile_verify_level} · <span className="tnum">{fmtDateTime(p.created_at)}</span>
                {p.held_reason ? <div>held: {p.held_reason}</div> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
