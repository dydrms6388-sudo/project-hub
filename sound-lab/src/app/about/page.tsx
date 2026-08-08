import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, categories, sounds } from "@/lib/sounds";

export const metadata: Metadata = {
  title: "소개",
  description:
    "소리실험실은 착청·심리음향·합성 원리를 브라우저에서 직접 조작하며 배우는 무료 교육 사이트입니다. 모든 소리는 Web Audio API로 실시간 합성됩니다.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <main className="wrap">
      <h1>{SITE_NAME} 소개</h1>
      <div className="prose">
        <p>
          소리실험실은 소리 지각과 합성의 원리 {sounds.length}가지를 직접
          조작하며 배우는 무료 웹 실험실입니다. 교과서의 그림과 수식으로만 접하던
          맥놀이, 마스킹, 셰퍼드 음계, FM 합성 같은 현상을 슬라이더로 움직여 보고
          파형과 스펙트럼의 변화를 눈과 귀로 동시에 확인할 수 있습니다.
        </p>
        <h2>운영 원칙</h2>
        <p>
          모든 소리는 음원 파일 없이 Web Audio API로 브라우저 안에서 실시간
          합성됩니다. 서버로 전송되는 데이터가 없고, 회원가입도 필요하지 않습니다.
          모든 출력 경로에는 리미터가 걸려 있으며, 청력에 부담을 줄 수 있는
          항목에는 별도 경고를 표시합니다. 그럼에도 최종 볼륨은 기기 설정을
          따르므로 항상 낮은 볼륨에서 시작하기를 권합니다.
        </p>
        <h2>설명의 한계</h2>
        <p>
          각 실험의 해설은 확립된 심리음향학 연구를 바탕으로 작성했지만, 지각
          결과에는 개인차가 있고 스피커·이어폰 등 재생 장비의 특성에 따라 체험이
          달라질 수 있습니다. 본 사이트의 어떤 내용도 청력 검사나 의학적 진단을
          대신하지 않습니다. 청력에 이상이 의심되면 이비인후과 전문의와
          상담하세요.
        </p>
        <h2>카테고리</h2>
        <ul>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}/`}>{c.label}</Link> —{" "}
              {c.description}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
