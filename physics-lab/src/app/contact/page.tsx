import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의 — 오류 제보와 제안",
  description: "물리실험실에 대한 오류 제보, 실험 제안, 물리·수식 정정 문의 방법을 안내합니다.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <main className="wrap doc">
      <h1>문의</h1>
      <p>물리실험실은 개인이 운영하는 교육용 사이트입니다. 아래 사항은 이메일로 보내 주시면 확인 후 반영합니다.</p>
      <ul>
        <li><strong>오류 제보</strong> — 특정 기기·브라우저에서 시뮬레이션이 이상하게 작동하거나 슬라이더가 동작하지 않으면 사용 환경과 함께 알려 주세요.</li>
        <li><strong>물리·수식 정정</strong> — 지배방정식, 근사 설명, 발견 연도·인물에 오류가 있다면 근거와 함께 제보해 주세요.</li>
        <li><strong>실험 제안</strong> — 추가를 원하는 물리 현상이 있다면 제안해 주세요. 지배방정식을 특정할 수 있는 항목을 우선 검토합니다.</li>
        <li><strong>수치 안정성</strong> — 특정 파라미터에서 시뮬레이션이 부자연스럽게 발산하거나 에너지 드리프트가 크면 알려 주세요.</li>
      </ul>
      <p>이메일: <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a></p>
      <p>회신은 보통 2~3일 안에 드립니다. 문의 메일은 답변 목적 외로 사용하지 않습니다.</p>
    </main>
  );
}
