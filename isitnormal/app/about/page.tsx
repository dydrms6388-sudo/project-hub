import type { Metadata } from "next";
import { SITE_NAME } from "@/site.config";

export const metadata: Metadata = {
  title: "소개",
  description: "정상인가요는 '우리집만 이래?'를 익명 투표로 확인하는 통계 커뮤니티입니다.",
};

export default function AboutPage() {
  return (
    <article className="space-y-4 text-[15px] leading-relaxed text-ink/80">
      <h1 className="text-2xl font-extrabold text-ink">{SITE_NAME} 소개</h1>
      <p>
        {SITE_NAME}는 "이거 우리집만 이래?" 싶은 사소한 궁금증을 익명 투표로 확인하는
        통계 커뮤니티입니다. 로그인 없이 한 표를 던지면, 내가 다수 쪽인지 소수파인지가
        그 자리에서 비율로 나옵니다.
      </p>
      <p>
        수건을 며칠 쓰는지, 라면에 계란을 넣는지, 잘 때 양말을 신는지처럼 밖에서는 좀처럼
        물어보지 않는 생활 습관을 12개 카테고리로 나눠 다룹니다. 각 설문은 왜 사람마다
        갈리는지 짧은 편집자 해설을 함께 붙여, 숫자만 던지고 끝내지 않습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">어떻게 운영되나요</h2>
      <p>
        초기 설문은 운영자가 직접 작성했으며 <b>@운영자</b> 배지로 표시됩니다. 이용자가
        직접 설문을 만드는 기능은 투표 참여가 어느 정도 쌓인 뒤 순차적으로 엽니다. 통계는
        오직 실제 투표를 실시간 집계한 값이며, 표본이 30명에 못 미치면 비율 대신 "집계
        중"으로 표시합니다. 지어낸 숫자는 쓰지 않습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">무엇을 하지 않나요</h2>
      <p>
        여기서는 옳고 그름을 판정하지 않습니다. 어떤 습관이 정상이라거나 비정상이라고
        말하지 않고, 의료·법률·투자 같은 전문적 판단도 제공하지 않습니다. 그저 "몇
        퍼센트인지"를 함께 확인할 뿐입니다.
      </p>
    </article>
  );
}
