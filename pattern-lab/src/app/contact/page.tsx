import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의 — 오류 제보와 제안",
  description: "패턴연구소에 대한 오류 제보, 패턴 제안, 수식 정정 문의 방법을 안내합니다.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <main className="wrap doc">
      <h1>문의</h1>
      <p>
        패턴연구소는 개인이 운영하는 교육용 사이트입니다. 아래 사항은 이메일로
        보내 주시면 확인 후 반영합니다.
      </p>
      <ul>
        <li>
          <strong>오류 제보</strong> — 특정 기기·브라우저에서 패턴이 잘못
          그려지거나 슬라이더가 동작하지 않는 경우, 사용 환경과 함께 알려 주세요.
        </li>
        <li>
          <strong>수식 정정</strong> — 수식이나 발견 연도·인물에 오류가 있다면
          근거와 함께 제보해 주세요. 확인 후 바로잡습니다.
        </li>
        <li>
          <strong>패턴 제안</strong> — 추가를 원하는 수학 패턴이 있다면
          제안해 주세요. 지배 수식을 특정할 수 있는 항목을 우선 검토합니다.
        </li>
        <li>
          <strong>성능 제보</strong> — 특정 패턴이 유난히 느리거나 프레임이
          끊긴다면 기기 정보와 함께 알려 주세요.
        </li>
      </ul>
      <p>
        이메일: <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>
      </p>
      <p>회신은 보통 2~3일 안에 드립니다. 문의 메일은 답변 목적 외로 사용하지 않습니다.</p>
    </main>
  );
}
