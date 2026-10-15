# DECISIONS — pseo-engine

## Phase 0 — 스키마 + 수집 워커 (current)

- **DA0.1 별도 워크스페이스.** ugc-platform과 같은 패턴으로 `pseo-engine/` 독립
  워크스페이스. 정적 사이트와 무접점. B에서 검증한 포트 주입 구조를 그대로 재사용.
- **DA0.2 키 없이 개발.** 공공데이터포털 키(`MOLIT_SERVICE_KEY`)는 소유자 발급
  사항이라, HTTP를 `HttpGet` 포트로 주입받아 픽스처 XML로 전 로직을 테스트한다.
  실키 스모크는 Phase 1(Supabase 스토어와 함께).
- **DA0.3 어댑터가 유일한 데이터셋 경계.** `DatasetAdapter { key, fetchBatch(scope,
  cursor) }` — 국토부 어댑터는 scope=시군구코드, cursor=계약월. 주유소 등 두 번째
  데이터셋은 이 인터페이스 구현 하나로 같은 스키마/수집기에 꽂힌다(프롬프트 Phase 4
  검증 목표를 처음부터 설계에 반영).
- **DA0.4 raw 우선 적재.** 원본을 `raw_records`에 (dataset, source_id) 자연키로
  적재 후 정규화 — 재처리 가능. 국토부 API가 고유 id를 안 주므로 자연키는
  시군구+월+단지+면적+일+가격+층 조합. raw 중복 = 이미 처리된 거래 → 정규화 스킵
  (재실행 멱등성의 근거, 테스트로 고정).
- **DA0.5 증분 커서는 배치 단위 저장.** 배치(한 달) 성공마다 커서 저장 — 중간 실패
  시 재시작 지점이 남고, 전체 재수집은 구조적으로 불가능. `maxBatches`로 폭주 방지.
- **DA0.6 백오프 정책.** 429/5xx → 1s·2s·4s·8s 지수백오프 후 포기. 그 외 4xx는
  즉시 실패(키 오류를 재시도로 가리지 않기). 페이지 간 200ms 지연으로 rate limit 준수.
- **DA0.7 data_score 임계치 = Low Value 방지 집행점.** 거래 3건 미만 → 0점 +
  `shouldCreatePage=false` (페이지 미생성, 상위 301 통합). 점수 = 거래량(log 포화)
  + 신선도(최근 90일 비중) + 하위 엔티티 수.
- **검증.** typecheck 무오류, vitest 10/10 (파싱·백오프·증분·멱등·임계치).
