import type { Metadata } from "next";
import { site } from "@/site.config";
export const metadata: Metadata = { title: "이용약관", robots: { index: false } };

export default function Terms() {
  return (
    <article className="prose-custom mx-auto max-w-3xl px-4 py-10">
      <h1>이용약관</h1>
      <h2>1. 서비스</h2>
      <p>{site.name}는 브라우저에서 동작하는 무료 도구를 제공합니다. 별도 가입 없이 누구나 이용할 수 있습니다.</p>
      <h2>2. 책임의 한계</h2>
      <p>도구의 계산 결과와 변환 결과는 참고용입니다. 법률·세무·의료·금융 등 전문 판단이 필요한 사안은 반드시 해당 분야 전문가나 공식 기관의 안내를 확인하세요. 사이트는 결과의 정확성이나 특정 목적에의 적합성을 보증하지 않으며, 이용으로 인해 발생한 손해에 대해 책임을 지지 않습니다.</p>
      <h2>3. 이용자의 의무</h2>
      <p>이용자는 타인의 권리를 침해하거나 법령을 위반하는 목적으로 도구를 사용해서는 안 됩니다. 업로드한 파일에 대한 권리와 책임은 이용자에게 있습니다.</p>
      <h2>4. 광고</h2>
      <p>사이트는 운영을 위해 광고를 게재할 수 있습니다. 광고 내용은 광고주의 책임이며 사이트가 보증하지 않습니다.</p>
      <h2>5. 변경</h2>
      <p>본 약관은 사전 고지 후 변경될 수 있으며, 변경된 약관은 사이트에 게시한 시점부터 효력이 있습니다.</p>
      <p className="text-sm text-muted">시행일: 2026년 1월 1일</p>
    </article>
  );
}
