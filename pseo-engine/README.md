# pseo-engine

**공공데이터 프로그래매틱 SEO 엔진** (아이디어 A). 공공데이터 API 하나를 꽂으면
SEO 최적화된 롱테일 페이지 수만 개를 자동 생성·갱신하는 재사용 엔진.
첫 데이터셋: **국토부 아파트 실거래가**.

> `ugc-platform/` 과 동일하게 **정적 사이트(tomatoeggcat)와 완전 분리**된 독립
> 워크스페이스. 정적 배포는 이 디렉터리를 건드리지 않는다.

## 상태 — Phase 0 완료 (스키마 + 수집 워커)

```
pseo-engine/
└─ packages/engine/        # @pseo/engine
   ├─ db/schema.sql        # regions/complexes/transactions/raw/page_registry/cursors
   └─ src/
      ├─ ports.ts          # EngineStore·DatasetAdapter·HttpGet (전부 주입식)
      ├─ adapters/molit-apt.ts   # 국토부 실거래가 (XML 파싱·지수백오프·월 커서)
      ├─ adapters/memory.ts      # 인메모리 스토어 (테스트/로컬)
      ├─ ingest.ts          # 증분 수집 오케스트레이션 (raw→지역계층→단지→거래)
      └─ data-score.ts      # 3건 미만 = 페이지 생성 금지 (Low Value 방지 집행점)
```

- **키 없이 전 로직 테스트 가능**: HTTP가 주입식이라 픽스처 XML로 10개 테스트 green.
- **증분 수집**: (dataset, scope)별 커서. 배치 성공마다 커서 저장 — 전체 재수집 금지.
- **어댑터 추상화**: 두 번째 데이터셋(주유소 등)은 `DatasetAdapter` 구현 하나로 꽂힌다.

## 실행 전제 (소유자 준비물)

- [ ] 공공데이터포털에서 실거래가 API 활용신청 → `MOLIT_SERVICE_KEY`
- [ ] Supabase Postgres + `db/schema.sql` 적용 (Phase 1에서 Supabase 스토어 구현)

## 다음 Phase

1. Supabase `EngineStore` + 실키 스모크(서울 1개 구 적재)
2. Next.js ISR 페이지 4계층 (`/apt/[sido]/…`) — SSG 금지, on-demand revalidate
3. sitemap 분할 + 색인 파이프라인 (Search Console 연동)
4. 두 번째 데이터셋로 어댑터 추상화 검증

## 개발

```bash
cd pseo-engine && npm install
npm run typecheck && npm test
```
