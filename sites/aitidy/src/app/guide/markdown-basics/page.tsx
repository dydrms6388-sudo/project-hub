import type { Metadata } from "next";
import { JsonLd } from "@/lib/seo";
import { site } from "@/site.config";
import GuideShell, { Code, H2, H3, Note, ToolLink } from "@/components/GuideShell";

const TITLE = "마크다운이 뭐길래 — AI 답변에 **, ###가 붙는 이유";
const DESC =
  "ChatGPT 답변에 별표와 우물정자가 섞여 나오는 이유를 마크다운 문법으로 설명하고, 붙여넣을 곳(한글·카톡·노션·엑셀)별로 어떻게 처리해야 하는지 정리했습니다.";
const PATH = "/guide/markdown-basics/";
const UPDATED = "2026-08-19";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: ["마크다운", "마크다운 문법", "챗지피티 별표", "### 의미", "마크다운 제거"],
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
        lead="AI 답변을 복사해 메모장이나 카톡에 붙여넣으면 왜 이상한 기호가 남을까요? 기호 하나하나의 의미와, 붙여넣을 곳에 따라 남길지 지울지 판단하는 기준을 정리했습니다."
        updated={UPDATED}
      >
        <H2>마크다운은 &lsquo;글로 쓰는 서식&rsquo;이다</H2>
        <p>
          마크다운(Markdown)은 2004년 존 그루버가 만든 경량 서식 문법입니다. 목표는 단순했습니다. 서식이 적용된
          문서를 특별한 편집기 없이 평범한 텍스트만으로 쓰고, 그 텍스트 자체도 읽기 쉬워야 한다는 것입니다. 그래서
          강조는 별표로, 제목은 우물정자로 표시합니다.
        </p>
        <p>
          ChatGPT·Claude·제미나이는 모두 답변을 마크다운으로 출력합니다. 챗봇 화면은 이 문법을 해석해 굵은 글씨와
          제목, 목록으로 그려 주기 때문에 사용자는 기호를 볼 일이 없습니다. 문제는 <b>복사한 순간</b>부터입니다.
          클립보드에는 화면에 그려진 모양이 아니라 원본 텍스트, 즉 기호가 그대로 담긴 문자열이 들어갑니다.
        </p>
        <Note>
          그래서 마크다운을 해석하는 곳(노션·깃허브·디스코드·옵시디언)에 붙여넣으면 서식이 살아나고, 해석하지 않는
          곳(메모장·카카오톡·한글·엑셀)에 붙여넣으면 기호가 글자로 남습니다. 붙여넣을 곳이 어느 쪽인지가 판단
          기준입니다.
        </Note>

        <H2>기호 해석 사전</H2>
        <H3># — 제목(헤딩)</H3>
        <Code>{`# 가장 큰 제목
## 두 번째 제목
### 세 번째 제목`}</Code>
        <p>
          우물정자 개수가 제목 단계입니다. 반드시 줄 맨 앞에 있어야 하고 뒤에 공백이 와야 합니다. 그래서
          &ldquo;#1 순위&rdquo; 같은 문장 중간의 우물정자는 제목이 아닙니다. HTML의 h1~h6에 대응합니다.
        </p>

        <H3>** 와 * — 굵게, 기울임</H3>
        <Code>{`**굵게 표시할 부분**
*기울임 부분*
***굵은 기울임***`}</Code>
        <p>
          별표 두 개로 감싸면 굵게, 한 개면 기울임입니다. 밑줄 문자(<code>__굵게__</code>)로도 같은 표현이
          가능합니다. AI 답변에서 가장 많이 눈에 띄는 기호가 바로 이 <code>**</code>입니다. 짝을 이뤄 감싼 형태만
          서식이므로, &ldquo;3 * 4&rdquo; 같은 곱셈 표기는 서식이 아닙니다.
        </p>

        <H3>- 와 1. — 목록</H3>
        <Code>{`- 순서 없는 항목
- 또 다른 항목
  - 들여쓴 하위 항목

1. 순서 있는 항목
2. 두 번째`}</Code>
        <p>
          하이픈·별표·플러스 중 아무거나 써도 되고, 공백 두 칸을 들여쓰면 하위 항목이 됩니다. 체크박스는
          <code> - [ ] 할 일</code>, <code>- [x] 완료</code> 형태입니다.
        </p>

        <H3>` 와 ``` — 코드</H3>
        <Code>{'문장 속 `변수명`은 백틱 하나로 감쌉니다.\n\n```python\ndef hello():\n    print("hi")\n```'}</Code>
        <p>
          백틱(`) 하나는 문장 속 코드, 세 개는 여러 줄 코드블록입니다. 여는 백틱 세 개 뒤에 붙은 <code>python</code>
          같은 단어는 구문 강조용 언어 이름입니다. 노션은 이 언어 이름을 읽어 코드 블록 언어를 자동으로 설정하므로
          노션에 옮길 때는 지우면 안 됩니다.
        </p>

        <H3>&gt; — 인용문</H3>
        <p>
          줄 맨 앞의 꺾쇠는 인용 블록입니다. 꺾쇠를 두 번 겹치면 인용 안의 인용이 됩니다. 챗봇은 원문을 그대로
          옮기거나 주의사항을 강조할 때 이 표기를 씁니다.
        </p>

        <H3>| — 표</H3>
        <Code>{`| 항목 | 값 |
|---|---|
| 매출 | 1,200 |`}</Code>
        <p>
          파이프로 셀을 나누고 둘째 줄에 구분선을 두는 구조입니다. 원래 마크다운 표준에는 없었고, GitHub Flavored
          Markdown이 확장으로 추가해 사실상 표준이 되었습니다. 구분선 줄이 없으면 표로 인식되지 않습니다.
        </p>

        <H3>[텍스트](주소) — 링크</H3>
        <p>
          대괄호에 보일 글자, 소괄호에 주소를 넣습니다. 앞에 느낌표를 붙이면(<code>![설명](주소)</code>) 이미지가
          됩니다. 평문으로 옮길 때는 보일 글자만 남길지, &ldquo;글자 (주소)&rdquo; 형태로 주소를 살릴지 목적에 따라
          정하면 됩니다.
        </p>

        <H2>붙여넣을 곳별 처리 기준</H2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 px-2 py-1.5 text-left">붙여넣을 곳</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">마크다운 해석</th>
                <th className="border border-slate-200 px-2 py-1.5 text-left">권장 처리</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 px-2 py-1.5">한글·워드·메일</td>
                <td className="border border-slate-200 px-2 py-1.5">안 함</td>
                <td className="border border-slate-200 px-2 py-1.5">기호 전부 제거</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-2 py-1.5">카카오톡</td>
                <td className="border border-slate-200 px-2 py-1.5">안 함</td>
                <td className="border border-slate-200 px-2 py-1.5">기호를 【】·· 로 치환</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-2 py-1.5">노션</td>
                <td className="border border-slate-200 px-2 py-1.5">함</td>
                <td className="border border-slate-200 px-2 py-1.5">기호 유지 + 헤딩 레벨만 조정</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-2 py-1.5">엑셀·구글 시트</td>
                <td className="border border-slate-200 px-2 py-1.5">안 함</td>
                <td className="border border-slate-200 px-2 py-1.5">표만 뽑아 탭/CSV/xlsx 로</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-2 py-1.5">깃허브·디스코드·옵시디언</td>
                <td className="border border-slate-200 px-2 py-1.5">함</td>
                <td className="border border-slate-200 px-2 py-1.5">그대로 붙여넣기</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="!my-6 grid gap-3 sm:grid-cols-2">
          <ToolLink slug="markdown-remove" />
          <ToolLink slug="kakao-format" />
          <ToolLink slug="notion-paste" />
          <ToolLink slug="table-to-excel" />
        </div>

        <H2>애초에 기호 없이 받는 방법</H2>
        <p>
          변환이 귀찮다면 요청 단계에서 형식을 지정할 수 있습니다. 다음 문장을 프롬프트 끝에 붙이면 대체로 잘
          따릅니다.
        </p>
        <Code>{`답변은 마크다운 기호 없이 순수 텍스트로 작성해 줘.
굵게(**), 제목(#), 목록 기호(-), 표(|)를 쓰지 말고
줄바꿈과 문단만으로 구분해 줘.`}</Code>
        <p>
          다만 대화가 길어지면 모델이 이 지시를 잊고 다시 마크다운으로 돌아가는 경우가 흔합니다. 결과물이 중요한
          작업이라면 프롬프트로 통제하기보다 받은 답변을 도구로 정리하는 편이 확실합니다.
        </p>

        <H2>자주 헷갈리는 점</H2>
        <H3>마크다운은 하나가 아니다</H3>
        <p>
          원본 마크다운을 엄밀하게 정의한 것이 CommonMark 명세이고, 여기에 표·취소선·자동 링크·체크박스를 더한 것이
          GitHub Flavored Markdown(GFM)입니다. 챗봇 답변은 대체로 GFM에 가깝습니다. 서비스마다 지원 범위가 조금씩
          달라서, 노션에서 되던 표기가 다른 곳에서는 안 되는 일이 생깁니다.
        </p>
        <H3>&lsquo;서식 없이 붙여넣기&rsquo;로는 해결되지 않는다</H3>
        <p>
          Ctrl+Shift+V(서식 없이 붙여넣기)는 글꼴·색상 같은 <b>서식 정보</b>를 떼는 기능입니다. 마크다운 기호는
          서식이 아니라 <b>글자 자체</b>라서 이 단축키로는 사라지지 않습니다. 오히려 HTML 표까지 평문으로 만들어
          상황을 악화시키는 경우도 있습니다.
        </p>
        <H3>이모지는 마크다운이 아니다</H3>
        <p>
          ✅ 🔥 📌 같은 그림문자는 마크다운 문법과 무관한 유니코드 문자입니다. 마크다운 제거로는 사라지지 않으므로
          따로 처리해야 합니다.
        </p>

        <div className="!my-6 grid gap-3 sm:grid-cols-2">
          <ToolLink slug="emoji-remove" />
          <ToolLink slug="code-extract" />
        </div>
      </GuideShell>
    </>
  );
}
