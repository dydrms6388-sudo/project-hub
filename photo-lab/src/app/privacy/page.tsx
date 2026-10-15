import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "PhotoLab의 개인정보 처리 원칙: 모든 계산은 브라우저에서 수행되며 입력값을 수집·전송하지 않습니다.",
};

export default function PrivacyPage() {
  return (
    <article className="prose">
      <h1>개인정보처리방침</h1>
      <p>
        PhotoLab(이하 &lsquo;사이트&rsquo;)은 정적 웹사이트로, 자체 서버에
        이용자의 개인정보를 수집·저장하지 않습니다.
      </p>
      <h2>1. 계산 입력값</h2>
      <p>
        심도·노출·태양 위치 등 모든 계산은 이용자의 브라우저 안에서 실행됩니다.
        위치 좌표를 포함한 어떤 입력값도 사이트 서버로 전송되지 않습니다. 설정
        공유 기능은 입력값을 URL 쿼리 문자열로 인코딩할 뿐이며, 링크를 공유할지
        여부는 전적으로 이용자가 결정합니다. 쿠키와 로컬 저장소(localStorage)를
        사용하지 않습니다.
      </p>
      <h2>2. 광고 서비스</h2>
      <p>
        사이트는 Google AdSense 광고를 게재할 수 있습니다. Google을 포함한 제3자
        광고 사업자는 쿠키를 사용하여 이용자의 이전 방문 기록에 기반한 광고를
        제공할 수 있습니다. 이용자는{" "}
        <a
          href="https://www.google.com/settings/ads"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google 광고 설정
        </a>
        에서 맞춤 광고를 비활성화할 수 있으며, 광고 쿠키 사용에 대한 자세한
        내용은{" "}
        <a
          href="https://policies.google.com/technologies/ads?hl=ko"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google 광고 정책
        </a>
        에서 확인할 수 있습니다.
      </p>
      <h2>3. 접속 기록</h2>
      <p>
        사이트가 배포된 호스팅 인프라는 서비스 운영을 위한 표준 접속
        로그(익명화된 요청 기록)를 남길 수 있습니다. 사이트 운영자는 이를
        개인 식별 목적으로 사용하지 않습니다.
      </p>
      <h2>4. 문의</h2>
      <p>
        본 방침에 대한 문의는{" "}
        <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>로 보내
        주세요. 본 방침은 서비스 변경 시 갱신될 수 있으며, 변경 시 이 페이지에
        게시합니다.
      </p>
    </article>
  );
}
