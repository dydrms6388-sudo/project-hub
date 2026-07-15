import type { Metadata } from "next";
import SimpleForm from "@/components/SimpleForm";

export const metadata: Metadata = {
  title: "문의",
  description: "정상인가요 운영에 대한 문의를 남겨주세요.",
};

export default function ContactPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">문의하기</h1>
      <p className="text-sm leading-relaxed text-ink/60">
        서비스 이용, 제휴, 오류 제보 등 무엇이든 남겨주세요. 회신이 필요하면 이메일을 함께
        적어주세요. 특정 게시물의 삭제는 아래 삭제 요청 페이지를 이용하면 더 빠릅니다.
      </p>
      <SimpleForm
        endpoint="/api/contact"
        submitLabel="문의 보내기"
        successMessage="문의가 접수되었어요. 회신이 필요한 경우 남겨주신 이메일로 답변드립니다."
        fields={[
          {
            name: "email",
            label: "이메일 (선택)",
            type: "email",
            required: false,
            placeholder: "회신 받을 이메일",
          },
          {
            name: "message",
            label: "내용",
            type: "textarea",
            placeholder: "문의 내용을 적어주세요",
          },
        ]}
      />
    </div>
  );
}
