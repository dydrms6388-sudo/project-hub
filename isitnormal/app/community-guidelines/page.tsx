import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "커뮤니티 가이드",
  description: "정상인가요를 함께 쓰기 위한 규칙.",
};

export default function GuidelinesPage() {
  return (
    <article className="space-y-4 text-[15px] leading-relaxed text-ink/80">
      <h1 className="text-2xl font-extrabold text-ink">커뮤니티 가이드</h1>
      <p>
        정상인가요는 서로의 사소한 차이를 판단 없이 확인하는 곳입니다. 아래 규칙은 그 분위기를
        지키기 위한 최소한의 약속입니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">이런 건 괜찮아요</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>내 생활 습관, 취향, 겪은 일에 대한 솔직한 투표와 짧은 의견</li>
        <li>"저희 팀장", "우리 옆집"처럼 개인을 특정할 수 없게 익명화된 이야기</li>
        <li>다른 참여자의 선택을 존중하는 댓글</li>
      </ul>
      <h2 className="pt-2 text-lg font-bold text-ink">이런 건 안 돼요</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>실명·상호·직장·학교·연락처 등 특정 개인을 식별할 수 있는 정보</li>
        <li>전화번호·계좌·주소·차량번호 같은 민감 정보</li>
        <li>광고·홍보·스팸, 외부 판매 유도</li>
        <li>혐오·차별·모욕, 특정인을 겨냥한 비방</li>
        <li>투표 조작, 자동화 대량 투표, 운영자 사칭</li>
      </ul>
      <h2 className="pt-2 text-lg font-bold text-ink">문제가 보이면</h2>
      <p>
        규칙에 어긋나는 콘텐츠를 발견하면 각 게시물의 신고 기능을 이용해 주세요. 본인 또는
        가족이 특정되는 글의 삭제는 삭제 요청 페이지에서 접수하며, 접수 후 48시간 이내에
        처리합니다. 자동 검출 시스템은 개인정보·연락처 패턴을 게시 전에 걸러내고, 새 항목이
        비정상적으로 급증하면 검토를 위해 잠시 보류합니다.
      </p>
    </article>
  );
}
