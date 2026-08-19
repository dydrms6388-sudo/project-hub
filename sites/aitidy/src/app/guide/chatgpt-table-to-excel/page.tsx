import type { Metadata } from "next";
import { JsonLd } from "@/lib/seo";
import { site } from "@/site.config";
import GuideShell, { Code, H2, H3, Note, ToolLink } from "@/components/GuideShell";

const TITLE = "ChatGPT 표를 엑셀로 옮기는 가장 확실한 방법";
const DESC =
  "ChatGPT·Claude 답변의 표를 엑셀로 옮길 때 칸이 안 나뉘거나 한글이 깨지는 이유와, 마크다운 표·탭 구분·CSV·xlsx 네 가지 경로를 상황별로 정리했습니다.";
const PATH = "/guide/chatgpt-table-to-excel/";
const UPDATED = "2026-08-19";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["챗지피티 표 엑셀", "마크다운 표 엑셀 변환", "AI 표 csv", "표 붙여넣기 깨짐", "엑셀 한글 깨짐"],
  alternates: { canonical: PATH },
  openGraph: {
    type: "article",
    locale: site.locale,
    siteName: site.name,
    url: PATH,
    title: `${TITLE} | ${site.name}`,
    description: DESC,
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESC,
    inLanguage: "ko-KR",
    datePublished: UPDATED,
    dateModified: UPDATED,
    mainEntityOfPage: `${site.url}${PATH}`,
    publisher: { "@type": "Organization", name: site.name, url: site.url },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: `${site.url}/` },
      { "@type": "ListItem", position: 2, name: TITLE, item: `${site.url}${PATH}` },
    ],
  },
];

export default function Page() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <GuideShell
        title={TITLE}
        lead="표를 그대로 복사해 엑셀에 붙여넣으면 한 칸에 몽땅 들어가거나 파이프(|) 기호가 그대로 남습니다. 왜 그런지, 그리고 상황별로 어떤 경로가 가장 손실이 적은지 정리했습니다."
        updated={UPDATED}
      >
        <H2>1. 챗봇이 만드는 표는 사실 &lsquo;글자&rsquo;다</H2>
        <p>
          ChatGPT 화면에서 깔끔한 격자로 보이는 표는 실제로는 아래와 같은 텍스트입니다. 이를 GitHub Flavored
          Markdown의 표 문법이라고 부릅니다.
        </p>
        <Code>{`| 분기 | 매출(억) | 성장률 |
|---|---|---|
| 1Q | 1,200 | 12.5% |
| 2Q | 1,430 | 19.2% |`}</Code>
        <p>
          첫 줄이 머리글, 둘째 줄이 <code>---</code> 구분선, 그 아래가 데이터 행입니다. 브라우저 화면에서는 이
          문법을 해석해 격자로 그려 주지만, 엑셀은 마크다운을 모릅니다. 그래서 그대로 붙여넣으면 파이프 기호가
          포함된 문자열이 한 열에 통째로 들어갑니다.
        </p>
        <Note>
          핵심: 엑셀이 칸을 나누는 기준은 <b>탭 문자</b>(붙여넣기 시)와 <b>콤마</b>(CSV 열기 시)뿐입니다. 파이프(|)는
          엑셀에게 아무 의미가 없습니다.
        </Note>

        <H2>2. 네 가지 경로 비교</H2>
        <H3>경로 A. 화면에서 표를 드래그해 복사 (가장 간단하지만 불안정)</H3>
        <p>
          ChatGPT 웹 화면의 표를 마우스로 드래그해 복사하면 클립보드에 HTML 표가 함께 담겨 엑셀이 칸을 나눠 주는
          경우가 있습니다. 다만 브라우저와 서비스 버전에 따라 HTML이 아니라 평문만 담기기도 하고, 모바일 앱에서는
          거의 실패합니다. 표가 길면 스크롤 도중 선택이 끊기는 문제도 있습니다.
        </p>
        <H3>경로 B. 탭 구분 텍스트로 바꿔 붙여넣기 (빠름)</H3>
        <p>
          셀 사이를 탭 문자로 바꾸면 엑셀·구글 시트에 붙여넣는 순간 칸이 자동으로 나뉩니다. 서식은 없지만 값은
          정확히 들어갑니다. <b>마크다운 제거</b> 도구에서 &lsquo;표&rsquo; 옵션을 &lsquo;탭 구분
          평문&rsquo;으로 두면 이 형태가 만들어집니다.
        </p>
        <H3>경로 C. CSV 파일로 저장 (여러 표·다른 프로그램과 호환)</H3>
        <p>
          CSV는 콤마로 열을, 줄바꿈으로 행을 구분하는 순수 텍스트 형식입니다(RFC 4180). 어떤 스프레드시트에서도
          열리지만 한글 인코딩 사고가 잦습니다. 뒤에서 따로 다룹니다.
        </p>
        <H3>경로 D. xlsx 파일로 바로 저장 (가장 안전)</H3>
        <p>
          엑셀 원본 형식으로 만들면 인코딩 문제가 없고, 숫자 셀을 숫자형으로 넣을 수 있어 합계·평균 함수가 바로
          동작합니다. 표가 여러 개면 시트로 나눌 수도 있습니다. 아래 도구가 이 경로를 처리합니다.
        </p>

        <div className="!my-6 grid gap-3 sm:grid-cols-2">
          <ToolLink slug="table-to-excel" />
          <ToolLink slug="markdown-remove" />
        </div>

        <H2>3. 자주 겪는 사고 세 가지</H2>
        <H3>&ldquo;1,200&rdquo;이 문자로 들어가 합계가 안 된다</H3>
        <p>
          천 단위 콤마가 붙은 값은 엑셀이 문자열로 인식하는 경우가 많습니다. 해결책은 두 가지입니다. 변환 단계에서
          콤마를 떼고 숫자형으로 넣거나(표 엑셀로 변환 도구의 &lsquo;숫자 셀 자동 숫자형&rsquo; 옵션), 엑셀에서
          해당 열을 선택해 <code>데이터 &gt; 텍스트 나누기 &gt; 마침</code>을 눌러 재해석시키는 방법입니다.
        </p>
        <p>
          반면 <code>12.5%</code>처럼 기호가 붙은 값은 자동 변환 대상에서 제외하는 편이 안전합니다. 기호를 떼면
          12.5인지 0.125인지 의미가 달라지기 때문입니다. 퍼센트 열이 계산에 필요하면 엑셀에서 기호를 지우고 백분율
          서식을 지정하세요.
        </p>
        <H3>CSV를 열었더니 한글이 &ldquo;ÇÑ±Û&rdquo;로 보인다</H3>
        <p>
          한국어 윈도우의 엑셀은 CSV를 열 때 시스템 기본 인코딩(EUC-KR/CP949)으로 읽으려 합니다. 파일이 UTF-8이면
          글자가 깨집니다. 파일 맨 앞에 UTF-8 BOM(<code>EF BB BF</code> 3바이트)이 있으면 엑셀이 UTF-8임을 알아채고
          제대로 읽습니다. 이 사이트의 CSV 다운로드는 BOM을 자동으로 붙입니다.
        </p>
        <p>
          이미 깨진 파일을 받았다면 엑셀에서 <code>데이터 &gt; 텍스트/CSV 가져오기</code>를 눌러 원본 파일 인코딩을
          &lsquo;UTF-8&rsquo;로 지정해 다시 불러오면 복구됩니다.
        </p>
        <H3>표가 여러 개인데 하나로 뭉개진다</H3>
        <p>
          답변 안에 표가 여러 개 있으면 표마다 시트를 나누는 편이 나중에 다루기 쉽습니다. 반대로 같은 구조의 표가
          여러 개로 쪼개진 것이라면 한 시트에 이어 붙인 뒤 피벗 테이블을 쓰는 편이 낫습니다. 표 엑셀로 변환 도구에서
          두 방식을 선택할 수 있습니다.
        </p>

        <H2>4. 표를 잘 받아 내는 프롬프트</H2>
        <p>
          애초에 붙여넣기 쉬운 형태로 답을 받으면 변환 단계가 줄어듭니다. 실무에서 잘 통하는 요청은 다음과 같습니다.
        </p>
        <Code>{`결과를 표로 정리해 줘. 단, 마크다운 표 말고
탭(Tab)으로 열을 구분한 순수 텍스트로 출력해 줘.
숫자에는 천 단위 콤마를 넣지 말고, 단위는 열 이름에만 써 줘.`}</Code>
        <p>
          천 단위 콤마를 빼 달라고 명시하는 것만으로도 엑셀에서 숫자형으로 바로 인식될 확률이 크게 올라갑니다. 단위를
          열 이름(예: <code>매출(억원)</code>)으로 빼면 셀 값이 순수한 숫자로 유지됩니다.
        </p>

        <H2>5. 정리</H2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>표를 한 번만 옮긴다면 → 탭 구분 텍스트로 바꿔 붙여넣기</li>
          <li>계산까지 해야 한다면 → xlsx로 저장(숫자형 유지)</li>
          <li>다른 프로그램이나 노션 DB로 넘긴다면 → CSV(단, UTF-8 BOM 확인)</li>
          <li>한글이 깨졌다면 → 인코딩 문제이지 표 구조 문제가 아니다</li>
        </ul>

        <div className="!my-6 grid gap-3 sm:grid-cols-2">
          <ToolLink slug="table-to-excel" />
          <ToolLink slug="notion-paste" />
        </div>
      </GuideShell>
    </>
  );
}
