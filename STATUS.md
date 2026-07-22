# VIRAL 앱 진행 보드 (정적 스택 적응판)

원문 설계(`VIRAL-10` Next.js/Supabase 멀티에이전트 프롬프트)를 이 저장소의 실제
스택(**정적 HTML + `gen-pages.mjs`**)에 맞게 적응해 진행. 백엔드/유료 키가 필요한
부분은 소유자 승인 전까지 보류(사유는 CLAUDE.md 참고).

## 카니벌라이제이션 판정 (원문 10종 vs 기존 앱)
| 원문 slug | 판정 | 사유 |
|---|---|---|
| **tone-lab** | **채택(2차)** | tone-score(중국어 성조)·말선물(인사말)과 무충돌. 룰기반 변환 파이프라인 |
| chat-xray | 제외 | `katalk-chemistry` 와 충돌 |
| daily-debate | 제외 | `밸런스픽`(A/B 선택+투표)과 충돌 + 매일 자동발행은 백엔드 필요 |
| **taste-dna** | **채택** | 충돌 없음. 완전 클라이언트 결정형 가능 |
| reality-check | 제외 | `isitnormal`/`company-vs-average` 와 충돌 |
| **dark-history** | **채택(2차)** | 충돌 없음. 시대 렉시콘 분류기로 결정형 가능 |
| **first-impress** | **채택** | 충돌 없음. 키워드 엔진으로 결정형 가능 |
| nickname-lab | 제외 | `dydrms-nickfactory`(별명공장)와 충돌 |
| **roast-edit** | **채택(2차)** | `자소서닥터`(실용 첨삭)와 각도 차별화: 재미용 독설/칭찬 리액션 카드. 자소서 포지셔닝 금지 |
| **future-letter** | **채택** | 충돌 없음. 템플릿 편지 엔진으로 양질 가능 |

## 앱 상태
| slug | 개념 | 엔진 | 바이럴 루프 | 빌드 | 상태 |
|---|---|---|---|---|---|
| taste-dna | 취향DNA 128유형 | 결정형 해시+칩 | ✅ | ✅ | 완료 (1차) |
| future-letter | 1년 뒤 나의 편지 | 템플릿 슬롯 | ✅ | ✅ | 완료 (1차) |
| first-impress | 첫인상 리포트 | 키워드 렉시콘 | ✅ | ✅ | 완료 (1차) |
| tone-lab | 말투 5종 변환 | 룰 파이프라인 | ✅ | ✅ | 완료 (2차) |
| roast-edit | 독설/칭찬 평가서 | 텍스트 메트릭 | ✅ | ✅ | 완료 (2차) |
| dark-history | 흑역사 시대 판독 | 시대 렉시콘 | ✅ | ✅ | 완료 (2차) |

## 라인업 완성 — 6/10 구현, 4 제외(충돌·백엔드 필요)
6앱 상호 크로스링크 완료, `node gen-pages.mjs` 경고 0 (내장 9→15),
전 앱 JSON-LD 유효. PR #10 로 머지.

## 소유자 결정 필요 (과금/키)
- 서버사이드 AI 프록시 도입(진짜 AI 결과 품질) → Supabase/AI 키·비용 승인 필요.
- 그 경우에만 tone-lab/roast-edit/first-impress 등의 AI 버전, daily-debate cron 가능.
