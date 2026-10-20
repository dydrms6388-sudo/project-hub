import Link from "next/link";
import { notFound } from "next/navigation";
import { VisitForm } from "./VisitForm";
import { requireOwner } from "@/lib/auth";
import {
  formatKoreanDate,
  formatKoreanDateTime,
  formatTime,
  isPast,
  todayKST,
} from "@/lib/dates";

export const dynamic = "force-dynamic";

const SERVICE_LABEL: Record<string, string> = {
  extension: "붙임머리",
  wig: "가발",
  other: "기타",
};

const MESSAGE_LABEL: Record<string, string> = {
  booking_confirm: "예약 확인",
  review_request: "후기 요청",
  touchup_reminder: "리터치 안내",
  winback: "재방문 쿠폰",
};

const MESSAGE_STATUS: Record<string, { label: string; className: string }> = {
  sent: { label: "발송됨", className: "badge-done" },
  failed: { label: "실패", className: "badge-fail" },
  skipped_unconfigured: { label: "미설정", className: "badge-muted" },
};

interface Visit {
  id: string;
  service_type: string;
  price: number | null;
  memo: string | null;
  visited_at: string;
  reserved_time: string | null;
  completed_at: string | null;
  next_touchup_at: string | null;
  review_sent_at: string | null;
  touchup_sent_at: string | null;
}

interface Message {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  sent_at: string;
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireOwner();
  const { id } = await params;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, consent_marketing, consent_photo, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  const [{ data: visits }, { data: messages }] = await Promise.all([
    supabase
      .from("visits")
      .select(
        "id, service_type, price, memo, visited_at, reserved_time, completed_at, next_touchup_at, review_sent_at, touchup_sent_at"
      )
      .eq("customer_id", id)
      .order("visited_at", { ascending: false })
      .returns<Visit[]>(),
    supabase
      .from("messages")
      .select("id, kind, status, error, sent_at")
      .eq("customer_id", id)
      .order("sent_at", { ascending: false })
      .limit(20)
      .returns<Message[]>(),
  ]);

  const today = todayKST();
  const completedVisits = (visits ?? []).filter((v) => v.completed_at);
  const totalSpent = completedVisits.reduce((sum, v) => sum + (v.price ?? 0), 0);
  const nextTouchup = (visits ?? [])
    .map((v) => v.next_touchup_at)
    .filter((d): d is string => Boolean(d && d >= today))
    .sort()[0];

  return (
    <>
      <p className="breadcrumb">
        <Link href="/">← 오늘 예약</Link>
      </p>
      <h1>{customer.name}</h1>
      <p className="sub">
        <a href={`tel:${customer.phone}`}>{customer.phone}</a>
        {" · "}마케팅 {customer.consent_marketing ? "동의" : "미동의"}
        {" · "}사진 {customer.consent_photo ? "동의" : "미동의"}
      </p>
      <p className="sub">
        방문 {completedVisits.length}회
        {totalSpent > 0 ? ` · 누적 ${totalSpent.toLocaleString()}원` : ""}
      </p>

      {nextTouchup && (
        <div className="notice">
          다음 리터치 예정일: <b>{formatKoreanDate(nextTouchup)}</b>
          {!customer.consent_marketing && " (마케팅 미동의 — 자동 안내 없음)"}
        </div>
      )}

      <h2>예약 추가</h2>
      <VisitForm customerId={customer.id} today={today} />

      <h2>방문 이력</h2>
      {!visits?.length ? (
        <div className="empty">방문 이력이 없습니다.</div>
      ) : (
        visits.map((v) => (
          <div key={v.id} className="card">
            <div className="row">
              <span className="name">
                {formatKoreanDate(v.visited_at)}
                {v.reserved_time ? ` ${formatTime(v.reserved_time)}` : ""}
              </span>
              {v.completed_at ? (
                <span className="badge badge-done">완료</span>
              ) : isPast(v.visited_at) ? (
                <span className="badge badge-fail">미완료</span>
              ) : (
                <span className="badge badge-wait">예약</span>
              )}
            </div>
            <div className="meta">
              {SERVICE_LABEL[v.service_type] ?? v.service_type}
              {v.price ? ` · ${v.price.toLocaleString()}원` : ""}
              {v.next_touchup_at ? ` · 리터치 ${formatKoreanDate(v.next_touchup_at)}` : ""}
            </div>
            {v.memo && <div className="memo">{v.memo}</div>}
          </div>
        ))
      )}

      <h2>발송 이력</h2>
      {!messages?.length ? (
        <div className="empty">발송된 알림톡이 없습니다.</div>
      ) : (
        messages.map((m) => {
          const status = MESSAGE_STATUS[m.status] ?? {
            label: m.status,
            className: "badge-muted",
          };
          return (
            <div key={m.id} className="card">
              <div className="row">
                <span className="name" style={{ fontSize: 15 }}>
                  {MESSAGE_LABEL[m.kind] ?? m.kind}
                </span>
                <span className="stack" style={{ alignItems: "flex-end" }}>
                  <span className={`badge ${status.className}`}>{status.label}</span>
                  <span className="meta">{formatKoreanDateTime(m.sent_at)}</span>
                </span>
              </div>
              {m.error && m.status === "failed" && (
                <div className="meta meta-error">{m.error}</div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
