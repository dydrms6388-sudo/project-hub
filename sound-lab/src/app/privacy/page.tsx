import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "소리실험실의 개인정보 수집·이용, 쿠키, 광고, 로컬 저장소 사용에 대한 방침입니다.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <main className="wrap doc">
      <h1>개인정보처리방침</h1>
      <p>시행일: 2026년 8월 8일</p>

      <h2>1. 수집하는 정보</h2>
      <p>
        소리실험실은 회원가입이 없으며 이름, 전화번호, 이메일 등 개인을
        식별할 수 있는 정보를 서버에 수집·저장하지 않는다. 실험 파라미터는
        주소(URL)와 브라우저 안에서만 처리된다.
      </p>

      <h2>2. 로컬 저장소</h2>
      <p>
        볼륨 주의 안내를 반복해서 띄우지 않기 위한 확인 여부 한 가지를
        브라우저 로컬 저장소(localStorage)에 저장한다. 이 값은 서버로 전송되지
        않으며, 브라우저 데이터 삭제로 언제든 지울 수 있다.
      </p>

      <h2>3. 쿠키와 광고</h2>
      <p>
        사이트에 광고가 게재되는 경우 Google 등 제3자 광고 사업자가 쿠키를
        사용해 이용자의 이전 방문 기록에 기반한 광고를 제공할 수 있다.
        이용자는{" "}
        <a
          href="https://adssettings.google.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Google 광고 설정
        </a>
        에서 맞춤 광고를 해제할 수 있다. 광고 쿠키의 수집·처리는 해당
        사업자의 개인정보처리방침을 따른다.
      </p>

      <h2>4. 통계</h2>
      <p>
        서비스 개선을 위해 페이지 조회 수준의 비식별 통계를 사용할 수 있다.
        이 데이터는 개인을 식별하는 데 사용되지 않는다.
      </p>

      <h2>5. 문의</h2>
      <p>
        개인정보 관련 문의는 dydrms6388@gmail.com 으로 연락하면 된다. 본
        방침이 변경되는 경우 이 페이지에 갱신 날짜와 함께 공지한다.
      </p>
    </main>
  );
}
