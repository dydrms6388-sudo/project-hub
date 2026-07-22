# VIRAL 앱 진행 보드 (정적 스택 적응판)

원문 설계(`VIRAL-10` Next.js/Supabase 멀티에이전트 프롬프트)를 이 저장소의 실제
스택(**정적 HTML + `gen-pages.mjs`**)에 맞게 적응해 진행. 백엔드/유료 키가 필요한
부분은 소유자 승인 전까지 보류(사유는 CLAUDE.md 참고).

## 카니벌라이제이션 판정 (원문 10종 vs 기존 앱)
| 원문 slug | 판정 | 사유 |
|---|---|---|
| tone-lab | 보류 | 무AI 룰기반은 품질 약함. tone-score(중국어 성조)와는 무충돌 |
| chat-xray | 제외 | `katalk-chemistry` 와 충돌 |
| daily-debate | 보류 | 매일 자동발행 = cron/백엔드 필요(정적 불가) |
| **taste-dna** | **채택** | 충돌 없음. 완전 클라이언트 결정형 가능 |
| reality-check | 제외 | `isitnormal`/`company-vs-average` 와 충돌 |
| dark-history | 후순위 | 무AI 품질 애매 |
| **first-impress** | **채택** | 충돌 없음. 키워드 엔진으로 결정형 가능 |
| nickname-lab | 제외 | `dydrms-nickfactory`(별명공장)와 충돌 |
| roast-edit | 후순위 | 무AI 독설 품질 약함 |
| **future-letter** | **채택** | 충돌 없음. 템플릿 편지 엔진으로 양질 가능 |

## 앱 상태
| slug | 개념 | 엔진 | 바이럴 루프 | 빌드 | 상태 |
|---|---|---|---|---|---|
| taste-dna | 취향DNA 128유형 | 결정형 해시+칩 | ✅ | — | 구현 중 |
| future-letter | 1년 뒤 나의 편지 | 템플릿 슬롯 | ✅ | — | 구현 중 |
| first-impress | 첫인상 리포트 | 키워드 렉시콘 | ✅ | — | 구현 중 |

## 다음 액션 (소유자 결정 필요 없음 / 자동 진행분)
- 3앱을 `gen-pages.mjs` BUILTINS 에 등록 → 허브·사이트맵 반영, 빌드 경고 0 확인.
- 커밋·푸시·드래프트 PR.

## 소유자 결정 필요 (과금/키)
- 서버사이드 AI 프록시 도입(진짜 AI 결과 품질) → Supabase/AI 키·비용 승인 필요.
- 그 경우에만 tone-lab/roast-edit/first-impress 등의 AI 버전, daily-debate cron 가능.
