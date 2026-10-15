# docmind-local (독마인드)

파일이 밖으로 나가지 않는 문서 요약·질문 도구. Next.js 15 App Router + 정적 생성,
서버 코드 없음. 모든 연산(문서 파싱 · 임베딩 · LLM 추론)은 사용자의 브라우저에서만 실행된다.

- 배포 대상: `docmind-local.vercel.app` (Vercel Root Directory = `sites/docmind-local`)
- 도구 5개: `summarize` / `ask` / `keypoints` / `translate-summary` / `compare`
- 안내 페이지: `/browser-support/` (WebGPU 실시간 확인 + 브라우저·하드웨어 요구사항 표)

## 스택

| 용도 | 라이브러리 | 로드 시점 |
|---|---|---|
| LLM 추론 | `@mlc-ai/web-llm` (WebGPU 필수) | 사용자가 **모델 준비** 버튼을 누른 뒤 `await import` |
| 임베딩 | `@huggingface/transformers` + `Xenova/multilingual-e5-small` | 사용자가 **문서 색인** 버튼을 누른 뒤 `await import` |
| PDF 텍스트 | `pdfjs-dist` (워커는 로컬 번들, 외부 CDN 사용 안 함) | 파일을 넣은 뒤 `await import` |
| DOCX 텍스트 | `mammoth` | 파일을 넣은 뒤 `await import` |

모델 가중치(약 1GB)는 **리포에 커밋하지 않는다.** 런타임에 브라우저가 내려받아
Cache Storage 에 저장하며, 중간에 끊겨도 다음에 이어받는다.

## 기본 모델을 Qwen2.5-1.5B 로 고른 근거

> ⚠️ **한국어 출력 품질은 측정하지 않았다 — 미측정, 실기기 테스트 필요.**
> 이 저장소가 만들어진 컨테이너에는 GPU 도 WebGPU 도 없어 web-llm 을 한 번도 실행할 수
> 없었다. 따라서 "Qwen 이 Gemma 보다 한국어 요약을 잘한다" 같은 비교 수치는 이 문서에
> 존재하지 않으며, 지어내지 않았다. 아래는 **공개된 문서만으로 판단한 기본값 선택 근거**다.

| 항목 | Qwen2.5-1.5B-Instruct (기본값) | gemma-2-2b-it |
|---|---|---|
| 다국어 | 모델 카드가 한국어 포함 29개 이상 언어 지원을 명시 | 모델 카드가 영어 중심으로 기술 |
| 필요 VRAM | 1,630MB | 1,895MB |
| WebGPU 확장 | 없음 | `shader-f16` 필요 (미지원 GPU 에서 로드 실패) |
| 파라미터 | 15억 | 26억 |

→ (1) 한국어 지원이 모델 카드에 **명시**돼 있고, (2) VRAM 요구가 낮아 내장 그래픽 노트북에서
실패 확률이 작으며, (3) 추가 WebGPU 확장이 필요 없다는 세 가지 이유로 Qwen2.5-1.5B 를
기본값으로 두었다. 파라미터 수만 보면 Gemma 2 2B 가 더 크므로 문장이 더 매끄러울
가능성이 있다 — **실기기에서 두 모델을 같은 문서로 돌려 비교한 뒤 이 문단을 갱신해야 한다.**

그래서 UI 의 모델 선택 드롭다운에 네 가지 모델(0.5B / 1.5B / 3B / gemma-2-2b)을 모두 노출해
사용자가 직접 바꿔 비교할 수 있게 했다. 선택은 `localStorage` 에 저장된다.

수치 출처: 설치된 `@mlc-ai/web-llm` 의 `prebuiltAppConfig.model_list`
(`src/lib/docmind/models.ts` 주석 참고).

## 검증한 것 / 검증하지 못한 것

```bash
node --experimental-strip-types scripts/verify-core.ts   # 75개 통과
npx next build
STATIC_EXPORT=1 STATIC_BASE_PATH=/preview/docmind-local npx next build
```

`scripts/verify-core.ts` 는 GPU 없이 검산 가능한 순수 로직만 다룬다.

- 코사인 유사도: 동일 벡터 = 1.0, 스칼라배 = 1.0, 부호 반전 = -1.0, 직교 = 0,
  영벡터 = 0(0으로 나누기 방지), 차원 불일치 = 예외, 손계산 값 일치
- top-k 정렬/필터, MMR 이 중복 벡터 대신 다양성을 고르는지
- 청크 분할: size 상한 준수, 오프셋이 원문과 정확히 일치, 인접 청크 겹침 > 0,
  원문 커버리지 99% 이상, 구두점 없는 초장문 강제 분할, 무한 루프 방지
- 페이지 매핑(이분 탐색) 경계값, 스캔본 판정
- 맵리듀스: 모든 입력이 최종 결과에 반영되는지, 리듀스 트리가 1개로 수렴하는지,
  예산이 비현실적으로 작아도 종료되는지, 취소 신호 처리

**검증하지 못한 것 (GPU/WebGPU 부재):**

- 실제 요약 품질과 한국어 자연스러움 (모델 비교 포함)
- 20쪽 PDF 요약 소요 시간 — 원래 사양의 DEPLOY GATE(내장 GPU 노트북 3분 이내)는
  이 환경에서 측정 불가. **실기기 측정 전에는 배포 게이트를 통과했다고 볼 수 없다.**
- 모델 다운로드 진행률·이어받기·Cache Storage 동작의 실제 거동
- transformers.js 임베딩 파이프라인의 실제 출력 차원/속도
- 실제 PDF/DOCX 파일에 대한 pdfjs·mammoth 파싱 결과

## 초기 번들에 무거운 라이브러리가 없다는 근거

`npx next build` 출력 기준 **First Load JS: 공통 103kB, 도구 페이지 108kB**.
빌드 산출물을 직접 확인한 결과:

- 도구 페이지 HTML 이 참조하는 스크립트(`255-*`, `4bd1b696-*`, `619-*`, `main-app-*`,
  `polyfills-*`, `webpack-*`)에는 `mlc-ai` / `transformers` / `pdfjs` / `mammoth` /
  `onnxruntime` 문자열이 **0회** 등장한다.
- 도구 컴포넌트 청크(예: `ask` = 9.9kB)에도 `CreateMLCEngine`, `InferenceSession`,
  `GlobalWorkerOptions`, `extractRawText` 심볼이 **0회**다.
- 무거운 코드는 별도 async 청크로 분리돼 있다: web-llm ≈ 5.9MB, mammoth ≈ 482KB,
  pdfjs ≈ 404KB, transformers/onnxruntime ≈ 382KB. 모두 버튼을 누른 뒤에만 받는다.

## 구조

```
src/lib/docmind/
  chunk.ts       문장 경계 기반 청크 분할 + 페이지 매핑 (순수)
  similarity.ts  코사인 유사도 / top-k / MMR (순수)
  mapreduce.ts   맵리듀스 오케스트레이션 — LLM 호출은 콜백 주입 (순수)
  prompts.ts     도구별 map/reduce 프롬프트 (순수)
  models.ts      모델 카탈로그 (web-llm 모델 목록에서 옮긴 수치)
  hash.ts        문서 키 해시 (순수)
  engine.ts      web-llm 래퍼 — 지연 로드, 스트리밍, 캐시 관리
  embed.ts       transformers 래퍼 — e5 query:/passage: 접두사 처리
  vectordb.ts    IndexedDB 벡터 저장소
  parse.ts       pdfjs / mammoth / 텍스트 파싱
  pipeline.ts    맵리듀스 + LLM 결합 (도구 4개가 공유)
src/components/docmind/
  useEngine.ts   WebGPU 감지 · 모델 선택 · 다운로드 진행률 훅
  EnginePanel    모델 준비 UI (진행률 · 예상 시간 · 이어받기 · 캐시 삭제)
  DocPicker      FileDrop 기반 문서 선택 + 파싱 상태
  PipelineTool   요약 계열 도구 공통 화면
  ResultView     결과 표시 + 복사 + "AI 생성, 원문 확인 필요" 고정 고지
```

## 정책

- 모든 결과 하단에 **"AI 생성 결과입니다. 사실관계는 반드시 원문에서 확인하세요."** 고정 노출
- 광고는 결과 아래 1개(`AdSlot`)만. 입력 화면에는 없음
- 민감정보 수집 없음, 파일 업로드 없음, 서버 로그 없음(서버 자체가 없음)
- 모든 도구 `heavy: true` → 도구 페이지 상단에 "PC 크롬/엣지 권장" 뱃지
