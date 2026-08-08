import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의",
  description:
    "색채 실험실에 대한 오류 제보, 제안, 기타 문의 방법을 안내합니다.",
};

export default function ContactPage() {
  return (
    <main>
      <h1>문의</h1>
      <p>
        색채 실험실에 대한 의견은 이메일로 받고 있습니다. 아래와 같은 내용이라면
        특히 환영합니다.
      </p>
      <ul>
        <li>계산 결과나 색 정보의 오류 제보</li>
        <li>추가되면 좋을 색상·도구 제안</li>
        <li>콘텐츠 인용·사용에 대한 문의</li>
      </ul>
      <p>
        <a href="mailto:dydrms6388@gmail.com" className="btn" style={{ textDecoration: "none" }}>
          ✉️ dydrms6388@gmail.com
        </a>
      </p>
      <p className="muted">
        이 사이트는 문의 폼을 두지 않습니다. 서버가 없는 정적 사이트로 운영되며
        방문자의 개인정보를 수집하지 않기 때문입니다. 이메일로 보내 주신 내용은
        답변 목적으로만 사용합니다.
      </p>
    </main>
  );
}
