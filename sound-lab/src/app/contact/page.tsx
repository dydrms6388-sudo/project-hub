import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의",
  description:
    "소리실험실에 대한 오류 제보, 콘텐츠 제안, 제휴 문의를 받는 방법을 안내합니다.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <main className="wrap doc">
      <h1>문의</h1>
      <p>
        소리실험실에 대한 의견은 아래 이메일로 보내 주세요. 보통 며칠 안에
        확인합니다.
      </p>
      <ul>
        <li>
          이메일:{" "}
          <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>
        </li>
      </ul>
      <h2>이런 제보가 도움이 됩니다</h2>
      <ul>
        <li>특정 기기·브라우저에서 소리가 나지 않거나 끊기는 문제</li>
        <li>설명 내용의 오류(원리·연구사·수치) 지적과 근거 자료</li>
        <li>추가되었으면 하는 청각 현상·합성 원리 제안</li>
      </ul>
      <p>
        문의 시 사용 중인 기기, 운영체제, 브라우저 버전, 이어폰/스피커 여부를
        함께 적어 주시면 재현에 큰 도움이 됩니다.
      </p>
    </main>
  );
}
