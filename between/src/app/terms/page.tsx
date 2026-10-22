import type { Metadata } from "next";
import { DocPage } from "@/components/app/doc-page";
import { POLICY_VERSION } from "@/lib/domain/legal";

export const metadata: Metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <DocPage title="이용약관" updated={POLICY_VERSION}>
      <section>
        <h2>1. 이용 자격</h2>
        <p>
          BETWEEN 은 성인(청소년보호법상 청소년이 아닌 사람)만 이용할 수 있습니다. 현재의 성인 확인은 자기 신고 방식이며
          본인 확인 절차가 아닙니다. 허위로 확인한 사실이 확인되면 이용이 제한됩니다.
        </p>
      </section>
      <section>
        <h2>2. 금지 행위</h2>
        <ul>
          <li>미성년자의 이용 또는 미성년자와의 만남 시도</li>
          <li>타인 사진 도용, 사칭, 허위 프로필</li>
          <li>성매매·금전 거래 제안, 사기, 송금 요구</li>
          <li>음란물·노출 사진 게시, 괴롭힘, 혐오 표현, 아웃팅(동의 없는 성적 지향 공개) 및 그 위협</li>
          <li>광고·스팸, 자동화 도구를 이용한 대량 좋아요·수집</li>
        </ul>
      </section>
      <section>
        <h2>3. 운영 조치</h2>
        <p>
          신고가 접수되면 운영팀이 검토하여 경고, 프로필 숨김, 기간 정지, 영구 이용제한 조치를 할 수 있습니다. 여러
          이용자의 신고가 누적되면 검토 전 일시적으로 노출이 중지될 수 있습니다.
        </p>
      </section>
      <section>
        <h2>4. 익명 계정</h2>
        <p>
          서비스는 가입 없이 익명 세션으로 제공됩니다. 브라우저 데이터 삭제·기기 변경 등으로 세션을 잃으면 복구
          수단(복구 코드 또는 이메일 연결)을 설정하지 않은 경우 계정을 되찾을 수 없습니다.
        </p>
      </section>
      <section>
        <h2>5. 외부 서비스</h2>
        <p>
          외부 메신저(카카오톡 오픈채팅, LINE, Instagram, Telegram 등)로 이어지는 대화와 만남은 이용자 간의 책임이며,
          운영자는 외부 서비스 내 활동을 확인하거나 보장하지 않습니다.
        </p>
      </section>
    </DocPage>
  );
}
