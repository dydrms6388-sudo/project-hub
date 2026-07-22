# 앱별 통합 가이드 — @ggu/ugc-core

5개 예정 앱(판결소·동네백서·정상인가요·이름연구소·티어랩)에 이 엔진을 붙이는 절차.
공통 파이프라인은 전부 패키지에 있고, 앱이 하는 일은 **설정 객체 1개 + 어댑터 주입 +
라우트에서 `intake()` 호출**이 전부다. `apps/demo` 가 살아 있는 레퍼런스다.

## 0. 공통 준비 (모든 앱 최초 1회)

1. Supabase 프로젝트에 `supabase/migrations/0000_ugc_core.sql` 적용.
   테이블은 전 앱 공유 — 앱마다 다시 적용하지 않는다.
2. 서버 환경변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (service role은 **서버 전용**. 클라이언트 번들에 노출 금지.)
3. LLM 검수를 쓸 앱은 모델 호출 함수 하나를 준비 (아래 3단계).

## 1. 설정 객체

각 앱의 차이는 `UgcConfig` 하나로 흡수된다. 예시 프리셋:

```ts
// 판결소 — 사연 제출 → 대중 판결. 명예훼손 리스크 최대 → PII 최엄격.
export const pangyeolsoConfig = defineUgcConfig({
  appSlug: "pangyeolso",
  contentSchema: z.object({
    title: z.string().min(5).max(80),
    situation: z.string().min(100).max(5000), // 사연 본문
    sideA: z.string().min(10).max(500),
    sideB: z.string().min(10).max(500),
  }),
  moderation: {
    autoPublishThreshold: 75,   // 사람 이야기라 보수적으로
    blockThreshold: 30,
    requireMinLength: 100,
    forbiddenCategories: ["pii", "hate", "adult", "violence", "illegal"],
  },
  seo: { urlPattern: "/case/[slug]", titleTemplate: "{title} — 판결소",
    minContentScore: 40 },
  rateLimit: { perIpPerHour: 3, perUserPerDay: 5 },
});

// 동네백서 — 지역 정보 제보. 주소 노출이 '기능'이므로 PII 정책이 다르다.
//   → address 휴리스틱이 하드블록하지 않도록 forbiddenCategories에서 pii를 빼고,
//     전화/주민번호는 여전히 규칙 1차의 고신뢰 하드블록으로 잡힌다.
export const dongnaeConfig = defineUgcConfig({
  appSlug: "dongnae",
  contentSchema: z.object({
    place: z.string().min(2).max(60),
    region: z.string().min(2).max(30),
    review: z.string().min(30).max(2000),
  }),
  moderation: { autoPublishThreshold: 60, blockThreshold: 20,
    requireMinLength: 30, forbiddenCategories: ["hate", "adult"] },
  seo: { urlPattern: "/place/[slug]", titleTemplate: "{place} — 동네백서",
    minContentScore: 30 },
  rateLimit: { perIpPerHour: 10, perUserPerDay: 30 },
});

// 정상인가요 — 익명 질문 + 투표. 짧은 글 허용, 물량 많음 → 자동화 비중 최대.
export const normalConfig = defineUgcConfig({
  appSlug: "isitnormal",
  contentSchema: z.object({ question: z.string().min(15).max(500) }),
  moderation: { autoPublishThreshold: 55, blockThreshold: 20,
    requireMinLength: 15, forbiddenCategories: ["pii", "hate", "adult", "self_harm"] },
  seo: { urlPattern: "/q/[slug]", titleTemplate: "{question} — 정상인가요",
    minContentScore: 25 },
  rateLimit: { perIpPerHour: 10, perUserPerDay: 20 },
});
```

이름연구소(`/name/[slug]`)·티어랩(`/tier/[slug]`)도 같은 패턴 — 스키마와 임계치만 다르다.

## 2. 어댑터 주입 (앱당 ~10줄)

```ts
import { createClient } from "@supabase/supabase-js";
import { createUgc, SupabaseStore, LlmClassifier } from "@ggu/ugc-core";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const store = new SupabaseStore(db);

export const ugc = createUgc(pangyeolsoConfig, {
  store,
  dashboard: store,
  classifier: new LlmClassifier({ chat: myChat }),  // 선택 — 없으면 규칙+휴리스틱
  seo: mySeoSink,                                    // 선택 — revalidate/sitemap 훅
});
```

## 3. LLM 분류기 연결 (선택)

패키지는 모델 SDK를 모른다. `chat(prompt) => Promise<string>` 하나만 주면 된다:

```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
async function myChat(prompt: string): Promise<string> {
  const res = await client.messages.create({
    model: "claude-sonnet-5",     // 검수 배치엔 sonnet급이면 충분
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].type === "text" ? res.content[0].text : "";
}
```

파싱 실패·모델 오류 시 항목별로 오프라인 휴리스틱에 폴백되므로 장애가 검수를 멈추지 않는다.

## 4. 라우트 연결 (3줄의 실체)

```ts
// app/submit/actions.ts
const result = await ugc.intake({ raw: body, authorId, ipHash, signals, text: body.situation });
// result.stage: 'published' | 'queued' | 'blocked' | 'rejected'
```

- 공개 페이지: `store.getContentBySlug()` → demo의 `/case/[slug]` 패턴 복사
  (generateMetadata + noindex 분기 + JSON-LD).
- sitemap: `indexed=true` 만 나열 (demo `sitemap.ts` 참조).
- 관리자: `/admin` 페이지 복사 후 **반드시 인증 미들웨어 뒤에** 배치.
  `reviewApprove`/`reviewReject` 는 인증 없인 노출 금지.

## 5. 콜드스타트 시드 (AdSense 심사 대비)

- UGC 0건으로는 심사를 못 넘는다. 시드 콘텐츠는 **관리자 계정 명시 + 사람이 최종
  검수**하는 흐름으로 넣는다. 가짜 유저 위장 금지 (정책 리스크).
- 시드도 일반 제출과 동일하게 `intake()` 를 통과시켜라 — 파이프라인 밖 콘텐츠를
  만들지 않는 것이 규칙.

## 6. 체크리스트 (앱당)

- [ ] `UgcConfig` 작성, `defineUgcConfig` 통과
- [ ] Supabase 어댑터 주입 (service role은 서버 전용)
- [ ] 제출 라우트에 honeypot + `startedAt` 신호 전달
- [ ] 공개 페이지: canonical + noindex 분기 + JSON-LD
- [ ] sitemap: indexed만 나열
- [ ] `/admin` 인증 게이트
- [ ] 신고 버튼 노출 (3회 자동 비공개는 엔진이 처리)
- [ ] 시드 콘텐츠 (관리자 명의, 사람 검수)
