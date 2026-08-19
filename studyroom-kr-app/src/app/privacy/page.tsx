import type { Metadata } from "next";
import { site } from "@/site.config";
export const metadata: Metadata = { title: "개인정보처리방침", robots: { index: false } };

export default function Privacy() {
  return (
    <article className="prose-custom mx-auto max-w-3xl px-4 py-10">
      <h1>개인정보처리방침</h1>
      <p>{site.name}(이하 "사이트")는 이용자의 개인정보를 소중히 다루며, 다음과 같이 처리합니다.</p>
      <h2>1. 수집하는 개인정보</h2>
      <p>사이트는 회원가입을 받지 않으며 이름, 이메일, 연락처 등 개인을 식별할 수 있는 정보를 수집하지 않습니다. 도구에 입력하거나 업로드한 파일·텍스트는 이용자의 브라우저 안에서만 처리되며 사이트 서버로 전송·저장되지 않습니다. 일부 도구는 편의를 위해 브라우저의 로컬 저장소(localStorage)에 마지막 입력을 저장할 수 있으며, 이는 이용자의 기기에만 남고 언제든 삭제할 수 있습니다.</p>
      <h2>2. 쿠키 및 광고</h2>
      <p>사이트는 Google AdSense 등 제3자 광고 서비스를 사용할 수 있습니다. 광고 제공업체는 쿠키를 사용하여 이용자의 방문 기록을 바탕으로 광고를 게재할 수 있습니다. 이용자는 <a href="https://www.google.com/settings/ads" rel="noopener noreferrer" target="_blank">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다.</p>
      <h2>3. 방문 통계</h2>
      <p>사이트는 방문자 수와 사용 현황을 파악하기 위해 익명화된 통계 도구(예: Vercel Analytics)를 사용할 수 있습니다. 이 과정에서 개인을 식별할 수 있는 정보는 수집하지 않습니다.</p>
      <h2>4. 문의</h2>
      <p>개인정보 관련 문의는 <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>로 보내주세요.</p>
      <p className="text-sm text-muted">시행일: 2026년 1월 1일</p>
    </article>
  );
}
