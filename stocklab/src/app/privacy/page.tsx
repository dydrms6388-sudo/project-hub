import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "스톡랩 개인정보처리방침 — 수집 항목 최소화(익명 쿠키 sl_uid, 접속 로그 해시), 이용 목적, 보관 기간, 쿠키·AdSense 고지, 국외 이전(Vercel·Supabase), 이용자 권리. 시행일 2026년 9월 2일.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE = "2026년 9월 2일";

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: "/privacy", label: "개인정보처리방침" }]} />
      <article className="prose-kr max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">개인정보처리방침</h1>
        <p className="text-sm text-muted">시행일: {EFFECTIVE} · 운영자: {SITE.parent.name}</p>
        <p>
          {SITE.parent.name}(이하 &ldquo;운영자&rdquo;)은 {SITE.name}(이하 &ldquo;서비스&rdquo;) 이용자의 개인정보를 「개인정보 보호법」 등 관련 법령에 따라 보호하며, 수집을 최소화하는 것을 원칙으로 합니다.
          서비스는 회원가입 없이 이용할 수 있고, 실명·전화번호·주민등록번호·계좌번호 등 <strong>민감정보를 수집하지 않습니다.</strong>
        </p>

        <h2 id="p1">1. 수집하는 항목과 목적</h2>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th scope="col">항목</th><th scope="col">수집 방법</th><th scope="col">목적</th><th scope="col">보관 기간</th></tr></thead>
            <tbody>
              <tr>
                <td>익명 식별자 쿠키 <code>sl_uid</code> (랜덤 UUID)</td>
                <td>스크리너 최초 이용 시 브라우저에 자동 발급</td>
                <td>비로그인 이용자의 기능별 일일 실행 횟수 제한(서버 자원 보호)</td>
                <td>쿠키 1년 · 사용량 기록 7일</td>
              </tr>
              <tr>
                <td>접속 IP 주소 (해시 처리)</td>
                <td>요청 헤더에서 자동 수집 후 즉시 단방향 해시</td>
                <td>일일 실행 제한 키 생성(IP + sl_uid 해시), 비정상 트래픽 차단</td>
                <td>사용량 기록 7일 · 원문 IP 미저장</td>
              </tr>
              <tr>
                <td>접속 로그 (요청 경로·시각·브라우저 종류)</td>
                <td>호스팅(Vercel) 서버 로그</td>
                <td>장애 분석, 보안, 통계</td>
                <td>호스팅 사업자 정책에 따라 최대 30일</td>
              </tr>
              <tr>
                <td>테마 설정 <code>sl-theme</code></td>
                <td>브라우저 localStorage</td>
                <td>다크/라이트 모드 유지 (서버 전송 없음)</td>
                <td>이용자가 삭제할 때까지</td>
              </tr>
              <tr>
                <td>이메일 주소 (예정)</td>
                <td>향후 회원가입 시 이용자 입력</td>
                <td>계정 식별, 로그인, 조건 충족 알림 발송</td>
                <td>탈퇴 시 즉시 삭제 (법정 보존 의무 제외)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          계산기·스크리너에 입력한 값(금액·수익률·필터 조건)은 URL 쿼리 및 브라우저 내에서만 처리되며 서버 데이터베이스에 저장하지 않습니다.
        </p>

        <h2 id="p2">2. 쿠키 및 유사 기술</h2>
        <ul>
          <li><strong>필수 쿠키</strong>: <code>sl_uid</code> — 비로그인 일일 실행 제한을 위한 익명 식별자입니다. 개인을 식별할 수 있는 정보가 담기지 않으며 스크리너 경로에서만 발급됩니다. 차단하면 실행 제한이 IP 단위로만 적용됩니다.</li>
          <li><strong>기능 저장</strong>: <code>sl-theme</code>(localStorage) — 테마 선택을 기억합니다.</li>
          <li><strong>광고 쿠키 (Google AdSense)</strong>: 서비스는 Google AdSense 를 포함한 제3자 광고를 게재할 수 있습니다. 구글을 포함한 제3자 광고 공급업체는 쿠키를 사용하여 이용자가 본 사이트 및 다른 사이트를 방문한 기록을 바탕으로 광고를 게재합니다.
            이용자는 <a href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">구글 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있고, 그 밖의 제3자 공급업체 쿠키는 <a href="https://www.aboutads.info" rel="noopener noreferrer" target="_blank">www.aboutads.info</a> 에서 비활성화할 수 있습니다.
            자세한 내용은 <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer" target="_blank">구글 광고 정책</a>을 참고하세요.</li>
          <li>대부분의 브라우저는 설정에서 쿠키를 차단·삭제할 수 있습니다. 이 경우 일부 기능(제한 카운트, 광고 개인화)이 달라질 수 있습니다.</li>
        </ul>

        <h2 id="p3">3. 개인정보의 처리 위탁 및 국외 이전</h2>
        <p>서비스는 다음 사업자의 인프라를 이용하며, 이 과정에서 접속 정보가 국외 서버에서 처리됩니다.</p>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th scope="col">수탁자</th><th scope="col">이전 국가</th><th scope="col">이전 항목</th><th scope="col">목적</th><th scope="col">보유 기간</th></tr></thead>
            <tbody>
              <tr><td>Vercel Inc.</td><td>미국</td><td>접속 로그, 쿠키 값</td><td>웹 호스팅·CDN·서버 실행</td><td>최대 30일</td></tr>
              <tr><td>Supabase Inc.</td><td>미국(리전 설정에 따름)</td><td>사용량 기록(IP+uid 해시), 향후 회원가입 시 이메일</td><td>데이터베이스 저장</td><td>사용량 7일 · 계정 정보는 탈퇴 시까지</td></tr>
              <tr><td>Google LLC</td><td>미국</td><td>광고 쿠키, 광고 노출 정보</td><td>AdSense 광고 게재</td><td>구글 정책에 따름</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">이전 시점·방법: 서비스 이용 시 네트워크를 통해 실시간 전송. 이용자는 국외 이전을 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다.</p>

        <h2 id="p4">4. 보관 기간 및 파기</h2>
        <ul>
          <li>일일 실행 제한을 위한 사용량 기록(해시 키·횟수·날짜)은 생성일로부터 <strong>7일</strong> 후 자동 삭제됩니다.</li>
          <li>쿠키 <code>sl_uid</code>는 발급 후 1년이 지나면 만료되며, 이용자가 브라우저에서 즉시 삭제할 수 있습니다.</li>
          <li>향후 회원 정보는 탈퇴 요청 시 지체 없이 파기하되, 관련 법령이 보존을 요구하는 경우 해당 기간 동안 분리 보관합니다.</li>
          <li>전자적 파일은 복구할 수 없는 방법으로 삭제합니다.</li>
        </ul>

        <h2 id="p5">5. 제3자 제공</h2>
        <p>운영자는 이용자의 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 법령에 근거한 수사기관의 적법한 요청이 있는 경우는 예외로 합니다.</p>

        <h2 id="p6">6. 이용자의 권리</h2>
        <ul>
          <li>이용자는 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있습니다. 현재 수집 항목이 익명 식별자와 해시값에 한정되어 개인을 특정할 수 없는 경우, 브라우저 쿠키 삭제로 관계가 즉시 끊어집니다.</li>
          <li>회원가입 도입 이후에는 계정 설정 화면 또는 이메일로 권리 행사가 가능하도록 제공합니다.</li>
          <li>요청은 아래 책임자 이메일로 접수하며, 접수 후 10일 이내에 처리 결과를 안내합니다.</li>
        </ul>

        <h2 id="p7">7. 안전성 확보 조치</h2>
        <ul>
          <li>IP 주소는 저장 전 단방향 해시(SHA-256)로 변환하며 원문을 보관하지 않습니다.</li>
          <li>모든 통신은 HTTPS 로 암호화됩니다.</li>
          <li>서버 전용 키(데이터베이스 서비스 키)는 브라우저에 노출되지 않도록 환경 변수로만 관리합니다.</li>
        </ul>

        <h2 id="p8">8. 아동의 개인정보</h2>
        <p>서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 의도적으로 수집하지 않습니다.</p>

        <h2 id="p9">9. 개인정보 보호책임자</h2>
        <ul>
          <li>책임자: {SITE.parent.name} 운영자</li>
          <li>이메일: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></li>
        </ul>
        <p className="text-sm text-muted">
          개인정보 침해에 대한 신고·상담은 개인정보침해신고센터(privacy.kisa.or.kr, 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972)에서도 가능합니다.
        </p>

        <h2 id="p10">10. 방침의 변경</h2>
        <p>본 방침의 내용 추가·삭제·수정이 있을 경우 시행 7일 전부터 서비스 내 공지합니다. 본 방침은 {EFFECTIVE}부터 시행합니다.</p>
        <p className="text-sm text-muted">관련 문서: <Link href="/terms">이용약관</Link> · <Link href="/disclaimer">면책 고지</Link></p>
      </article>
    </div>
  );
}
