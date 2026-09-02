# 스톡랩 디자인 시스템

- 버전 1.0 (2026-09-02) · 토큰 원본: `src/app/globals.css` (Tailwind v4 `@theme`) · 폰트: Pretendard Variable → system-ui → Noto Sans KR
- 원칙: **숫자가 주인공**(표·KPI) · 모바일 우선 · 다크모드 동등 · 색 외 단서 병기(a11y) · 카피는 절제된 존댓말

---

## 1. 컬러 토큰 (`globals.css` 그대로 사용, 신규 색 추가 금지 — 필요 시 토큰 추가 PR)
| 토큰 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--bg` | `#f7f8fa` | `#0b0e13` | 페이지 배경 |
| `--surface` | `#ffffff` | `#131820` | 카드·입력 |
| `--surface-2` | `#f1f3f6` | `#1a212b` | 표 헤더·배너·hover |
| `--border` | `#e3e6eb` | `#263040` | 경계선 |
| `--fg` | `#111418` | `#e8ecf1` | 본문 |
| `--muted` | `#5d6673` | `#9aa5b4` | 보조 텍스트·라벨 (대비 4.5:1 이상 확인) |
| `--brand` | `#1d4ed8` | `#60a5fa` | 주요 버튼·링크·포커스 |
| `--brand-fg` | `#ffffff` | `#0b0e13` | 브랜드 위 텍스트 |
| `--up` | `#d93a3a` | `#f06a6a` | **상승/수익 = 빨강** (국내 관습) |
| `--down` | `#2563eb` | `#5b9cff` | **하락/손실 = 파랑** |
| `--warn` | `#b45309` | `#f59e0b` | 경고·잔여 한도 임박·샘플 배너 |
Tailwind 클래스: `bg-bg text-fg bg-surface bg-surface-2 border-border text-muted bg-brand text-brand-fg text-up text-down text-warn`.

규칙
- 상승/하락 색은 **숫자·아이콘에만**, 배경 채우기 금지(카드 전체가 붉어지는 것 금지).
- 색 하나로 의미 전달 금지: `+2.3%`/`−1.1%`처럼 **부호 필수**, 아이콘 `▲▼` 선택. 스크린리더용 `aria-label="상승 2.3퍼센트"`.
- 성공 상태 색은 별도 토큰 없음 → 브랜드 색 + 체크 아이콘 사용(초록 = 해외 관습 "상승" 혼동 방지).
- 벤치마크 라인·중립 시리즈는 `--muted`.

## 2. 타이포그래피
| 역할 | 클래스 | 크기/행간 | 사용 |
|---|---|---|---|
| Display | `text-3xl md:text-4xl font-bold tracking-tight` | 30/36 → 36/40 | 랜딩 히어로 |
| H1 | `text-2xl md:text-3xl font-bold` | 24/32 → 30/36 | 페이지 제목 (페이지당 1개) |
| H2 | `text-xl font-bold` | 20/28 | 섹션 (`.prose-kr h2`) |
| H3 | `text-lg font-semibold` | 18/28 | 카드 제목 |
| Body | `text-sm md:text-base leading-7` | 14/24 → 16/28 | 본문 |
| Small | `text-xs leading-5` | 12/20 | 보조·면책 |
| KPI 수치 | `text-2xl md:text-3xl font-bold tnum` | | 결과 KPI 타일 |
| 표 수치 | `text-sm tnum` | | 오른쪽 정렬 |
| 코드/종목코드 | `font-mono text-xs text-muted` | | `005930` |
- 본문 `font-feature-settings: "tnum"` 전역, 표·KPI는 `.tnum` 명시.
- 한글 줄바꿈: 제목 `break-keep`, 본문 `break-words`.

## 3. 간격·레이아웃
| 항목 | 값 |
|---|---|
| 그리드 | 4px 기본. 카드 패딩 `p-5`(20) 모바일 `p-4` · 섹션 간 `space-y-8` · 페이지 상하 `py-8 md:py-12` |
| 컨테이너 | `mx-auto max-w-5xl px-4` (표 많은 화면 `max-w-6xl`), 계산기·폼 `max-w-2xl` |
| 라운드 | 버튼·입력 `rounded-lg`(8) · 카드 `rounded-2xl`(16) · 배지 `rounded-full` |
| 그림자 | 카드 `shadow-sm` 만. 다크에서는 border가 경계 담당 |
| 브레이크포인트 | 모바일 360~639 · `md` 768 · `lg` 1024. 표는 `md` 미만에서 컨테이너 가로 스크롤 |
| 터치 타깃 | 최소 44×44 (`min-h-11`) |

## 4. 컴포넌트 인벤토리
| 컴포넌트 | 클래스/파일 | 상태 | 규칙 |
|---|---|---|---|
| Button Primary | `.btn-primary` | hover 90% · disabled 50% · focus ring `ring-brand/20` | 화면당 주요 동작 1개. 라벨 동사형 "조건 적용", "실행", "카드 저장" |
| Button Ghost | `.btn-ghost` | hover `bg-surface-2` | 보조 동작 "초기화", "링크 복사" |
| Button Danger | `.btn-ghost text-up border-up/40` | | 삭제·해지. 확인 모달 필수 |
| Field | `.field` + `<label class="text-xs text-muted">` | focus border-brand | 단위 접미(`%`, `원`, `배`) 우측 고정. 숫자 입력 `inputMode="decimal"` |
| Range Slider | `input[type=range] accent-brand` + 값 배지 | | 필터 값은 슬라이더+숫자 입력 동기 |
| Preset Chip | `rounded-full border px-3 py-1 text-xs` 선택 시 `bg-brand text-brand-fg` | | 프리셋·완화 제안 |
| Card | `.card` | | 제목 H3 + 본문. 중첩 카드 금지 |
| KPI Tile | `.card` 내부 `text-xs text-muted` 라벨 + `text-2xl font-bold tnum` 수치 + 부호색 | | 4열 → 모바일 2열 |
| Table | `<div class="overflow-x-auto rounded-2xl border border-border"><table class="w-full text-sm">` · `th` `bg-surface-2 text-xs text-muted font-medium sticky top-0` · 숫자 `td` `text-right tnum` · 첫 열 종목명 `sticky left-0 bg-surface` | 행 hover `bg-surface-2` | 정렬 가능한 헤더에 `aria-sort` · 최대 20행/페이지 |
| Badge | `rounded-full bg-surface-2 px-2 py-0.5 text-xs` · 변형 `text-warn`(한도), `text-brand`(플랜) | | "베이직", "남은 3/10", "배당락 D-3", "샘플" |
| Empty State | `EmptyState.tsx` — 아이콘 + 제목 + 설명 + 액션 칩 | | "조건을 만족하는 종목이 없습니다" + 완화 칩 |
| Quota Card | `.card border-warn/40` | | 제목·리셋 시각·CTA 2개 (`23-ux-flows.md §1`) |
| Lock Card | `.card` + 흐림 처리 예시(`blur-sm select-none pointer-events-none`) + 오버레이 CTA | | 유료 게이팅 |
| Banner | `rounded-xl border px-4 py-3 text-sm` · 정보 `bg-surface-2` · 경고 `border-warn/40 text-warn`(샘플·지연) · 결제 `border-up/40` | | 화면 상단 1개만 |
| Disclaimer | `Disclaimer.tsx` `role="note"` | compact 변형 | 모든 페이지 하단, 백테스트/랭킹 상단 추가 |
| Notice (백테스트 고지) | `border-l-4 border-warn bg-surface-2 p-3 text-xs` | | 결과 상단 고정, 접기 불가 |
| Toast | 하단 중앙, 3s, `bg-fg text-bg` | | "링크를 복사했습니다" |
| Modal | `dialog` 네이티브 + `.card` | ESC/배경 클릭 닫기 | 해지·삭제 확인 |
| Skeleton | `animate-pulse bg-surface-2 rounded` | | 표 8행, KPI 4 |
| Theme Toggle | `ThemeToggle.tsx` | 시스템/라이트/다크 | 헤더 우측 |
| Ad Slot | `AdSlot.tsx` — 결과 하단 1개, `min-h-[100px]`, 라벨 "광고" | | 입력 화면·유료 사용자 미렌더 |
| Share Card (canvas) | 1200×630 · 배경 `--surface` · 브랜드 워드마크 · KPI 4 · 미니 곡선 · 고지 1줄 · 워터마크 `stocklab.tomatoeggcat.com` 우하단 | | 다크/라이트 2종 |

## 5. 차트 규약
| 항목 | 규칙 |
|---|---|
| 라이브러리 | 경량 SVG 직접 렌더(P1 계산기) → P2 `lightweight-charts` 또는 `recharts`(번들 ≤ 60KB 확인) |
| 색 | 전략 자산곡선 `--brand`, 벤치마크 `--muted` 점선, 드로다운 영역 `--down`/15% 채움, 비교 전략 최대 4개: brand, `#7c3aed`, `#0891b2`, `#ca8a04`(토큰화 `--series-2..4` 추가 시) |
| 축 | 금액 `억`/`만` 단위 축약(`1.2억`), % 1자리, 날짜 `'24.03` 축약 |
| 격자 | 수평선만, `--border` |
| 툴팁 | 카드 스타일, 값+날짜, 키보드 포커스 가능 |
| 히트맵(월별 수익) | 양수 `--up` 알파 스케일, 음수 `--down` 알파 스케일, 0 `--surface-2`, 셀에 숫자 표기(색만 금지) |
| 접근성 | `<svg role="img" aria-label="2016년부터 2026년까지 자산곡선, 최종 2.4배">` + 표로 대체 데이터 제공(접기) |
| 로그 스케일 | 10년 이상 백테스트 기본 로그, 토글 제공 |
| 애니메이션 | 진입 300ms 1회, `prefers-reduced-motion` 시 없음 |

## 6. 다크모드
- `.dark` 클래스(`ThemeScript`가 `localStorage.theme` → `prefers-color-scheme` 순으로 첫 페인트 전 적용). 토큰만 바뀌므로 컴포넌트는 색 하드코딩 금지.
- 이미지·공유 카드: 테마별 2종 생성. 차트 격자 대비 확인.
- 광고 슬롯: AdSense `data-color-*` 미지원 → 슬롯 컨테이너 배경을 `--surface`로.

## 7. 접근성 규칙 (WCAG 2.1 AA)
| 규칙 | 구현 |
|---|---|
| 대비 | 본문 4.5:1, 대형 3:1. `--muted` on `--surface-2` 확인(라이트 5.1:1, 다크 6.3:1) |
| 포커스 | 모든 인터랙티브 `focus-visible:ring-2 ring-brand/40` |
| 폼 | 모든 입력 `label for` · 오류 `aria-describedby` · 필수 표시 텍스트 |
| 표 | `caption`(시각 숨김) · `th scope` · 정렬 `aria-sort` · 가로 스크롤 컨테이너 `tabindex=0` |
| 상승/하락 | 부호 + `aria-label` |
| 라이브 영역 | 백테스트 진행률 `aria-live="polite"`, SSE 시세 `aria-live="off"`(잦음) |
| 모션 | `motion-reduce:` 변형 |
| 언어 | `<html lang="ko">` |
| 키보드 | 모달 포커스 트랩, ESC 닫기, 슬라이더 화살표 |

## 8. 숫자·날짜 표기 (`src/lib/format.ts` 기준)
| 항목 | 규칙 | 예 |
|---|---|---|
| 금액 | `Intl.NumberFormat('ko-KR')` 정수 원, 1억 이상은 `1.2억`, 표에서는 전체 자릿수 | `74,300원` / `시총 4,421억` |
| 비율 | 소수 1자리 + `%`, 부호 항상(등락) | `+2.3%` `−12.5%`(마이너스는 U+2212) |
| 배수 | 소수 2자리 + `배` | `PBR 0.72배` |
| 날짜 | 화면 `2026년 9월 1일` / 표 `2026-09-01` / 축 `'26.09` | `formatKoreanDate` |
| 시각 | KST 명시 `06:00 KST` | |
| 결측 | `–`(en dash) + 툴팁 "데이터 없음" | |
| 큰 수 축약 | 억·만 단위만, `K/M` 금지 | |

## 9. 카피 톤 & 금지 표현
| 항목 | 규칙 |
|---|---|
| 어조 | 존댓말 "~합니다/~하세요", 감탄·과장 없음, 이모지 UI 본문 금지(배지 아이콘 예외) |
| 주어 | "스톡랩은" 대신 기능 중심 "이 결과는", 사용자 지칭 "회원님" 금지 → 생략 |
| 확정 표현 금지 | "오를", "수익 낼", "안전한", "최고의" → "조건을 충족한", "과거 구간에서" |
| 금지 단어 (`scripts/check-expressions.mjs` BANNED 준수; 아래 단어들은 UI 사용 금지) | 매수 추천 · 매도 · 추천 종목 · 수익 보장 · 목표가 제시 · 급등 · 대박 · 리딩 · 필승 |
| 대체어 | 조건 충족 종목 · 스크리닝 결과 · 시그널(조건 충족) 발생 · 지정가 도달 알림 · 과거 시점 보유 목록 · 비중 계산 결과 |
| 버튼 | 동사형 2~5자: 조건 적용 · 실행 · 저장 · 복사 · 공유 · 업그레이드 |
| 빈 상태 | 원인 + 다음 행동 1개: "조건을 만족하는 종목이 없습니다. PER 상한을 15로 올려 보세요." |
| 오류 | 사과 1회 + 조치 + requestId: "결과를 불러오지 못했습니다. 다시 시도해 주세요. (req_…)" |
| 게임 | "재미용" 고지 필수: "오를까 내릴까는 재미용 예측 게임입니다." |
| 알림 본문 | 사실만, CTA는 "설정 보기"만. 프로모션 문구 금지 |
| 면책 | `SITE.disclaimer` 그대로, 편집은 `00-legal-expression-guide.md` 동기화 후 |
