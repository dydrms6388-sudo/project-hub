import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "면책 고지",
  description: "스톡랩 면책 고지 — 투자 참고 자료 성격, 유사투자자문업 비해당(데이터 도구), 데이터 오류 가능성, 지연 시세, 계산기·백테스트 한계, 광고 고지, 제3자 링크. 시행일 2026년 9월 2일.",
  alternates: { canonical: "/disclaimer" },
};

const EFFECTIVE = "2026년 9월 2일";

export default function DisclaimerPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: "/disclaimer", label: "면책 고지" }]} />
      <article className="prose-kr max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">면책 고지</h1>
        <p className="text-sm text-muted">시행일: {EFFECTIVE} · 운영자: {SITE.parent.name}</p>
        <div className="not-prose rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm leading-6">
          {SITE.disclaimer}
        </div>

        <h2 id="d1">1. 투자 참고 자료의 성격</h2>
        <p>
          {SITE.name}이 제공하는 모든 화면·수치·목록·계산 결과는 이용자의 투자 판단을 돕는 <strong>참고 자료</strong>입니다.
          어떠한 내용도 특정 종목의 매매를 권유하거나 투자 시점·가격·수량을 제안하는 것이 아니며, 이용자의 개별 재무 상황과 투자 목적을 고려한 조언이 아닙니다.
          투자 결정과 그 결과에 대한 책임은 전적으로 투자자 본인에게 있습니다.
        </p>

        <h2 id="d2">2. 유사투자자문업 신고 대상이 아닌 데이터 도구</h2>
        <p>
          서비스는 이용자가 <strong>직접 조건을 설정</strong>하고 그 조건을 충족하는 종목을 공개 데이터에서 걸러 보는 도구와, 이용자가 입력한 가정으로 수치를 계산하는 도구를 제공합니다.
          운영자는 종목의 가치나 매매에 관한 의견·판단·조언을 제공하지 않으므로 「자본시장과 금융투자업에 관한 법률」상 투자자문업 또는 유사투자자문업에 해당하는 행위를 하지 않습니다.
          &ldquo;오늘의 주식&rdquo;은 미리 공개된 규칙에 따라 조건 충족 종목을 자동 기록하는 것으로, 운영자의 의견이 아닙니다.
        </p>

        <h2 id="d3">3. 정보의 오류 가능성</h2>
        <ul>
          <li>재무 지표는 DART 전자공시의 사업·분기보고서를 자동으로 가공한 값입니다. 공시 원문의 오류, 정정공시, 회계 기준 변경, 자동 추출 과정의 오류가 결과에 반영될 수 있습니다.</li>
          <li>PER·PBR·ROE·부채비율·배당수익률 등 파생 지표는 운영자의 공개된 정의에 따라 계산되며, 증권사·포털의 산식과 다를 수 있습니다.</li>
          <li>운영자는 정보의 정확성·완전성·적시성을 보증하지 않으며, 중요한 판단 전에는 반드시 공시 원문과 공식 자료를 확인하시기 바랍니다.</li>
        </ul>

        <h2 id="d4">4. 지연 시세</h2>
        <p>
          {SITE.dataDisclaimer} 서비스는 실시간 시세를 제공하지 않으며, 표시된 가격·시가총액·배당수익률은 기준일 이후의 가격 변동을 반영하지 않습니다. 각 화면의 데이터 기준일(as of)을 확인하세요.
        </p>

        <h2 id="d5">5. 계산기·백테스트의 한계</h2>
        <ul>
          <li><strong>복리 계산기</strong>는 입력한 수익률이 매년 일정하게 유지된다는 가정에 따른 단순 계산이며 실제 수익을 보장하지 않습니다. 수수료·거래비용은 반영하지 않고, 세금·물가는 옵션을 켠 경우에만 단순 반영합니다.</li>
          <li>향후 제공될 수 있는 <strong>백테스트</strong>는 과거 데이터에 조건을 적용한 결과로, 생존 편향·사후 편향·거래비용 미반영 등의 한계가 있으며 과거 성과는 미래 수익을 보장하지 않습니다.</li>
          <li>모든 시나리오는 비교·학습 목적이며, 실제 자산 경로를 예측하는 것이 아닙니다.</li>
        </ul>

        <h2 id="d6">6. 광고 고지</h2>
        <p>
          서비스는 운영 비용 충당을 위해 Google AdSense 등 제3자 광고를 결과 화면 하단에 게재할 수 있습니다. 광고는 운영자의 편집 판단과 무관하게 광고 네트워크가 선택하며, 광고 내 금융상품·서비스에 대해 운영자는 어떠한 보증도 하지 않습니다.
          광고 쿠키에 대한 안내는 <Link href="/privacy">개인정보처리방침</Link>을 참고하세요.
        </p>

        <h2 id="d7">7. 제3자 링크</h2>
        <p>
          서비스는 이용자 편의를 위해 네이버 금융, DART, KRX 등 외부 사이트로 연결되는 링크를 포함할 수 있습니다. 외부 사이트의 내용·정확성·개인정보 처리에 대해 운영자는 책임을 지지 않으며, 링크 제공이 해당 사이트의 내용을 보증하는 것은 아닙니다.
        </p>

        <h2 id="d8">8. 책임의 제한</h2>
        <p>
          운영자는 서비스의 이용 또는 이용 불능, 정보의 오류·지연·누락, 이용자의 투자 결정으로 발생한 직접·간접·부수적·결과적 손해에 대해 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.
        </p>

        <h2 id="d9">9. 문의</h2>
        <p>데이터 오류 제보 및 문의: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
        <p className="text-sm text-muted">관련 문서: <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link> · <Link href="/about">소개</Link></p>
      </article>
    </div>
  );
}
