import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "소리실험실의 개인정보 수집·이용에 관한 방침입니다. 회원가입과 개인정보 입력이 없는 정적 사이트입니다.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <main className="wrap">
      <h1>개인정보처리방침</h1>
      <div className="prose">
        <p>
          소리실험실(이하 “사이트”)은 회원가입, 댓글, 폼 입력 등 이용자가
          개인정보를 직접 입력하는 기능을 제공하지 않으며, 실명·연락처·이메일 등
          개인정보를 수집하지 않습니다. 모든 소리 합성은 이용자의 브라우저 안에서
          이루어지고 슬라이더 조작 값은 서버로 전송되지 않습니다.
        </p>
        <h2>1. 로컬 저장소</h2>
        <p>
          볼륨 주의 안내를 반복해서 띄우지 않기 위해 브라우저 localStorage에 안내
          확인 여부 1개 값을 저장합니다. 이 값은 이용자의 기기에만 저장되며
          브라우저 데이터 삭제로 언제든 지울 수 있습니다.
        </p>
        <h2>2. 쿠키 및 광고</h2>
        <p>
          사이트는 Google AdSense 광고를 게재할 수 있습니다. Google을 포함한
          제3자 광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록에 기반한
          광고를 표시할 수 있습니다. 이용자는{" "}
          <a
            href="https://www.google.com/settings/ads"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google 광고 설정
          </a>
          에서 맞춤 광고를 해제할 수 있습니다.
        </p>
        <h2>3. 통계</h2>
        <p>
          방문 통계 파악을 위해 익명화된 트래픽 측정 도구를 사용할 수 있습니다.
          이 과정에서 특정 개인을 식별할 수 있는 정보는 수집하지 않습니다.
        </p>
        <h2>4. 문의</h2>
        <p>
          본 방침에 대한 문의는{" "}
          <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a> 로 보내
          주세요. 방침이 변경되면 이 페이지에 게시합니다.
        </p>
        <p>시행일: 2026년 8월 8일</p>
      </div>
    </main>
  );
}
