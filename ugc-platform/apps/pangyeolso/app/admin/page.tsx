import type { Metadata } from "next";
import { approveAction, rejectAction } from "../actions";
import { ugc } from "../ugc";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리",
  robots: { index: false, follow: false },
};

// 데모 단계라 무인증. 실배포 전 반드시 관리자 인증 미들웨어 뒤에 배치할 것.
export default async function AdminPage() {
  const snap = await ugc.loadDashboard();

  return (
    <>
      <section className="intro">
        <h1>판결소 관리</h1>
        <p>검수 대기 · 신고 · 통계</p>
      </section>

      <section className="card">
        <h2>검수 대기 ({snap.moderationQueue.length})</h2>
        {snap.moderationQueue.length === 0 ? (
          <p className="muted">대기 중인 사연이 없습니다.</p>
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
                    <button type="submit" className="btn-approve">공개 승인</button>
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
          <p className="muted">신고된 사건이 없습니다.</p>
        ) : (
          <ul className="list">
            {snap.reportQueue.map((r) => (
              <li key={r.contentId}>
                <a href={`/case/${r.slug}`}>{r.slug}</a>
                <span className="muted">{r.reason}</span>
                <span className="badge">신고 {r.totalReports}</span>
                <span className={`badge ${r.status === "hidden" ? "badge-warn" : ""}`}>
                  {r.status}
                </span>
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
    </>
  );
}
