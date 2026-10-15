import Link from "next/link";
import { VisitActions } from "@/app/components/VisitActions";
import { requireOwner } from "@/lib/auth";
import { addDays, formatKoreanDate, formatTime, todayKST } from "@/lib/dates";
import { sanitizeSearchTerm } from "@/lib/validate";

export const dynamic = "force-dynamic";

const SERVICE_LABEL: Record<string, string> = {
  extension: "붙임머리",
  wig: "가발",
  other: "기타",
};

const TOUCHUP_WINDOW_DAYS = 7;

interface TodayVisit {
  id: string;
  service_type: string;
  price: number | null;
  reserved_time: string | null;
  completed_at: string | null;
  customers: { id: string; name: string } | null;
}

interface TouchupSoon {
  id: string;
  next_touchup_at: string;
  customers: { id: string; name: string; consent_marketing: boolean } | null;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase } = await requireOwner();
  const { q } = await searchParams;
  const term = sanitizeSearchTerm(q ?? "");
  const today = todayKST();

  let customerQuery = supabase
    .from("customers")
    .select("id, name, phone")
    .order("created_at", { ascending: false })
    .limit(20);
  if (term) {
    const digits = term.replace(/\D/g, "");
    customerQuery = customerQuery.or(
      digits
        ? `name.ilike.%${term}%,phone.ilike.%${digits}%`
        : `name.ilike.%${term}%`
    );
  }

  const [{ data: visits }, { data: touchups }, { data: customers }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, service_type, price, reserved_time, completed_at, customers(id, name)")
      .eq("visited_at", today)
      .order("reserved_time", { ascending: true, nullsFirst: false })
      .returns<TodayVisit[]>(),
    supabase
      .from("visits")
      .select("id, next_touchup_at, customers(id, name, consent_marketing)")
      .gte("next_touchup_at", today)
      .lte("next_touchup_at", addDays(today, TOUCHUP_WINDOW_DAYS))
      .is("touchup_sent_at", null)
      .order("next_touchup_at", { ascending: true })
      .limit(10)
      .returns<TouchupSoon[]>(),
    customerQuery.returns<CustomerRow[]>(),
  ]);

  const doneCount = (visits ?? []).filter((v) => v.completed_at).length;

  return (
    <>
      <h1>오늘 예약</h1>
      <p className="sub">
        {formatKoreanDate(today)}
        {visits?.length ? ` · ${visits.length}건 중 ${doneCount}건 완료` : ""}
      </p>

      {!visits?.length ? (
        <div className="empty">오늘 예약이 없습니다.</div>
      ) : (
        visits.map((v) => (
          <div key={v.id} className="card row">
            <div className="stack">
              {v.customers ? (
                <Link href={`/customers/${v.customers.id}`} className="name">
                  {v.customers.name}
                </Link>
              ) : (
                <span className="name">(삭제된 고객)</span>
              )}
              <span className="meta">
                {formatTime(v.reserved_time) || "시간 미정"} ·{" "}
                {SERVICE_LABEL[v.service_type] ?? v.service_type}
                {v.price ? ` · ${v.price.toLocaleString()}원` : ""}
              </span>
            </div>
            <VisitActions visitId={v.id} completed={Boolean(v.completed_at)} />
          </div>
        ))
      )}

      {touchups?.length ? (
        <>
          <h2>곧 리터치 ({TOUCHUP_WINDOW_DAYS}일 이내)</h2>
          {touchups.map((t) => (
            <div key={t.id} className="card row">
              <div className="stack">
                {t.customers ? (
                  <Link href={`/customers/${t.customers.id}`} className="name">
                    {t.customers.name}
                  </Link>
                ) : (
                  <span className="name">(삭제된 고객)</span>
                )}
                <span className="meta">{formatKoreanDate(t.next_touchup_at)} 예정</span>
              </div>
              {t.customers?.consent_marketing ? (
                <span className="badge badge-wait">안내 예약됨</span>
              ) : (
                <span className="badge badge-muted">동의 없음</span>
              )}
            </div>
          ))}
        </>
      ) : null}

      <h2>고객 찾기</h2>
      <form className="searchbar" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="이름 또는 연락처"
          aria-label="고객 검색"
        />
        <button className="btn btn-ghost">검색</button>
      </form>

      {!customers?.length ? (
        <div className="empty">
          {term ? "검색 결과가 없습니다." : "아직 등록된 고객이 없습니다."}
        </div>
      ) : (
        customers.map((c) => (
          <Link key={c.id} href={`/customers/${c.id}`} className="card row card-link">
            <span className="name">{c.name}</span>
            <span className="meta">{c.phone}</span>
          </Link>
        ))
      )}
    </>
  );
}
