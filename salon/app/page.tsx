import Link from "next/link";
import { completeVisit } from "@/app/actions";
import { formatKoreanDate, formatTime, todayKST } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SERVICE_LABEL: Record<string, string> = {
  extension: "붙임머리",
  wig: "가발",
  other: "기타",
};

interface TodayVisit {
  id: string;
  service_type: string;
  price: number | null;
  reserved_time: string | null;
  completed_at: string | null;
  customers: { id: string; name: string; phone: string } | null;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const today = todayKST();

  const { data: visits } = await supabase
    .from("visits")
    .select("id, service_type, price, reserved_time, completed_at, customers(id, name, phone)")
    .eq("visited_at", today)
    .order("reserved_time", { ascending: true, nullsFirst: false })
    .returns<TodayVisit[]>();

  let customerQuery = supabase
    .from("customers")
    .select("id, name, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (q?.trim()) {
    const term = q.trim();
    customerQuery = customerQuery.or(
      `name.ilike.%${term}%,phone.ilike.%${term.replace(/\D/g, "") || term}%`
    );
  }
  const { data: customers } = await customerQuery.returns<CustomerRow[]>();

  return (
    <>
      <h1>오늘 예약</h1>
      <p className="sub">{formatKoreanDate(today)}</p>

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
            {v.completed_at ? (
              <span className="badge badge-done">완료</span>
            ) : (
              <form className="plain" action={completeVisit.bind(null, v.id)}>
                <button className="btn">시술 완료</button>
              </form>
            )}
          </div>
        ))
      )}

      <h2>고객 찾기</h2>
      <form className="searchbar" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="이름 또는 연락처"
        />
        <button className="btn btn-ghost">검색</button>
      </form>

      {!customers?.length ? (
        <div className="empty">
          {q ? "검색 결과가 없습니다." : "아직 등록된 고객이 없습니다."}
        </div>
      ) : (
        customers.map((c) => (
          <Link key={c.id} href={`/customers/${c.id}`} className="card row" style={{ display: "flex", textDecoration: "none", color: "inherit" }}>
            <span className="name">{c.name}</span>
            <span className="meta">{c.phone}</span>
          </Link>
        ))
      )}
    </>
  );
}
