import type { Metadata } from "next";
import SimpleForm from "@/components/SimpleForm";

export const metadata: Metadata = {
  title: "삭제 요청",
  description: "본인 또는 가족이 특정되는 콘텐츠의 삭제를 요청할 수 있습니다. 48시간 이내 처리.",
  robots: { index: false, follow: true },
};

export default function TakedownPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">삭제 요청</h1>
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-ink/80">
        접수된 삭제 요청은 <b>48시간 이내</b>에 검토·처리하고 결과를 회신처로 안내합니다.
        긴급하거나 명예훼손·개인정보 노출이 우려되는 경우 해당 사유를 함께 적어주세요.
      </div>
      <SimpleForm
        endpoint="/api/takedown"
        submitLabel="삭제 요청 접수"
        successMessage="삭제 요청이 접수되었어요. 48시간 이내에 검토 결과를 회신처로 알려드립니다."
        fields={[
          {
            name: "targetRef",
            label: "대상",
            type: "textarea",
            placeholder: "삭제를 원하는 페이지 주소(URL)나 내용을 적어주세요",
            help: "예: 설문 주소, 또는 어떤 글의 어느 부분인지 설명",
          },
          {
            name: "contact",
            label: "회신처",
            placeholder: "결과를 받을 이메일 또는 연락 수단",
          },
          {
            name: "reason",
            label: "사유",
            type: "textarea",
            placeholder: "삭제가 필요한 이유 (본인 특정, 개인정보 노출 등)",
          },
        ]}
      />
    </div>
  );
}
