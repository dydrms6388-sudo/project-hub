import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "정상인가요 서비스 이용약관.",
};

export default function TermsPage() {
  return (
    <article className="space-y-4 text-[15px] leading-relaxed text-ink/80">
      <h1 className="text-2xl font-extrabold text-ink">이용약관</h1>
      <p>
        본 약관은 정상인가요(이하 "서비스")의 이용 조건을 정합니다. 서비스를 이용하면 아래
        내용에 동의한 것으로 봅니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">1. 서비스의 성격</h2>
      <p>
        서비스는 이용자의 익명 투표와 자발적 응답을 모아 비율로 보여주는 통계 커뮤니티입니다.
        제공되는 수치는 참여자 표본에 기반한 참고용이며, 특정 집단 전체를 대표하지 않습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">2. 이용자 콘텐츠</h2>
      <p>
        이용자가 작성한 콘텐츠의 책임은 작성자에게 있습니다. 서비스는 진위를 보증하지 않으며,
        타인을 식별할 수 있는 정보, 광고·스팸, 혐오·차별, 불법 정보가 포함된 콘텐츠를 사전
        검출 또는 신고에 따라 숨기거나 삭제할 수 있습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">3. 금지 행위</h2>
      <p>
        투표 조작, 자동화된 대량 투표, 타인 사칭, 운영자 사칭, 서비스 운영을 방해하는 행위는
        금지됩니다. 위반 시 이용이 제한될 수 있습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">4. 면책</h2>
      <p>
        서비스가 제공하는 통계와 해설은 정보 제공을 목적으로 하며, 의료·법률·금융 등 전문적
        판단을 대체하지 않습니다. 이용자가 서비스 내용을 근거로 내린 결정의 책임은 이용자에게
        있습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">5. 약관 변경</h2>
      <p>약관이 변경되면 이 페이지에 반영합니다. 변경 후 계속 이용하면 변경에 동의한 것으로 봅니다.</p>
    </article>
  );
}
