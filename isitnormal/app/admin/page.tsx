import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin";
import { getAdminData } from "@/lib/admin-stats";
import AdminLogin from "@/components/AdminLogin";
import AdminActions from "@/components/AdminActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-3">
      <div className="text-xs text-ink/50">{label}</div>
      <div className="text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const d = await getAdminData();

  if (d.offline) {
    return (
      <div className="py-16 text-center text-sm text-ink/60">
        Supabase가 연결되지 않아 대시보드 데이터를 불러올 수 없어요. 환경변수를 확인하세요.
      </div>
    );
  }

  const kValue =
    d.events.share_click > 0
      ? (d.events.share_to_vote / d.events.share_click).toFixed(2)
      : "0.00";
  const now = Date.now();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-ink">관리자 대시보드</h1>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink/70">지표</h2>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="총 투표" value={d.totals.votes.toLocaleString()} />
          <Stat label="승인 설문" value={d.totals.approved} />
          <Stat label="색인(승격)" value={d.totals.indexed} />
          <Stat label="K값(공유→투표)" value={kValue} />
          <Stat label="봇 투표 추정" value={`${Math.round(d.botRatio * 100)}%`} />
          <Stat label="미처리 신고" value={d.reportsOpen} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink/70">
          삭제 요청 (48h SLA) · {d.takedowns.length}건
        </h2>
        {d.takedowns.length === 0 ? (
          <p className="text-sm text-ink/40">대기 중인 요청 없음</p>
        ) : (
          <ul className="space-y-3">
            {d.takedowns.map((t) => {
              const overdue = new Date(t.sla_due_at).getTime() < now;
              return (
                <li key={t.id} className="rounded-xl border border-black/5 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{t.target_ref.slice(0, 60)}</span>
                    <span className={overdue ? "text-xs font-bold text-red-500" : "text-xs text-ink/40"}>
                      {overdue ? "기한 초과" : "기한 내"}
                    </span>
                  </div>
                  <p className="mt-1 text-ink/60">{t.reason.slice(0, 120)}</p>
                  <p className="text-xs text-ink/40">회신처: {t.contact}</p>
                  <AdminActions
                    id={t.id}
                    actions={[{ label: "처리 완료", kind: "takedown", action: "handle" }]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink/70">검토 대기 UGC · {d.pending.length}건</h2>
        {d.pending.length === 0 ? (
          <p className="text-sm text-ink/40">대기 중인 설문 없음</p>
        ) : (
          <ul className="space-y-3">
            {d.pending.map((s) => (
              <li key={s.id} className="rounded-xl border border-black/5 bg-white p-3 text-sm">
                <div className="font-semibold text-ink">{s.title}</div>
                <div className="text-xs text-ink/40">{s.slug}</div>
                <AdminActions
                  id={s.id}
                  actions={[
                    { label: "승인", kind: "survey", action: "approved" },
                    { label: "보류", kind: "survey", action: "held" },
                    { label: "반려", kind: "survey", action: "rejected", danger: true },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink/70">계측 (K값 추적)</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          {Object.entries(d.events).map(([name, count]) => (
            <div key={name} className="rounded-lg bg-white p-2 text-xs">
              <div className="text-ink/50">{name}</div>
              <div className="font-bold text-ink">{count}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
