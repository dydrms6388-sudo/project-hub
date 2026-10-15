import type { Metadata } from "next";
import Link from "next/link";
import { categories, sounds } from "@/lib/sounds";

export const metadata: Metadata = {
  title: "소개",
  description:
    "소리실험실은 40가지 청각 현상과 합성 원리를 Web Audio API로 실시간 합성해 직접 조작하며 배우는 무료 교육 사이트입니다.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <main className="wrap doc">
      <h1>소리실험실 소개</h1>
      <p>
        소리실험실은 청각 착각, 심리음향 현상, 공간 지각, 소리 합성 원리를
        브라우저에서 직접 실험하며 배우는 무료 교육 사이트다. 현재{" "}
        {sounds.length}가지 실험을 제공하며, 모든 소리는 Web Audio API로
        재생하는 순간 실시간 합성된다. 녹음된 음원 파일은 하나도 쓰지 않는다.
      </p>
      <h2>무엇이 다른가</h2>
      <ul>
        <li>
          <strong>슬라이더 = 수식의 변수.</strong> 파라미터를 움직이면 합성
          수식의 변수가 즉시 바뀌고, 그 결과가 소리와 파형·스펙트럼 그래프에
          동시에 나타난다. 글로 읽는 대신 손으로 원리를 확인할 수 있다.
        </li>
        <li>
          <strong>공유하면 재현된다.</strong> 조작한 파라미터는 주소(URL)에
          기록되므로, 링크를 공유하면 상대도 같은 설정으로 같은 소리를 듣는다.
        </li>
        <li>
          <strong>귀를 지키는 설계.</strong> 모든 출력은 마스터 리미터를
          거치며, 어떤 파라미터 조합에서도 기준 레벨을 넘지 않도록 상한이
          고정되어 있다. 재생은 항상 사용자가 버튼을 눌러야 시작된다.
        </li>
      </ul>
      <h2>카테고리</h2>
      <ul>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/category/${c.slug}/`}>{c.name}</Link> — {c.desc}
          </li>
        ))}
      </ul>
      <h2>한계에 대한 정직한 안내</h2>
      <p>
        브라우저 합성은 학술 실험 환경의 근사다. 재생 장비의 주파수 응답,
        기기 볼륨, 개인의 청력 차이에 따라 현상이 약하게 들리거나 아예 들리지
        않을 수 있으며, 이는 정상 범위다. 청력 테스트류 체험은 정식 청력
        검사를 대신하지 않는다. 각 실험 페이지에 해당 실험의 근사와 한계를
        명시해 두었다.
      </p>
      <h2>운영</h2>
      <p>
        소리실험실은 tomatoeggcat.com 이 운영하는 실험실 시리즈(착시실험실 등)
        중 하나다. 오류 제보나 제안은 <Link href="/contact/">문의 페이지</Link>
        로 보내 주시면 반영한다.
      </p>
    </main>
  );
}
