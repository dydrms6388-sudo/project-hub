import type { Metadata } from "next";
import { approveAction, rejectAction } from "../actions";
import { ugc } from "../ugc";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리 대시보드",
  robots: { index: false, follow: false }, // 관리 화면은 항상 noindex
};

// 데모용 대시보드 — 인증 없음. 실서비스 통합 시 관리자 인증 뒤에 배치할 것.
export default async function AdminPage() {
  const snap = await ugc.loadDashboard();

  return (
    <>
      <section className="intro">
        <h1>관리 대시보드</h1>
        <p>검수 대기 큐 · 신고 큐 · 일별 통계 · 차단 사유 Top — <code>loadDashboard()</code> 한 번으로 로드.</p>
      </section>

      <section className="card">
        <h2>검수 대기 ({snap.moderationQueue.length})</h2>
        {snap.moderationQueue.length === 0 ? (
          <p className="muted">대기 중인 항목이 없습니다.</p>
        ) : (
          <ul className="list">
            {snap.moderationQueue.map((q) => (
              <li key={q.submissionId} className="queue-item">
                <div className="queue-main">
                  <span className="excerpt">{q.excerpt}</span>
                  <span className="badge">score {q.qualityScore}</span>
                  {q.categories.map((c) => (
                    <span key={c} className="badge badge-warn">{c}</span>
                  ))}
                </div>
                <div className="queue-actions">
                  <form action={approveAction}>
                    <input type="hidden" name="submissionId" value={q.submissionId} />
                    <button type="submit" className="btn-approve">승인</button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="submissionId" value={q.submissionId} />
                    <button type="submit" className="btn-reject">반려</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>신고 큐 ({snap.reportQueue.length})</h2>
        {snap.reportQueue.length === 0 ? (
          <p className="muted">신고된 콘텐츠가 없습니다.</p>
        ) : (
          <ul className="list">
            {snap.reportQueue.map((r) => (
              <li key={r.contentId}>
                <a href={`/case/${r.slug}`}>{r.slug}</a>
                <span className="muted">{r.reason}</span>
                <span className="badge">신고 {r.totalReports}</span>
                <span className={`badge ${r.status === "hidden" ? "badge-warn" : ""}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>일별 통계</h2>
        {snap.dailyStats.length === 0 ? (
          <p className="muted">데이터 없음.</p>
        ) : (
          <table className="stats">
            <thead>
              <tr><th>날짜</th><th>제출</th><th>공개</th><th>차단</th><th>대기</th></tr>
            </thead>
            <tbody>
              {snap.dailyStats.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.submitted}</td>
                  <td>{d.published}</td>
                  <td>{d.blocked}</td>
                  <td>{d.queued}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>차단 사유 Top {snap.topSpamPatterns.length}</h2>
        {snap.topSpamPatterns.length === 0 ? (
          <p className="muted">차단 이력이 없습니다.</p>
        ) : (
          <ul className="list">
            {snap.topSpamPatterns.map((s) => (
              <li key={s.pattern}>
                <span>{s.pattern}</span>
                <span className="badge">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
