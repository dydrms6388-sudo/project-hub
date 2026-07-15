import type { Metadata } from "next";
import Link from "next/link";
import UgcForm from "@/components/UgcForm";
import { UGC_ENABLED } from "@/site.config";

export const metadata: Metadata = {
  title: "내 설문 만들기",
  description: "궁금한 '우리집만 이래?'를 직접 설문으로 올려보세요.",
  robots: { index: false, follow: true },
};

export default function SubmitPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">내 설문 만들기</h1>

      {UGC_ENABLED ? (
        <>
          <p className="text-sm leading-relaxed text-ink/60">
            투표 1탭이 익숙해졌다면, 이제 직접 물어볼 차례예요. 올린 설문은 검토를 거쳐
            공개되고, 30명이 넘게 참여하면 통계가 열립니다.
          </p>
          <UgcForm />
        </>
      ) : (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-center">
          <p className="text-3xl">🚧</p>
          <p className="mt-3 text-base font-bold text-ink">설문 만들기는 곧 열려요</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            지금은 준비된 설문에 투표하며 통계를 채우는 단계예요. 참여가 어느 정도 쌓이면
            직접 설문을 만드는 기능을 엽니다. 먼저 마음에 드는 주제에 한 표 던져볼래요?
          </p>
          <Link
            href="/#categories"
            className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            카테고리 둘러보기
          </Link>
        </div>
      )}
    </div>
  );
}
