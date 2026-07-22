import type { Metadata } from "next";
import SimpleForm from "@/components/SimpleForm";

export const metadata: Metadata = {
  title: "신고",
  description: "규칙에 어긋나는 콘텐츠를 신고할 수 있습니다.",
  robots: { index: false, follow: true },
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">신고하기</h1>
      <p className="text-sm leading-relaxed text-ink/60">
        개인정보 노출, 특정인 비방, 광고·스팸, 혐오 표현 등 커뮤니티 가이드에 어긋나는
        설문을 신고해 주세요. 누적 신고가 일정 수를 넘으면 해당 설문은 검토를 위해 자동으로
        숨겨집니다.
      </p>
      <SimpleForm
        endpoint="/api/report"
        submitLabel="신고 접수"
        successMessage="신고가 접수되었어요. 검토 후 필요한 조치를 취합니다. 감사합니다."
        initial={{ slug: slug ?? "" }}
        fields={[
          {
            name: "slug",
            label: "대상 설문",
            placeholder: "설문 주소 끝의 식별자(slug)",
            help: "설문 페이지 주소 /q/ 뒤의 값입니다. 여기서 왔다면 미리 채워져 있어요.",
          },
          {
            name: "reason",
            label: "신고 사유",
            type: "textarea",
            placeholder: "어떤 점이 문제인지 적어주세요",
          },
        ]}
      />
    </div>
  );
}
