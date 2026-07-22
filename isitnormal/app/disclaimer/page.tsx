import type { Metadata } from "next";
import { UGC_DISCLAIMER } from "@/site.config";

export const metadata: Metadata = {
  title: "면책 고지",
  description: "정상인가요의 통계와 콘텐츠에 대한 면책 고지.",
};

export default function DisclaimerPage() {
  return (
    <article className="space-y-4 text-[15px] leading-relaxed text-ink/80">
      <h1 className="text-2xl font-extrabold text-ink">면책 고지</h1>
      <p>{UGC_DISCLAIMER}</p>
      <p>
        서비스에 표시되는 모든 비율과 수치는 자발적으로 참여한 이용자 표본을 실시간 집계한
        값입니다. 무작위 표본이 아니므로 특정 지역·연령·집단 전체를 대표한다고 보기 어렵고,
        참여가 쌓이면서 값이 달라질 수 있습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">전문 조언이 아닙니다</h2>
      <p>
        수면·신체 반응·성격 관련 설문을 포함해 서비스의 어떤 내용도 의학적 진단이나 치료,
        심리 상담, 법률·금융 자문을 대체하지 않습니다. 건강이나 심리에 지속적인 불편이 있다면
        해당 분야 전문가와 상의하시기 바랍니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">이용자 콘텐츠</h2>
      <p>
        이용자가 작성한 사연과 의견은 작성자 개인의 표현이며, 운영자가 사실 여부를 검증하거나
        보증하지 않습니다. 문제가 있는 콘텐츠는 신고 또는 삭제 요청을 통해 조치할 수 있습니다.
      </p>
    </article>
  );
}
