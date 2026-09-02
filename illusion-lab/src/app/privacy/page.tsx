import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "착시실험실의 개인정보 수집 범위, 쿠키·광고·통계 도구 사용에 관한 방침입니다.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <main className="wrap doc">
      <h1>개인정보처리방침</h1>
      <p>시행일: 2026년 8월 4일</p>
      <h2>1. 수집하는 정보</h2>
      <p>
        착시실험실은 회원가입이 없으며, 이름·전화번호·주민등록번호 등 개인을
        식별하는 정보를 직접 수집하지 않습니다. 체험 중 조작한 슬라이더 값은
        서버로 전송되지 않고 브라우저 안에서만 사용됩니다.
      </p>
      <h2>2. 문의 이메일</h2>
      <p>
        문의를 위해 이메일을 보내시는 경우, 보내신 주소와 내용은 답변 목적으로만
        사용하고 처리 완료 후 파기합니다.
      </p>
      <h2>3. 쿠키와 광고</h2>
      <p>
        본 사이트는 Google AdSense 광고를 게재할 수 있습니다. Google을 포함한
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
      <h2>4. 통계 도구</h2>
      <p>
        방문 통계를 위해 익명화된 트래픽 분석 도구를 사용할 수 있습니다. 이
        도구는 개인을 식별하지 않는 집계 데이터만 제공합니다.
      </p>
      <h2>5. 방침의 변경</h2>
      <p>
        방침이 변경되는 경우 이 페이지에 시행일과 함께 갱신합니다. 문의는{" "}
        <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>으로 보내
        주세요.
      </p>
    </main>
  );
}
