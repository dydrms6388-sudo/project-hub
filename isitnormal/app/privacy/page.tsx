import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "정상인가요가 수집하는 정보와 처리 방식 안내.",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-4 text-[15px] leading-relaxed text-ink/80">
      <h1 className="text-2xl font-extrabold text-ink">개인정보 처리방침</h1>
      <p>
        정상인가요는 회원가입이나 실명 입력 없이 이용할 수 있습니다. 서비스는 개인을
        식별할 수 있는 정보를 요구하지 않으며, 최소한의 비식별 데이터만 다룹니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">수집하는 정보</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>투표 중복 방지를 위한 익명 세션 식별자(쿠키)와 브라우저 특성의 해시값</li>
        <li>접속 IP는 원문 그대로 저장하지 않고, 재접속·어뷰징 방지를 위해 해시로만 보관</li>
        <li>선택 입력 시 연령대·성별·지역 같은 식별 불가한 범위 값(교차 통계용, 미입력이 기본)</li>
        <li>서비스 개선을 위한 익명 이벤트 로그(페이지 조회·투표·공유 등)</li>
      </ul>
      <h2 className="pt-2 text-lg font-bold text-ink">수집하지 않는 정보</h2>
      <p>
        이름, 전화번호, 계좌, 주소, 이메일(알림을 직접 신청한 경우 제외) 등 개인을 특정할
        수 있는 정보는 수집하지 않습니다. 이용자가 작성한 글에 이런 정보가 포함되면
        게시 전 자동 검출·마스킹하거나 반려합니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">쿠키</h2>
      <p>
        투표 중복 방지를 위한 익명 세션 쿠키를 사용합니다. 브라우저 설정에서 삭제할 수
        있으며, 삭제 시 이전 투표 기록과의 연결이 끊길 수 있습니다.
      </p>
      <h2 className="pt-2 text-lg font-bold text-ink">문의</h2>
      <p>
        개인정보 관련 요청은 문의 페이지를 통해 접수할 수 있습니다. 특정 게시물 삭제는
        삭제 요청 페이지에서 접수하며, 접수 후 48시간 이내에 처리 결과를 안내합니다.
      </p>
    </article>
  );
}
