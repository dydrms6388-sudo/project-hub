import type { Metadata } from "next";
import { DocPage } from "@/components/app/doc-page";

export const metadata: Metadata = { title: "안전 가이드" };

export default function SafetyPage() {
  return (
    <DocPage title="안전 가이드">
      <section>
        <h2>처음 만날 때</h2>
        <ul>
          <li>사람이 많은 공공장소에서 만나고, 첫 만남 장소와 시간을 믿을 수 있는 친구에게 알려 두세요.</li>
          <li>귀가 수단은 직접 준비하고, 음료·술은 자리를 비운 사이 그대로 두지 마세요.</li>
          <li>불편하면 언제든 자리를 떠도 괜찮아요.</li>
        </ul>
      </section>
      <section>
        <h2>사기·협박 예방</h2>
        <ul>
          <li>선입금, 송금, 상품권, 투자 권유는 거의 항상 사기예요.</li>
          <li>인증번호, 계좌, 신분증, 얼굴이 나온 민감한 사진을 보내지 마세요. 영상통화 녹화 후 협박(몸캠 피싱) 사례가 있어요.</li>
          <li>상대가 아웃팅(성적 지향 공개)을 빌미로 협박하면 대화를 캡처하고 즉시 신고·차단한 뒤 경찰(112)에 도움을 요청하세요.</li>
        </ul>
      </section>
      <section>
        <h2>내 정보 지키기</h2>
        <ul>
          <li>얼굴 사진, 직장, 학교, 동네를 처음부터 다 공개할 필요 없어요. 사진·필드별로 &lsquo;매칭 상대만&rsquo; 또는 비공개를 쓸 수 있어요.</li>
          <li>&lsquo;지금 가능&rsquo; 상태는 정해 둔 시간이 지나면 자동으로 꺼지고, 정확한 위치는 절대 공유되지 않아요.</li>
          <li>잠시 쉬고 싶다면 프로필 숨김을, 떠나고 싶다면 완전 삭제를 이용하세요.</li>
        </ul>
      </section>
      <section>
        <h2>도움 받을 곳</h2>
        <ul>
          <li>긴급 상황: 112 (경찰), 119</li>
          <li>사이버 범죄 신고: 경찰청 사이버범죄 신고시스템 (ecrm.police.go.kr)</li>
          <li>성소수자 상담: 한국레즈비언상담소, 친구사이 등 성소수자 인권단체 상담 창구</li>
        </ul>
      </section>
    </DocPage>
  );
}
