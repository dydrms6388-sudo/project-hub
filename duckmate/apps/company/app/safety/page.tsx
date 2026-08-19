import type { Metadata } from "next";
import { Badge, BRAND_NAME, Card } from "@duckmate/ui";
import { COMPANY_URL, WEB_URL, webUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "안전과 신뢰",
  description: `${BRAND_NAME}의 4단계 인증 절차, 신고 24시간 처리 약속, 데이터 처리 원칙을 안내합니다.`,
  alternates: { canonical: `${COMPANY_URL}/safety` },
};

/** 인증 4단계 — 카피 원본: 13_company_site.md §2.2 (05_trust_safety 대외 순화본) */
const LEVELS = [
  {
    step: "가입",
    what: "이메일 가입 + 성인 여부 확인",
    can: "내 프로필 만들기까지만. 다른 회원에게 노출되지 않습니다",
  },
  {
    step: "휴대폰 인증",
    what: "휴대폰 번호 1개당 계정 1개",
    can: "둘러보기와 제한된 호감 표시",
  },
  {
    step: "본인인증",
    what: "통신사 본인인증으로 성인 여부·본인 여부 재확인, 1인 1계정",
    can: "매칭·채팅·사진 전송 등 정식 이용",
  },
  {
    step: "사진 인증",
    what: "프로필 사진 검수(도용·AI 생성 여부 확인)",
    can: "인증 뱃지 표시, 모임 호스팅",
  },
];

const REPORT_RULES = [
  "신고가 접수되면 즉시 접수 알림을 드리고, 24시간 이내에 처리 결과를 알려드립니다.",
  "성범죄·사기·미성년자 의심 등 긴급 신고는 1시간 이내에 임시 조치(해당 상대의 발신 정지 등)가 이뤄집니다.",
  "신고자가 누구인지 상대에게 알리지 않으며, 신고 즉시 해당 상대는 화면에서 숨겨지고 원클릭으로 차단할 수 있습니다.",
  "심각한 위반은 영구 이용 정지되며, 재가입이 차단됩니다. 제재에 대해서는 이의제기 절차를 운영합니다.",
  "금전 요구, 외부 링크 유도, 조기 연락처 요구 같은 이상 패턴은 시스템이 자동으로 감지해 상대방에게 안전 안내를 표시합니다.",
];

const DATA_RULES = [
  "채팅은 상시 열람·수집하지 않습니다. 신고가 접수된 대화만, 처리에 필요한 범위로 한정해 보존하고, 분쟁이 끝나면 정해진 기한 후 파기합니다.",
  "주민등록번호 등 신원 원문 정보는 저장하지 않습니다. 본인인증 결과는 중복 가입 차단에 필요한 암호화된 값만 보관합니다.",
  "실시간 위치를 수집하지 않습니다. 활동 지역은 회원이 직접 선택한 지역 단위까지만 사용합니다.",
  "탈퇴하면 회원이 작성한 정보는 지체 없이 파기합니다. 법령이 보존을 요구하는 기록은 해당 기간만 보관합니다.",
  "수사기관 자료 제공은 적법한 절차(영장 등)를 확인한 경우에만 응합니다.",
];

export default function SafetyPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5">
      <section className="py-14">
        <Badge variant="success">신고 24시간 이내 처리 · 긴급 건 1시간 이내 임시 조치</Badge>
        <h1 className="mt-3 text-display text-ink">안전과 신뢰</h1>
        <p className="mt-4 text-body text-ink">
          만남을 다루는 서비스에서 안전은 기능이 아니라 전제입니다.
        </p>
        <p className="mt-2 text-body text-ink-muted">
          {BRAND_NAME}는 매칭 알고리즘보다 신고 처리 체계를 먼저 만들었습니다.
        </p>
      </section>

      <section className="border-t border-line py-12" aria-labelledby="verify">
        <h2 id="verify" className="text-h1 text-ink">
          인증 절차 — 단계를 올릴수록 더 많이 열립니다
        </h2>
        <p className="mt-3 text-body text-ink-muted">
          {BRAND_NAME}의 모든 회원은 4단계 인증 체계를 거칩니다.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">{BRAND_NAME} 인증 4단계와 단계별 이용 범위</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-3 pr-4 text-body-sm text-ink-muted">
                  단계
                </th>
                <th scope="col" className="py-3 pr-4 text-body-sm text-ink-muted">
                  내용
                </th>
                <th scope="col" className="py-3 text-body-sm text-ink-muted">
                  할 수 있는 것
                </th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l.step} className="border-b border-line align-top">
                  <th scope="row" className="py-3 pr-4 text-body-sm font-semibold text-ink">
                    {l.step}
                  </th>
                  <td className="py-3 pr-4 text-body-sm text-ink-muted">{l.what}</td>
                  <td className="py-3 text-body-sm text-ink-muted">{l.can}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-body text-ink">
          본인인증을 완료하지 않은 회원끼리는 매칭도, 대화도 성립하지 않습니다.
        </p>
        <p className="mt-2 text-body text-ink-muted">
          본인인증 과정에서 만 19세 미만으로 확인되면 계정은 즉시 정지되고 정보는 파기 절차를
          밟습니다.
        </p>
      </section>

      <section className="border-t border-line py-12" aria-labelledby="report">
        <h2 id="report" className="text-h1 text-ink">
          신고 처리 — 24시간 약속
        </h2>
        <ul className="mt-5 flex flex-col gap-3">
          {REPORT_RULES.map((r) => (
            <li key={r}>
              <Card>
                <p className="text-body text-ink-muted">{r}</p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-caption text-ink-muted">
          24시간 처리 약속은 앱 안에서 접수된 신고에 적용됩니다. 회사 사이트 문의 폼은 신고 창구가
          아닙니다.
        </p>
      </section>

      <section className="border-t border-line py-12" aria-labelledby="data">
        <h2 id="data" className="text-h1 text-ink">
          데이터 정책 요약
        </h2>
        <ul className="mt-5 flex list-disc flex-col gap-3 pl-5">
          {DATA_RULES.map((r) => (
            <li key={r} className="text-body text-ink-muted">
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-body-sm text-ink-muted">
          자세한 내용은{" "}
          <a href={`${WEB_URL}/legal/privacy`} className="text-ink underline">
            개인정보처리방침
          </a>
          을 확인해 주세요.
        </p>
      </section>

      <section className="border-t border-line py-14">
        <h2 className="text-h1 text-ink">안전한 만남부터 시작해 보세요.</h2>
        <a
          href={webUrl("/", "safety")}
          className="mt-6 inline-flex h-13 items-center justify-center rounded-full bg-primary px-8 text-body font-semibold text-primary-fg hover:bg-primary-strong"
        >
          {BRAND_NAME} 시작하기
        </a>
      </section>
    </main>
  );
}
