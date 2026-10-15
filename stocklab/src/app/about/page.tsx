import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { JsonLd } from "@/components/JsonLd";
import { SITE, absUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "소개 — 종목을 찍어주지 않는 데이터 도구",
  description: "스톡랩은 공개 데이터로 조건을 걸어 종목을 걸러 보고 계산기로 검증하는 개인 투자자용 도구입니다. 하지 않는 것, 데이터 출처, 계산 방식 공개 원칙, 운영자와 로드맵을 안내합니다.",
  alternates: { canonical: "/about" },
};

const SOURCES = [
  { src: "DART 전자공시 (금융감독원 OpenDART)", items: "매출·영업이익·순이익·자본·부채, EPS/BPS, 배당(DPS·배당성향)", freq: "일 1회 (06:00 KST)", delay: "공시 반영 후 익일" },
  { src: "KRX 정보데이터시스템", items: "종목 기본정보, 시장 구분, 시가총액, 전일 종가", freq: "일 1회 (06:00 KST)", delay: "전일 종가 기준" },
  { src: "한국투자증권 KIS Developers", items: "종가·시가총액 보조 확인, 배당 기준일", freq: "일 1회", delay: "전일 종가 기준" },
  { src: "자체 계산", items: "PER·PBR·ROE·부채비율·배당수익률 (공시 값 ÷ 시세 값)", freq: "적재 시 재계산", delay: "위 원천 지연을 그대로 상속" },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `${SITE.name} 소개`,
    url: absUrl("/about"),
    description: metadata.description,
    mainEntity: {
      "@type": "Organization",
      name: SITE.parent.name,
      url: SITE.parent.url,
      email: SITE.contactEmail,
      brand: { "@type": "Brand", name: SITE.name, alternateName: SITE.nameEn },
    },
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ href: "/about", label: "소개" }]} />
      <JsonLd data={jsonLd} />
      <article className="prose-kr max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">스톡랩 소개</h1>
        <p className="text-muted">{SITE.tagline}</p>

        <h2 id="mission">미션 — 종목이 아니라 도구를</h2>
        <p>
          개인 투자자가 접하는 정보의 상당수는 &ldquo;무엇을 사라&rdquo;는 결론만 있고 근거와 검증 과정은 없습니다. 스톡랩은 반대로 갑니다.
          결론을 주지 않고, 공개 데이터와 계산 도구를 드려서 <strong>스스로 조건을 정하고, 결과를 확인하고, 숫자로 검증</strong>할 수 있게 합니다.
          리딩방이 아니라 도구를 만듭니다. 종목을 찍어주지 않습니다.
        </p>

        <h2 id="not-doing">우리가 하지 않는 것</h2>
        <ul>
          <li>특정 종목의 매매를 권유하지 않습니다. 화면에 나오는 것은 &ldquo;조건 충족 종목&rdquo;, &ldquo;스크리닝 결과&rdquo;, &ldquo;계산 결과&rdquo;입니다.</li>
          <li>리딩·종목 상담·1:1 투자 조언을 하지 않습니다. 유료 정보방도 운영하지 않습니다.</li>
          <li>수익을 보장하지 않습니다. 과거 데이터와 가정에 기반한 계산은 미래 성과를 보장하지 않습니다.</li>
          <li>실시간 시세를 제공하지 않습니다. 전일 종가 기준 지연 데이터를 사용하며 화면마다 기준일을 표시합니다.</li>
          <li>이름·전화번호·주민등록번호 같은 민감정보를 수집하지 않습니다.</li>
        </ul>

        <h2 id="sources">데이터 출처 투명성</h2>
        <p>모든 수치는 아래 원천에서 가져오며, 어떤 항목이 어디서 왔고 얼마나 지연되는지 공개합니다.</p>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th scope="col">소스</th><th scope="col">항목</th><th scope="col">갱신 주기</th><th scope="col">지연</th></tr></thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.src}><td>{s.src}</td><td>{s.items}</td><td>{s.freq}</td><td>{s.delay}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">{SITE.dataDisclaimer} 원천 데이터의 오류·누락·정정공시가 그대로 반영될 수 있으니 중요한 판단 전에는 공시 원문을 확인하세요.</p>

        <h2 id="open-method">계산 방식 공개 원칙</h2>
        <ul>
          <li><strong>조건식 공개</strong>: 스크리너의 모든 필터(PER·PBR·ROE·부채비율·배당수익률·연속배당·배당성향)는 화면에 그대로 보이고 이용자가 바꿀 수 있습니다. 숨은 가중치나 점수는 없습니다.</li>
          <li><strong>선정 규칙 공개</strong>: 오늘의 주식은 미리 정의된 규칙(예: 저PBR + 고ROE)으로 조건 충족 종목 1개를 자동 기록하며, 어떤 조건을 충족했는지 문장으로 표시합니다.</li>
          <li><strong>공식 공개</strong>: 복리 계산기는 A = P(1 + r/n)^(nt) 와 적립식 공식을 본문에 적고, 세금·물가 반영 방식이 단순 계산임을 명시합니다.</li>
          <li><strong>지표 정의</strong>: PER = 시가총액 ÷ 최근 연간 순이익, PBR = 시가총액 ÷ 자본총계, ROE = 순이익 ÷ 자본총계, 부채비율 = 부채총계 ÷ 자본총계, 배당수익률 = 주당배당금 ÷ 전일 종가.</li>
        </ul>

        <h2 id="operator">운영자</h2>
        <p>
          스톡랩은 <a href={SITE.parent.url} rel="noopener">{SITE.parent.name}</a>이 운영하는 1인 개발 프로젝트입니다. 생활 계산기 허브를 만들어 온 경험을 바탕으로,
          투자 영역에서도 &ldquo;직접 확인할 수 있는 도구&rdquo;를 만드는 것을 목표로 합니다. 유사투자자문업 신고 대상이 아닌 데이터 도구로 운영되며, 매매를 권유하지 않습니다.
        </p>

        <h2 id="roadmap">로드맵</h2>
        <ol>
          <li><strong>P1 — 무료 도구 (현재)</strong>: 저평가·고배당 스크리너, 복리 계산기, 오늘의 주식. 비로그인 일일 실행 제한.</li>
          <li><strong>P2 — 검증·알림 (준비 중)</strong>: 조건 백테스트(과거 구간에서 같은 조건을 걸었을 때의 결과 확인), 조건 충족 알림, 내 조건 저장. 회원가입 도입.</li>
          <li><strong>P3 — 모의투자 (검토 중)</strong>: 가상 포트폴리오로 조건 기반 전략을 기록하고 비교. 실제 주문·계좌 연동은 계획에 없습니다.</li>
        </ol>
        <p className="text-sm text-muted">유료 요금제(베이직·프로)는 준비 중인 안이며 결제 기능은 아직 없습니다. 도입 시 <Link href="/terms">이용약관</Link>에 별도 고지합니다.</p>

        <h2 id="contact">문의</h2>
        <p>
          데이터 오류 제보, 기능 제안, 제휴·광고 문의: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        </p>
        <p className="text-sm text-muted">
          관련 문서: <Link href="/disclaimer">면책 고지</Link> · <Link href="/terms">이용약관</Link> · <Link href="/privacy">개인정보처리방침</Link>
        </p>
      </article>
    </div>
  );
}
