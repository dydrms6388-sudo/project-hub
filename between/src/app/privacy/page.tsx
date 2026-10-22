import type { Metadata } from "next";
import { DocPage } from "@/components/app/doc-page";
import {
  POLICY_VERSION,
  PRIVACY_CONTACT,
  PRIVACY_SUMMARY,
  SENSITIVE_NOTICE,
  SERVICE_OPERATOR,
} from "@/lib/domain/legal";

export const metadata: Metadata = { title: "개인정보 처리방침" };

export default function PrivacyPage() {
  return (
    <DocPage title="개인정보 처리방침" updated={POLICY_VERSION}>
      <p>
        {SERVICE_OPERATOR}(이하 &lsquo;운영자&rsquo;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고, 관련
        고충을 신속히 처리하기 위해 다음과 같이 처리방침을 둡니다.
      </p>
      {PRIVACY_SUMMARY.map((s, i) => (
        <section key={s.title}>
          <h2>
            {i + 1}. {s.title}
          </h2>
          <p>{s.body}</p>
        </section>
      ))}
      <section>
        <h2>5. 민감정보의 처리</h2>
        <p>{SENSITIVE_NOTICE}</p>
        <ul>
          <li>민감정보 처리는 서비스 시작 시 별도 동의를 받으며, 세부 성향 정보는 추가 동의 시에만 저장됩니다.</li>
          <li>세부 성향은 기본 비공개이며 이용자가 직접 공개로 바꾼 경우에만 다른 이용자에게 표시됩니다.</li>
          <li>성향 동의를 철회하면 저장된 성향 정보는 즉시 삭제됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>6. 수집하지 않는 정보</h2>
        <ul>
          <li>
            실명, 전화번호, 주민등록번호, 정확한 GPS 좌표·주소는 수집하지 않습니다. 자기소개에 전화번호·이메일·주민번호
            형태의 문자열은 저장되지 않도록 차단합니다.
          </li>
          <li>업로드한 사진의 EXIF(촬영 위치·기기 정보 등) 메타데이터는 서버에서 제거한 뒤 저장합니다.</li>
          <li>
            접속 상태는 &lsquo;접속 중 / 오늘 / 이번 주&rsquo; 단위로만 표시하며 정확한 접속 시각은 공개하지 않습니다.
          </li>
        </ul>
      </section>
      <section>
        <h2>7. 제3자 제공 및 처리 위탁</h2>
        <p>
          운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 서비스 운영을 위해 다음 업체에 처리를 위탁합니다.
        </p>
        <ul>
          <li>Supabase Inc. — 데이터베이스·인증·파일 저장 (국외 이전: 서비스 리전에 저장)</li>
          <li>Vercel Inc. — 웹 호스팅</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          국외 이전 항목·국가·시기·방법은 실제 배포 리전 확정 후 이 문서에 구체적으로 기재해야 합니다.
        </p>
      </section>
      <section>
        <h2>8. 공개 범위와 외부 연락처</h2>
        <p>
          외부 메신저 연락처는 입력하지 않아도 되며, &lsquo;전체 공개&rsquo; 또는 &lsquo;매칭 상대만&rsquo; 중에서
          선택할 수 있습니다(기본값: 매칭 상대만). 외부 메신저에서의 대화는 각 서비스의 정책을 따르며 운영자가 확인할 수
          없습니다.
        </p>
      </section>
      <section>
        <h2>9. 이용자의 권리</h2>
        <ul>
          <li>내 프로필에서 언제든 정보를 열람·수정할 수 있고, 프로필 숨김과 자동 만료를 설정할 수 있습니다.</li>
          <li>
            &lsquo;계정·개인정보 완전 삭제&rsquo;를 선택하면 프로필, 사진 파일, 연락처, 좋아요·매칭·차단 기록이 즉시
            파기됩니다.
          </li>
          <li>
            다만 다른 이용자가 접수한 신고 및 그에 따른 제재 기록은 부정 이용 방지를 위해 1년간 보관할 수 있습니다.
          </li>
        </ul>
      </section>
      <section>
        <h2>10. 안전성 확보 조치</h2>
        <ul>
          <li>데이터베이스 행 단위 접근 통제(RLS), 최소 권한 원칙, 전송 구간 암호화(HTTPS)</li>
          <li>요청 빈도 제한, 보안 헤더(CSP 등), 사진 재인코딩</li>
          <li>운영자 권한은 익명이 아닌 계정에만 부여되며 모든 조치는 기록됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>11. 개인정보 보호책임자</h2>
        <p>
          문의: <span className="font-mono">{PRIVACY_CONTACT}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          개인정보 침해 신고: 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118),
          개인정보분쟁조정위원회(kopico.go.kr)
        </p>
      </section>
    </DocPage>
  );
}
