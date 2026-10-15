import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의",
  description:
    "PhotoLab 계산 오류 제보, 새 계산기 제안, 기타 문의를 받는 채널 안내입니다.",
};

export default function ContactPage() {
  return (
    <article className="prose">
      <h1>문의</h1>
      <p>
        계산 결과가 알려진 값과 다르거나, 공식·출처 표기에 오류가 있거나, 추가로
        다뤘으면 하는 계산이 있다면 아래 주소로 보내 주세요.
      </p>
      <p>
        <strong>이메일:</strong>{" "}
        <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>
      </p>
      <h2>오류 제보 시 함께 적어주시면 좋은 것</h2>
      <p>
        문제가 된 계산기의 <strong>설정 링크</strong>(각 계산기의 &lsquo;설정
        링크 복사&rsquo; 버튼으로 생성)와, 비교 대상이 된 기준값의 출처를 함께
        보내주시면 재현과 검증이 빨라집니다. 입력값이 URL에 전부 담기므로 링크
        하나로 상황이 그대로 재현됩니다.
      </p>
      <p>
        제보된 오류는 검증 케이스로 추가되어 같은 문제가 재발하지 않도록
        관리됩니다.
      </p>
    </article>
  );
}
