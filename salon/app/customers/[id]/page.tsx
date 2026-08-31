import { notFound } from "next/navigation";
import { createVisit } from "@/app/actions";
import { formatKoreanDate, formatTime, todayKST } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase";

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

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, consent_marketing, consent_photo, created_at")
    .eq("id", id)
    .single();
  if (!customer) notFound();

  const [{ data: visits }, { data: messages }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, service_type, price, memo, visited_at, reserved_time, completed_at, next_touchup_at, review_sent_at, touchup_sent_at")
      .eq("customer_id", id)
      .order("visited_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, kind, status, sent_at")
      .eq("customer_id", id)
      .order("sent_at", { ascending: false })
      .limit(20),
  ]);

  const today = todayKST();
  const nextTouchup = (visits ?? [])
    .map((v) => v.next_touchup_at)
    .filter((d): d is string => Boolean(d && d >= today))
    .sort()[0];

  return (
    <>
      <h1>{customer.name}</h1>
      <p className="sub">
        {customer.phone}
        {" · "}마케팅 {customer.consent_marketing ? "동의" : "미동의"}
        {" · "}사진 {customer.consent_photo ? "동의" : "미동의"}
      </p>

      {nextTouchup && (
        <div className="notice">
          다음 리터치 예정일: <b>{formatKoreanDate(nextTouchup)}</b>
        </div>
      )}

      <h2>예약 추가</h2>
      <form className="plain card" action={createVisit.bind(null, customer.id)}>
        <div className="grid2">
          <div className="field">
            <label htmlFor="visited_at">날짜</label>
            <input id="visited_at" name="visited_at" type="date" required defaultValue={today} />
          </div>
          <div className="field">
            <label htmlFor="reserved_time">시간</label>
            <input id="reserved_time" name="reserved_time" type="time" />
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="service_type">시술 종류</label>
            <select id="service_type" name="service_type" defaultValue="extension">
              <option value="extension">붙임머리</option>
              <option value="wig">가발</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="price">가격 (원)</label>
            <input id="price" name="price" type="number" inputMode="numeric" min="0" step="1000" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="memo">메모</label>
          <textarea id="memo" name="memo" />
        </div>
        <button className="btn btn-block">예약 등록</button>
      </form>

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
              ) : v.visited_at >= today ? (
                <span className="badge badge-wait">예약</span>
              ) : (
                <span className="badge badge-fail">미완료</span>
              )}
            </div>
            <div className="meta">
              {SERVICE_LABEL[v.service_type] ?? v.service_type}
              {v.price ? ` · ${v.price.toLocaleString()}원` : ""}
              {v.next_touchup_at ? ` · 리터치 ${formatKoreanDate(v.next_touchup_at)}` : ""}
            </div>
            {v.memo && <div className="meta">{v.memo}</div>}
          </div>
        ))
      )}

      <h2>발송 이력</h2>
      {!messages?.length ? (
        <div className="empty">발송된 알림톡이 없습니다.</div>
      ) : (
        messages.map((m) => (
          <div key={m.id} className="card row">
            <span className="name" style={{ fontSize: 15 }}>
              {MESSAGE_LABEL[m.kind] ?? m.kind}
            </span>
            <span className="stack" style={{ alignItems: "flex-end" }}>
              <span className={`badge ${m.status === "sent" ? "badge-done" : "badge-fail"}`}>
                {m.status === "sent" ? "발송됨" : m.status === "failed" ? "실패" : "건너뜀"}
              </span>
              <span className="meta">
                {new Intl.DateTimeFormat("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(m.sent_at))}
              </span>
            </span>
          </div>
        ))
      )}
    </>
  );
}
