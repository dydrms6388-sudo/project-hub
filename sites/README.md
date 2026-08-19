# sites/ — 독립 도구 사이트 10종

각 하위 폴더는 **완전히 독립된 Next.js 15 앱**이다. 허브(`tomatoeggcat.com`)의
`gen-pages.mjs` 정적 파이프라인과 무관하며, 각각 **별도의 Vercel 프로젝트 · 별도의 도메인**으로
배포된다. (`illusion-lab/` 과 같은 방식)

| 프로젝트 | 컨셉 | 기본 도메인 |
|---|---|---|
| `aitidy` | AI 답변 정리 (마크다운 제거·표 엑셀 변환 등) | `aitidy.vercel.app` |
| `pickfair` | 추첨·공정성 랩 (seed 로 재현되는 랜덤) | `pickfair.vercel.app` |
| `photolab-kr` | 아이폰 사진 랩 (HEIC 변환·EXIF) | `photolab-kr.vercel.app` |
| `bodycalc` | 건강·수면·영양 계산기 | `bodycalc.vercel.app` |
| `moneycalc-kr` | 재테크 계산기 허브 | `moneycalc-kr.vercel.app` |
| `pdfroom` | 브라우저 PDF 스위트 | `pdfroom.vercel.app` |
| `idphoto-kr` | 증명사진 제작기 | `idphoto-kr.vercel.app` |
| `clipforge` | 숏폼 미디어 랩 (ffmpeg.wasm) | `clipforge.vercel.app` |
| `dictate-kr` | 브라우저 Whisper 받아쓰기 | `dictate-kr.vercel.app` |
| `docmind-local` | 로컬 LLM 문서 요약 (WebGPU) | `docmind-local.vercel.app` |

개발 규칙은 [`AGENT-CONTRACT.md`](./AGENT-CONTRACT.md) 참조.

---

## 로컬 개발

```bash
cd sites/<project>
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 (Vercel 과 동일)
npm run export     # 정적 export (선배포 프리뷰와 동일)
```

## 선배포 프리뷰 (허브 리포에서 한 번에 보기)

허브 Vercel 프로젝트는 `outputDirectory: "."` 로 리포를 그대로 서빙한다.
따라서 정적 export 결과를 `preview/<project>/` 에 넣어두면
**브랜치 프리뷰 배포 URL** 에서 10개를 전부 열어볼 수 있다.

```bash
bash sites/build-preview.sh              # 전체
bash sites/build-preview.sh aitidy       # 일부만
node sites/make-preview-index.mjs        # preview/index.html 목차 생성
```

→ `<프리뷰 URL>/preview/` 에 목차, `<프리뷰 URL>/preview/<project>/` 에 각 사이트.

> 프리뷰는 **동작 확인용**이다. 응답 헤더가 필요한 기능(COOP/COEP 기반 SharedArrayBuffer
> 멀티스레드 등)은 하위 경로 정적 서빙에서는 켜지지 않고 단일 스레드로 폴백한다.
> 개별 Vercel 프로젝트로 배포하면 정상 동작한다.

---

## 각 사이트를 자체 도메인으로 배포하기 (Vercel)

이 리포 하나에서 10개 프로젝트를 만드는 방식이다. 리포를 쪼갤 필요 없다.

**1. 프로젝트 생성** — Vercel 대시보드 → *Add New… → Project* → 이 리포(`project-hub`) 선택

**2. Root Directory 지정** ← 가장 중요
   *Configure Project* 에서 **Root Directory = `sites/<project>`** 로 지정한다.
   (예: `sites/aitidy`) 그러면 Vercel 이 그 폴더만 Next.js 앱으로 빌드한다.
   Framework Preset 은 자동으로 **Next.js** 가 잡힌다. 빌드 명령은 건드리지 않는다.

**3. 도메인 연결** — *Settings → Domains* 에서 도메인 추가 후 DNS 를 Vercel 안내대로 설정.
   도메인을 붙였으면 `src/site.config.ts` 의 `url` / `domain` 을 그 주소로 바꿔야
   canonical · sitemap · OG 가 맞는다. **이 한 줄이 SEO 에 직결된다.**

**4. 환경변수** (선택)
   | 변수 | 용도 |
   |---|---|
   | `NEXT_PUBLIC_ADSENSE_CLIENT` | 애드센스 승인 후 설정. 없으면 광고 슬롯이 height 0 으로 렌더된다 |
   | `CROSS_ORIGIN_ISOLATION` | `1` 이면 COOP/COEP 헤더를 켠다. **`clipforge` 만 필요** |

**5. 10개 반복.** 2~5번을 프로젝트마다 반복한다.

### 배포 후 체크리스트 (사이트마다)
- [ ] 프로덕션 URL 열림, 도메인 연결
- [ ] `/sitemap.xml`, `/robots.txt` 응답 확인
- [ ] Google Search Console 등록 + sitemap 제출, 네이버 서치어드바이저 등록
- [ ] `/privacy/`, `/terms/` 문구 확인
- [ ] Lighthouse 모바일 성능 80+, 접근성 90+
- [ ] Vercel Analytics 켜기
- [ ] 라이브 시작일 기록 → 2~4주 후 AdSense 신청

> 애드센스는 **콘텐츠가 쌓인 뒤** 신청해야 통과율이 높다. 라이브 직후 신청하지 말 것.
