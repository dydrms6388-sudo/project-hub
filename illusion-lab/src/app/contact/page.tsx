import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의 — 오류 제보와 제안",
  description:
    "착시실험실에 대한 오류 제보, 항목 제안, 저작권 관련 문의 방법을 안내합니다.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <main className="wrap doc">
      <h1>문의</h1>
      <p>
        착시실험실은 개인이 운영하는 교육 사이트입니다. 아래 사항은 이메일로
        보내 주시면 확인 후 반영합니다.
      </p>
      <ul>
        <li>
          <strong>오류 제보</strong> — 특정 기기·브라우저에서 도형이 잘못
          그려지거나 슬라이더가 동작하지 않는 경우, 사용 환경(기기, 브라우저,
          화면 크기)과 함께 알려 주세요.
        </li>
        <li>
          <strong>내용 정정</strong> — 발견자·연도·기제 설명에 오류가 있다면
          근거 문헌과 함께 제보해 주세요. 확인 후 바로잡습니다.
        </li>
        <li>
          <strong>항목 제안</strong> — 추가를 원하는 고전 착시가 있다면
          제안해 주세요. 저작권 기준(생존 작가 창작물 제외)을 통과하는 항목만
          수록됩니다.
        </li>
        <li>
          <strong>저작권 문의</strong> — 수록 도형의 권리에 대한 문의는 해당
          페이지 주소와 함께 보내 주시면 우선 처리합니다.
        </li>
      </ul>
      <p>
        이메일: <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>
      </p>
      <p>
        회신은 보통 2~3일 안에 드립니다. 문의 메일은 답변 목적 외로 사용하지
        않으며, 처리 후 파기합니다.
      </p>
    </main>
  );
}
