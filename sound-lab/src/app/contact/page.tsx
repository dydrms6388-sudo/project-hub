import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의",
  description:
    "소리실험실에 대한 오류 제보, 내용 정정 요청, 제휴 문의를 받는 창구 안내입니다.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <main className="wrap">
      <h1>문의</h1>
      <div className="prose">
        <p>
          소리실험실은 개인이 운영하는 교육 프로젝트입니다. 아래에 해당하는
          내용은 이메일로 보내 주시면 확인 후 회신합니다.
        </p>
        <ul>
          <li>소리가 재생되지 않거나 설명과 다르게 들리는 오류 제보</li>
          <li>해설 내용의 사실관계 정정 요청 (근거 문헌과 함께 보내 주세요)</li>
          <li>교육 목적 활용, 제휴, 기타 문의</li>
        </ul>
        <p>
          이메일: <a href="mailto:dydrms6388@gmail.com">dydrms6388@gmail.com</a>
        </p>
        <p>
          오류 제보 시 사용한 기기·브라우저와 실험 페이지 주소(슬라이더 상태가
          담긴 URL)를 함께 알려 주시면 재현에 큰 도움이 됩니다.
        </p>
      </div>
    </main>
  );
}
