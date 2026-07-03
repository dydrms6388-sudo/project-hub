# PRISM 크러시 카드 — AI 일러스트 제작 가이드

작성일: 2026-07-03
목적: 카드 128장을 생성형 AI(Midjourney / SDXL / NovelAI 등)로 제작해 절차적 SVG를 교체.

## 파이프라인 (이미 앱에 연결되어 있음)

1. 아래 프롬프트로 이미지 생성 (권장 1024×1382, 비율 200:270)
2. 파일명을 카드 ID로 저장: `prism/art/c001.webp` (webp 권장, 200KB 이하)
3. `node prism/gen-art-manifest.mjs` 실행 → art-manifest.js 자동 갱신
4. 배포하면 해당 카드는 자동으로 일러스트 렌더링 (없는 카드는 SVG 폴백)

## 아트 디렉션 (전 카드 공통)

- **스타일**: 한국·일본 게이 망가/바라 풍의 성인 남성, 굵은 선의 세련된 셀셰이딩 애니 일러스트
- **구도**: 상반신 버스트 컷, 정면~약 15도, 시선은 카메라 (하단 22%는 정보 오버레이가 덮으므로 얼굴을 상단 55%에 배치)
- **수위**: 전연령 광고 정책 준수 — 탈의 금지(수영·씨름은 스포츠 유니폼 컨텍스트), 선정적 포즈 금지
- **금지**: 실존 인물 유사, 미성년 외모, 워터마크, 텍스트
- **공통 네거티브 프롬프트**: `text, watermark, extra fingers, deformed hands, child, feminine face, photorealistic`

### 등급별 연출
| 등급 | 연출 |
|---|---|
| N (56장) | 깔끔한 셀셰이딩, 단색 배경 그라데이션 |
| R (36장) | 림라이트 + 배경 모티프 강조 |
| SR (24장) | 드라마틱 조명 + 발광 파티클 |
| SSR (12장) | 시네마틱, 홀로그램/무지개빛 이펙트, 최고 디테일 |

## 카드별 프롬프트 (128장)

### c01 · 도윤 (N) — 26세 바리스타 [fit]
```
handsome korean man in his 20s (age 26), 바리스타, fit athletic build, wearing work apron, warm smiling eyes, gentle smile, bust portrait facing viewer, starry night sky background with #8b5cf6 and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c02 · 하람 (N) — 23세 대학생 [slim]
```
handsome korean man in his 20s (age 23), 대학생, slim toned build, wearing fitted t-shirt, confident gaze, bright grin, bust portrait facing viewer, starry night sky background with #3b82f6 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c03 · 은호 (N) — 29세 서점 직원 [slim]
```
handsome korean man in his 20s (age 29), 서점 직원, slim toned build, wearing button-up shirt, warm smiling eyes, gentle smile, bust portrait facing viewer, starry night sky background with #2dd4bf and #0d9488 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c04 · 시우 (N) — 31세 요가 강사 [muscular]
```
handsome korean man in his 30s (age 31), 요가 강사, muscular broad-shouldered build, wearing tank top, warm smiling eyes, gentle smile, light stubble, bust portrait facing viewer, starry night sky background with #34d399 and #059669 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c05 · 로운 (N) — 27세 플로리스트 [fit]
```
handsome korean man in his 20s (age 27), 플로리스트, fit athletic build, wearing button-up shirt, confident gaze, gentle smile, bust portrait facing viewer, starry night sky background with #f472b6 and #db2777 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c06 · 재이 (N) — 28세 사진작가 [fit]
```
handsome korean man in his 20s (age 28), 사진작가, fit athletic build, wearing fitted t-shirt, confident gaze, charming smirk, light stubble, bust portrait facing viewer, starry night sky background with #94a3b8 and #475569 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c07 · 태오 (R) — 33세 셰프 [bulky]
```
handsome korean man in his 30s (age 33), 셰프, big burly bear build, thick muscles, wearing chef whites, confident gaze, bright grin, light stubble, bust portrait facing viewer, starry night sky background with #f59e0b and #d97706 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c08 · 무진 (R) — 30세 필라테스 코치 [muscular]
```
handsome korean man in his 30s (age 30), 필라테스 코치, muscular broad-shouldered build, wearing tank top, playful wink, charming smirk, bust portrait facing viewer, starry night sky background with #f43f5e and #be123c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c09 · 반 (R) — 27세 DJ [fit]
```
handsome korean man in his 20s (age 27), DJ, fit athletic build, wearing fitted t-shirt, playful wink, bright grin, light stubble, bust portrait facing viewer, starry night sky background with #0ea5e9 and #0369a1 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c10 · 제노 (R) — 34세 바텐더 [fit]
```
handsome korean man in his 30s (age 34), 바텐더, fit athletic build, wearing bartender vest with tie, confident gaze, charming smirk, light stubble, bust portrait facing viewer, starry night sky background with #a855f7 and #7e22ce tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c11 · 늘봄 (R) — 32세 수의사 [fit]
```
handsome korean man in his 30s (age 32), 수의사, fit athletic build, wearing medical scrubs, warm smiling eyes, gentle smile, bust portrait facing viewer, starry night sky background with #22c55e and #15803d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c12 · 강토 (SR) — 36세 소방관 [bulky]
```
handsome korean man in his 30s (age 36), 소방관, big burly bear build, thick muscles, wearing firefighter turnout gear with suspenders, confident gaze, bright grin, light stubble, bust portrait facing viewer, starry night sky background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c13 · 파도 (SR) — 29세 수영 코치 [muscular]
```
handsome korean man in his 20s (age 29), 수영 코치, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, bust portrait facing viewer, starry night sky background with #38bdf8 and #2563eb tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c14 · 윤슬 (SR) — 38세 파일럿 [fit]
```
handsome korean man in his 30s (age 38), 파일럿, fit athletic build, wearing pilot uniform with epaulettes, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, starry night sky background with #818cf8 and #4f46e5 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c15 · 세인트 (SSR) — 24세 아이돌 [slim]
```
handsome korean man in his 20s (age 24), k-pop idol, slim toned build, wearing stage idol outfit with sparkles, playful wink, gentle smile, bust portrait facing viewer, starry night sky background with #e879f9 and #8b5cf6 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c16 · 느와르 (SSR) — 26세 발레리노 [slim]
```
handsome korean man in his 20s (age 26), 발레리노, slim toned build, wearing black dance leotard, confident gaze, charming smirk, bust portrait facing viewer, starry night sky background with #f5f5f5 and #71717a tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c017 · 준서 (N) — 20세 항해사 [slim]
```
handsome korean man in his 20s (age 20), 항해사, slim toned build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, light stubble, bust portrait facing viewer, starry night sky background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c018 · 민재 (R) — 31세 물리치료사 [fit]
```
handsome korean man in his 30s (age 31), 물리치료사, fit athletic build, wearing medical scrubs, playful wink, bright grin, bust portrait facing viewer, floating music notes background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c019 · 지호 (SSR) — 42세 스트리머 [muscular]
```
handsome korean man in his 40s (age 42), 스트리머, muscular broad-shouldered build, wearing hoodie, warm smiling eyes, charming smirk, bust portrait facing viewer, night city skyline with lights background with #f5f5f5 and #71717a tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c020 · 태윤 (N) — 23세 소믈리에 [fit]
```
handsome korean man in his 20s (age 23), 소믈리에, fit athletic build, wearing bartender vest with tie, confident gaze, gentle smile, bust portrait facing viewer, falling flower petals background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c021 · 서진 (SR) — 34세 골키퍼 [fit]
```
handsome korean man in his 30s (age 34), 골키퍼, fit athletic build, wearing soccer jersey number 10, playful wink, bright grin, bust portrait facing viewer, soft bokeh lights background with #c084fc and #7c3aed tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c022 · 도현 (N) — 45세 교사 [fit]
```
handsome korean man in his 40s (age 45), 교사, fit athletic build, wearing button-up shirt, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, ocean waves background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c023 · 건우 (SR) — 26세 경호원 [bulky]
```
handsome korean man in his 20s (age 26), 경호원, big burly bear build, thick muscles, wearing tailored suit with tie, confident gaze, gentle smile, light stubble, bust portrait facing viewer, dramatic light rays background with #22d3ee and #4f46e5 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c024 · 현서 (N) — 37세 브런치 셰프 [fit]
```
handsome korean man in his 30s (age 37), 브런치 셰프, fit athletic build, wearing chef whites, playful wink, bright grin, bust portrait facing viewer, snowy mountain peaks background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c025 · 지완 (SR) — 48세 온천 마을 안내인 [muscular]
```
handsome korean man in his 40s (age 48), 온천 마을 안내인, muscular broad-shouldered build, wearing yukata with obi belt, warm smiling eyes, charming smirk, bust portrait facing viewer, falling flower petals background with #c084fc and #7c3aed tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c026 · 태민 (N) — 29세 뮤지컬 배우 [fit]
```
handsome korean man in his 20s (age 29), 뮤지컬 배우, fit athletic build, wearing stage idol outfit with sparkles, confident gaze, gentle smile, bust portrait facing viewer, floating music notes background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c027 · 유찬 (SR) — 40세 럭비 선수 [bulky]
```
handsome korean man in his 40s (age 40), 럭비 선수, big burly bear build, thick muscles, wearing tank top, playful wink, bright grin, light stubble, bust portrait facing viewer, night city skyline with lights background with #22d3ee and #4f46e5 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c028 · 승우 (N) — 21세 수영 선수 [muscular]
```
handsome korean man in his 20s (age 21), 수영 선수, muscular broad-shouldered build, wearing competitive swimmer with goggles on forehead, athletic torso, warm smiling eyes, charming smirk, bust portrait facing viewer, ocean waves background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c029 · 민혁 (R) — 32세 승무원 [muscular]
```
handsome korean man in his 30s (age 32), 승무원, muscular broad-shouldered build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, bust portrait facing viewer, soft bokeh lights background with #f472b6 and #be185d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c030 · 정우 (N) — 43세 한의사 [fit]
```
handsome korean man in his 40s (age 43), 한의사, fit athletic build, wearing medical scrubs, playful wink, bright grin, bust portrait facing viewer, ocean waves background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c031 · 시온 (R) — 24세 힙합 프로듀서 [fit]
```
handsome korean man in his 20s (age 24), 힙합 프로듀서, fit athletic build, wearing hoodie, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, dramatic light rays background with #fb923c and #c2410c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c032 · 하진 (N) — 35세 재즈 피아니스트 [fit]
```
handsome korean man in his 30s (age 35), 재즈 피아니스트, fit athletic build, wearing bartender vest with tie, confident gaze, gentle smile, light stubble, bust portrait facing viewer, snowy mountain peaks background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c033 · 예준 (R) — 46세 농구 선수 [muscular]
```
handsome korean man in his 40s (age 46), 농구 선수, muscular broad-shouldered build, wearing sleeveless basketball jersey number 23, playful wink, bright grin, bust portrait facing viewer, starry night sky background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c034 · 주원 (N) — 27세 플로리스트 [fit]
```
handsome korean man in his 20s (age 27), 플로리스트, fit athletic build, wearing button-up shirt, warm smiling eyes, charming smirk, bust portrait facing viewer, floating music notes background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c035 · 지안 (R) — 38세 변호사 [muscular]
```
handsome korean man in his 30s (age 38), 변호사, muscular broad-shouldered build, wearing tailored suit with tie, confident gaze, gentle smile, bust portrait facing viewer, night city skyline with lights background with #a78bfa and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c036 · 선우 (SSR) — 49세 정육 장인 [bulky]
```
handsome korean man in his 40s (age 49), 정육 장인, big burly bear build, thick muscles, wearing work apron, playful wink, bright grin, light stubble, bust portrait facing viewer, falling flower petals background with #34d399 and #38bdf8 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c037 · 은찬 (R) — 24세 체대생 [slim]
```
handsome korean man in his 20s (age 24), 체대생, slim toned build, wearing gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, soft bokeh lights background with #38bdf8 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c038 · 강민 (SSR) — 41세 인디 보컬 [fit]
```
handsome korean man in his 40s (age 41), 인디 보컬, fit athletic build, wearing stage idol outfit with sparkles, confident gaze, gentle smile, bust portrait facing viewer, ocean waves background with #e879f9 and #8b5cf6 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c039 · 태양 (N) — 22세 배구 선수 [muscular]
```
handsome korean man in his 20s (age 22), 배구 선수, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, bust portrait facing viewer, dramatic light rays background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c040 · 다온 (SR) — 33세 다이빙 선수 [muscular]
```
handsome korean man in his 30s (age 33), 다이빙 선수, muscular broad-shouldered build, wearing competitive swimmer with goggles on forehead, athletic torso, warm smiling eyes, charming smirk, bust portrait facing viewer, ocean waves background with #f43f5e and #7e22ce tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c041 · 라온 (N) — 44세 기관사 [fit]
```
handsome korean man in his 40s (age 44), 기관사, fit athletic build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, bust portrait facing viewer, starry night sky background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c042 · 시원 (SR) — 25세 치과의사 [fit]
```
handsome korean man in his 20s (age 25), 치과의사, fit athletic build, wearing medical scrubs, playful wink, bright grin, light stubble, bust portrait facing viewer, floating music notes background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c043 · 무영 (N) — 36세 태권도 사범 [muscular]
```
handsome korean man in his 30s (age 36), 태권도 사범, muscular broad-shouldered build, wearing taekwondo dobok with black collar, warm smiling eyes, charming smirk, bust portrait facing viewer, night city skyline with lights background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c044 · 찬영 (SR) — 47세 마술사 [fit]
```
handsome korean man in his 40s (age 47), 마술사, fit athletic build, wearing bartender vest with tie, confident gaze, gentle smile, bust portrait facing viewer, falling flower petals background with #f43f5e and #7e22ce tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c045 · 세준 (N) — 28세 스트릿볼러 [muscular]
```
handsome korean man in his 20s (age 28), 스트릿볼러, muscular broad-shouldered build, wearing sleeveless basketball jersey number 23, playful wink, bright grin, bust portrait facing viewer, soft bokeh lights background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c046 · 우진 (SR) — 39세 여행 가이드 [slim]
```
handsome korean man in his 30s (age 39), 여행 가이드, slim toned build, wearing fitted t-shirt, warm smiling eyes, charming smirk, bust portrait facing viewer, ocean waves background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c047 · 한결 (N) — 20세 회계사 [slim]
```
handsome korean man in his 20s (age 20), 회계사, slim toned build, wearing tailored suit with tie, confident gaze, gentle smile, light stubble, bust portrait facing viewer, dramatic light rays background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c048 · 온유 (R) — 31세 도예가 [fit]
```
handsome korean man in his 30s (age 31), 도예가, fit athletic build, wearing work apron, playful wink, bright grin, bust portrait facing viewer, snowy mountain peaks background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c049 · 강현 (N) — 24세 미대생 [slim]
```
handsome korean man in his 20s (age 24), 미대생, slim toned build, wearing gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, bust portrait facing viewer, starry night sky background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c050 · 해성 (R) — 23세 건축가 [fit]
```
handsome korean man in his 20s (age 23), 건축가, fit athletic build, wearing button-up shirt, confident gaze, gentle smile, bust portrait facing viewer, floating music notes background with #a78bfa and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c051 · 도영 (N) — 34세 서퍼 [muscular]
```
handsome korean man in his 30s (age 34), 서퍼, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, bust portrait facing viewer, night city skyline with lights background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c052 · 이안 (R) — 45세 철인3종 선수 [muscular]
```
handsome korean man in his 40s (age 45), 철인3종 선수, muscular broad-shouldered build, wearing competitive swimmer with goggles on forehead, athletic torso, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, ocean waves background with #38bdf8 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c053 · 서준 (N) — 26세 드론 조종사 [bulky]
```
handsome korean man in his 20s (age 26), 드론 조종사, big burly bear build, thick muscles, wearing pilot uniform with epaulettes, confident gaze, gentle smile, bust portrait facing viewer, soft bokeh lights background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c054 · 하율 (R) — 37세 간호사 [fit]
```
handsome korean man in his 30s (age 37), 간호사, fit athletic build, wearing medical scrubs, playful wink, bright grin, bust portrait facing viewer, ocean waves background with #f472b6 and #be185d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c055 · 지율 (SSR) — 48세 태권도 국가대표 [muscular]
```
handsome korean man in his 40s (age 48), 태권도 국가대표, muscular broad-shouldered build, wearing taekwondo dobok with black collar, warm smiling eyes, charming smirk, bust portrait facing viewer, dramatic light rays background with #f5f5f5 and #71717a tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c056 · 연우 (R) — 29세 호텔리어 [slim]
```
handsome korean man in his 20s (age 29), 호텔리어, slim toned build, wearing bartender vest with tie, confident gaze, gentle smile, bust portrait facing viewer, snowy mountain peaks background with #fb923c and #c2410c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c057 · 시현 (SSR) — 40세 배드민턴 선수 [slim]
```
handsome korean man in his 40s (age 40), 배드민턴 선수, slim toned build, wearing badminton polo shirt, playful wink, bright grin, light stubble, bust portrait facing viewer, starry night sky background with #fbbf24 and #f472b6 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c058 · 준영 (N) — 21세 사진작가 [fit]
```
handsome korean man in his 20s (age 21), 사진작가, fit athletic build, wearing fitted t-shirt, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, floating music notes background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c059 · 태호 (SR) — 32세 아나운서 [muscular]
```
handsome korean man in his 30s (age 32), 아나운서, muscular broad-shouldered build, wearing tailored suit with tie, confident gaze, gentle smile, bust portrait facing viewer, night city skyline with lights background with #22d3ee and #4f46e5 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c060 · 동하 (N) — 43세 플랜트 집사 [fit]
```
handsome korean man in his 40s (age 43), 플랜트 집사, fit athletic build, wearing work apron, playful wink, bright grin, bust portrait facing viewer, falling flower petals background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c061 · 루안 (SR) — 24세 공대생 [slim]
```
handsome korean man in his 20s (age 24), 공대생, slim toned build, wearing gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, bust portrait facing viewer, soft bokeh lights background with #c084fc and #7c3aed tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c062 · 현빈 (N) — 35세 큐레이터 [fit]
```
handsome korean man in his 30s (age 35), 큐레이터, fit athletic build, wearing button-up shirt, confident gaze, gentle smile, light stubble, bust portrait facing viewer, ocean waves background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c063 · 승현 (SR) — 46세 인명구조원 [muscular]
```
handsome korean man in his 40s (age 46), 인명구조원, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, bust portrait facing viewer, dramatic light rays background with #22d3ee and #4f46e5 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c064 · 지훈 (N) — 27세 씨름 선수 [bulky]
```
handsome korean man in his 20s (age 27), 씨름 선수, big burly bear build, thick muscles, wearing korean ssireum wrestler with satba sash, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, snowy mountain peaks background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c065 · 민규 (R) — 38세 국악인 [bulky]
```
handsome korean man in his 30s (age 38), 국악인, big burly bear build, thick muscles, wearing martial arts gi, confident gaze, gentle smile, bust portrait facing viewer, starry night sky background with #a78bfa and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c066 · 성진 (N) — 49세 약사 [slim]
```
handsome korean man in his 40s (age 49), 약사, slim toned build, wearing medical scrubs, playful wink, bright grin, bust portrait facing viewer, floating music notes background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c067 · 윤재 (R) — 30세 유도 선수 [muscular]
```
handsome korean man in his 30s (age 30), 유도 선수, muscular broad-shouldered build, wearing martial arts gi, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, night city skyline with lights background with #38bdf8 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c068 · 경수 (N) — 41세 소방관 [bulky]
```
handsome korean man in his 40s (age 41), 소방관, big burly bear build, thick muscles, wearing firefighter turnout gear with suspenders, confident gaze, gentle smile, light stubble, bust portrait facing viewer, falling flower petals background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c069 · 형준 (R) — 22세 탁구 선수 [muscular]
```
handsome korean man in his 20s (age 22), 탁구 선수, muscular broad-shouldered build, wearing badminton polo shirt, playful wink, bright grin, bust portrait facing viewer, soft bokeh lights background with #f472b6 and #be185d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c070 · 재윤 (N) — 33세 반려견 훈련사 [fit]
```
handsome korean man in his 30s (age 33), 반려견 훈련사, fit athletic build, wearing fitted t-shirt, warm smiling eyes, charming smirk, bust portrait facing viewer, ocean waves background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c071 · 호진 (R) — 44세 웹툰 작가 [fit]
```
handsome korean man in his 40s (age 44), 웹툰 작가, fit athletic build, wearing hoodie, confident gaze, gentle smile, bust portrait facing viewer, dramatic light rays background with #fb923c and #c2410c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c072 · 범준 (N) — 25세 조향사 [fit]
```
handsome korean man in his 20s (age 25), 조향사, fit athletic build, wearing work apron, playful wink, bright grin, light stubble, bust portrait facing viewer, snowy mountain peaks background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c073 · 석현 (R) — 24세 음대생 [slim]
```
handsome korean man in his 20s (age 24), 음대생, slim toned build, wearing gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, bust portrait facing viewer, starry night sky background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c074 · 진우 (SSR) — 47세 사서 [fit]
```
handsome korean man in his 40s (age 47), 사서, fit athletic build, wearing button-up shirt, confident gaze, gentle smile, bust portrait facing viewer, floating music notes background with #e879f9 and #8b5cf6 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c075 · 규현 (R) — 28세 복싱 코치 [muscular]
```
handsome korean man in his 20s (age 28), 복싱 코치, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, light stubble, bust portrait facing viewer, night city skyline with lights background with #a78bfa and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c076 · 상윤 (SSR) — 39세 씨름 천하장사 [bulky]
```
handsome korean man in his 30s (age 39), 씨름 천하장사, big burly bear build, thick muscles, wearing korean ssireum wrestler with satba sash, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, falling flower petals background with #34d399 and #38bdf8 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c077 · 태검 (N) — 20세 발레 강사 [fit]
```
handsome korean man in his 20s (age 20), 발레 강사, fit athletic build, wearing black dance leotard, confident gaze, gentle smile, light stubble, bust portrait facing viewer, soft bokeh lights background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c078 · 백호 (SR) — 31세 헬스 트레이너 [muscular]
```
handsome korean man in his 30s (age 31), 헬스 트레이너, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, light stubble, bust portrait facing viewer, ocean waves background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c079 · 천둥 (N) — 42세 검도 사범 [muscular]
```
handsome korean man in his 40s (age 42), 검도 사범, muscular broad-shouldered build, wearing martial arts gi, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, dramatic light rays background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c080 · 마루 (SR) — 23세 산악구조대 [bulky]
```
handsome korean man in his 20s (age 23), 산악구조대, big burly bear build, thick muscles, wearing firefighter turnout gear with suspenders, confident gaze, gentle smile, light stubble, bust portrait facing viewer, snowy mountain peaks background with #f43f5e and #7e22ce tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c081 · 바다 (N) — 34세 테니스 코치 [fit]
```
handsome korean man in his 30s (age 34), 테니스 코치, fit athletic build, wearing badminton polo shirt, playful wink, bright grin, bust portrait facing viewer, starry night sky background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c082 · 산들 (SR) — 45세 목수 [bulky]
```
handsome korean man in his 40s (age 45), 목수, big burly bear build, thick muscles, wearing fitted t-shirt, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, floating music notes background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c083 · 노을 (N) — 26세 게임 개발자 [bulky]
```
handsome korean man in his 20s (age 26), 게임 개발자, big burly bear build, thick muscles, wearing hoodie, confident gaze, gentle smile, bust portrait facing viewer, night city skyline with lights background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c084 · 가온 (R) — 37세 수제맥주 브루어 [bulky]
```
handsome korean man in his 30s (age 37), 수제맥주 브루어, big burly bear build, thick muscles, wearing work apron, playful wink, bright grin, light stubble, bust portrait facing viewer, falling flower petals background with #f472b6 and #be185d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c085 · 새벽 (N) — 48세 축구 선수 [muscular]
```
handsome korean man in his 40s (age 48), 축구 선수, muscular broad-shouldered build, wearing soccer jersey number 10, warm smiling eyes, charming smirk, bust portrait facing viewer, soft bokeh lights background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c086 · 여름 (R) — 29세 통역사 [slim]
```
handsome korean man in his 20s (age 29), 통역사, slim toned build, wearing button-up shirt, confident gaze, gentle smile, bust portrait facing viewer, ocean waves background with #fb923c and #c2410c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c087 · 겨울 (N) — 40세 파티시에 [slim]
```
handsome korean man in his 40s (age 40), 파티시에, slim toned build, wearing chef whites, playful wink, bright grin, light stubble, bust portrait facing viewer, dramatic light rays background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c088 · 우람 (R) — 21세 료칸 지배인 [fit]
```
handsome korean man in his 20s (age 21), 료칸 지배인, fit athletic build, wearing yukata with obi belt, warm smiling eyes, charming smirk, bust portrait facing viewer, falling flower petals background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c089 · 힘찬 (N) — 32세 현대무용수 [fit]
```
handsome korean man in his 30s (age 32), 현대무용수, fit athletic build, wearing black dance leotard, confident gaze, gentle smile, bust portrait facing viewer, starry night sky background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c090 · 슬기 (R) — 43세 크로스핏 코치 [muscular]
```
handsome korean man in his 40s (age 43), 크로스핏 코치, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, light stubble, bust portrait facing viewer, floating music notes background with #a78bfa and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c091 · 보검 (N) — 24세 주짓수 코치 [muscular]
```
handsome korean man in his 20s (age 24), 주짓수 코치, muscular broad-shouldered build, wearing martial arts gi, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, night city skyline with lights background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c092 · 한울 (R) — 35세 해양경찰 [fit]
```
handsome korean man in his 30s (age 35), 해양경찰, fit athletic build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, light stubble, bust portrait facing viewer, falling flower petals background with #38bdf8 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c093 · 누리 (SSR) — 46세 응급구조사 [bulky]
```
handsome korean man in his 40s (age 46), 응급구조사, big burly bear build, thick muscles, wearing medical scrubs, playful wink, bright grin, bust portrait facing viewer, soft bokeh lights background with #fbbf24 and #f472b6 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c094 · 아라 (N) — 27세 자동차 정비사 [fit]
```
handsome korean man in his 20s (age 27), 자동차 정비사, fit athletic build, wearing fitted t-shirt, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, ocean waves background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c095 · 도담 (SSR) — 38세 프로게이머 [muscular]
```
handsome korean man in his 30s (age 38), 프로게이머, muscular broad-shouldered build, wearing hoodie, confident gaze, gentle smile, bust portrait facing viewer, dramatic light rays background with #f5f5f5 and #71717a tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c096 · 벼리 (N) — 49세 바리스타 [slim]
```
handsome korean man in his 40s (age 49), 바리스타, slim toned build, wearing work apron, playful wink, bright grin, bust portrait facing viewer, snowy mountain peaks background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c097 · 믿음 (SR) — 30세 풋살 코치 [slim]
```
handsome korean man in his 30s (age 30), 풋살 코치, slim toned build, wearing soccer jersey number 10, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, starry night sky background with #c084fc and #7c3aed tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c098 · 기람 (N) — 41세 천문학자 [fit]
```
handsome korean man in his 40s (age 41), 천문학자, fit athletic build, wearing button-up shirt, confident gaze, gentle smile, bust portrait facing viewer, floating music notes background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c099 · 솔찬 (SR) — 22세 스시 셰프 [muscular]
```
handsome korean man in his 20s (age 22), 스시 셰프, muscular broad-shouldered build, wearing chef whites, playful wink, bright grin, light stubble, bust portrait facing viewer, night city skyline with lights background with #22d3ee and #4f46e5 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c100 · 윤슬비 (N) — 33세 유카타 찻집 주인 [fit]
```
handsome korean man in his 30s (age 33), 유카타 찻집 주인, fit athletic build, wearing yukata with obi belt, warm smiling eyes, charming smirk, bust portrait facing viewer, falling flower petals background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c101 · 담율 (SR) — 44세 배우 [fit]
```
handsome korean man in his 40s (age 44), 배우, fit athletic build, wearing stage idol outfit with sparkles, confident gaze, gentle smile, bust portrait facing viewer, soft bokeh lights background with #c084fc and #7c3aed tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c102 · 현담 (N) — 25세 클라이밍 강사 [muscular]
```
handsome korean man in his 20s (age 25), 클라이밍 강사, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, light stubble, bust portrait facing viewer, ocean waves background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c103 · 무결 (R) — 36세 합기도 사범 [muscular]
```
handsome korean man in his 30s (age 36), 합기도 사범, muscular broad-shouldered build, wearing martial arts gi, warm smiling eyes, charming smirk, bust portrait facing viewer, dramatic light rays background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c104 · 서강 (N) — 47세 항해사 [fit]
```
handsome korean man in his 40s (age 47), 항해사, fit athletic build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, light stubble, bust portrait facing viewer, snowy mountain peaks background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c105 · 한별 (R) — 28세 물리치료사 [muscular]
```
handsome korean man in his 20s (age 28), 물리치료사, muscular broad-shouldered build, wearing medical scrubs, playful wink, bright grin, bust portrait facing viewer, starry night sky background with #a78bfa and #6d28d9 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c106 · 은결 (N) — 39세 스트리머 [slim]
```
handsome korean man in his 30s (age 39), 스트리머, slim toned build, wearing hoodie, warm smiling eyes, charming smirk, bust portrait facing viewer, floating music notes background with #78716c and #44403c tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c107 · 도하 (R) — 20세 소믈리에 [slim]
```
handsome korean man in his 20s (age 20), 소믈리에, slim toned build, wearing bartender vest with tie, confident gaze, gentle smile, light stubble, bust portrait facing viewer, night city skyline with lights background with #38bdf8 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c108 · 류진 (N) — 31세 골키퍼 [fit]
```
handsome korean man in his 30s (age 31), 골키퍼, fit athletic build, wearing soccer jersey number 10, playful wink, bright grin, bust portrait facing viewer, falling flower petals background with #8b5cf6 and #4c1d95 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c109 · 백현 (R) — 42세 교사 [muscular]
```
handsome korean man in his 40s (age 42), 교사, muscular broad-shouldered build, wearing button-up shirt, warm smiling eyes, charming smirk, bust portrait facing viewer, soft bokeh lights background with #f472b6 and #be185d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c110 · 시우진 (N) — 23세 경호원 [fit]
```
handsome korean man in his 20s (age 23), 경호원, fit athletic build, wearing tailored suit with tie, confident gaze, gentle smile, light stubble, bust portrait facing viewer, ocean waves background with #10b981 and #065f46 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c111 · 강토르 (R) — 34세 브런치 셰프 [fit]
```
handsome korean man in his 30s (age 34), 브런치 셰프, fit athletic build, wearing chef whites, playful wink, bright grin, bust portrait facing viewer, dramatic light rays background with #fb923c and #c2410c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c112 · 제이 (SSR) — 45세 온천 마을 안내인 [fit]
```
handsome korean man in his 40s (age 45), 온천 마을 안내인, fit athletic build, wearing yukata with obi belt, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, falling flower petals background with #34d399 and #38bdf8 tones, bara manga style, mature masculine anime art, thick clean lineart, masterpiece quality, cinematic lighting, iridescent holographic accents, ornate atmosphere, SFW, fully clothed sportswear context --ar 200:270
```

### c113 · 카이 (N) — 26세 뮤지컬 배우 [fit]
```
handsome korean man in his 20s (age 26), 뮤지컬 배우, fit athletic build, wearing stage idol outfit with sparkles, confident gaze, gentle smile, bust portrait facing viewer, starry night sky background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c114 · 레오 (SR) — 37세 럭비 선수 [bulky]
```
handsome korean man in his 30s (age 37), 럭비 선수, big burly bear build, thick muscles, wearing tank top, playful wink, bright grin, light stubble, bust portrait facing viewer, floating music notes background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c115 · 노아 (N) — 48세 수영 선수 [muscular]
```
handsome korean man in his 40s (age 48), 수영 선수, muscular broad-shouldered build, wearing competitive swimmer with goggles on forehead, athletic torso, warm smiling eyes, charming smirk, bust portrait facing viewer, ocean waves background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c116 · 단 (SR) — 29세 승무원 [slim]
```
handsome korean man in his 20s (age 29), 승무원, slim toned build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, bust portrait facing viewer, falling flower petals background with #f43f5e and #7e22ce tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c117 · 률 (N) — 40세 한의사 [slim]
```
handsome korean man in his 40s (age 40), 한의사, slim toned build, wearing medical scrubs, playful wink, bright grin, light stubble, bust portrait facing viewer, soft bokeh lights background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c118 · 혁 (SR) — 21세 힙합 프로듀서 [fit]
```
handsome korean man in his 20s (age 21), 힙합 프로듀서, fit athletic build, wearing hoodie, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, ocean waves background with #f97316 and #dc2626 tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c119 · 검 (N) — 32세 재즈 피아니스트 [muscular]
```
handsome korean man in his 30s (age 32), 재즈 피아니스트, muscular broad-shouldered build, wearing bartender vest with tie, confident gaze, gentle smile, bust portrait facing viewer, dramatic light rays background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c120 · 웅 (SR) — 43세 농구 선수 [muscular]
```
handsome korean man in his 40s (age 43), 농구 선수, muscular broad-shouldered build, wearing sleeveless basketball jersey number 23, playful wink, bright grin, bust portrait facing viewer, snowy mountain peaks background with #f43f5e and #7e22ce tones, bara manga style, mature masculine anime art, thick clean lineart, highly detailed shading, dramatic rim light, glowing particles, SFW, fully clothed sportswear context --ar 200:270
```

### c121 · 산하 (N) — 24세 플로리스트 [fit]
```
handsome korean man in his 20s (age 24), 플로리스트, fit athletic build, wearing button-up shirt, warm smiling eyes, charming smirk, bust portrait facing viewer, starry night sky background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c122 · 도원 (R) — 35세 변호사 [fit]
```
handsome korean man in his 30s (age 35), 변호사, fit athletic build, wearing tailored suit with tie, confident gaze, gentle smile, light stubble, bust portrait facing viewer, floating music notes background with #38bdf8 and #1d4ed8 tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c123 · 해린 (N) — 46세 정육 장인 [bulky]
```
handsome korean man in his 40s (age 46), 정육 장인, big burly bear build, thick muscles, wearing work apron, playful wink, bright grin, light stubble, bust portrait facing viewer, night city skyline with lights background with #3b82f6 and #1e3a8a tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c124 · 무현 (R) — 21세 체대생 [slim]
```
handsome korean man in his 20s (age 21), 체대생, slim toned build, wearing gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, bust portrait facing viewer, falling flower petals background with #f472b6 and #be185d tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c125 · 강율 (N) — 38세 인디 보컬 [fit]
```
handsome korean man in his 30s (age 38), 인디 보컬, fit athletic build, wearing stage idol outfit with sparkles, confident gaze, gentle smile, bust portrait facing viewer, soft bokeh lights background with #64748b and #334155 tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c126 · 은호수 (R) — 49세 배구 선수 [muscular]
```
handsome korean man in his 40s (age 49), 배구 선수, muscular broad-shouldered build, wearing tank top, playful wink, bright grin, bust portrait facing viewer, ocean waves background with #fb923c and #c2410c tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

### c127 · 별하 (N) — 30세 다이빙 선수 [muscular]
```
handsome korean man in his 30s (age 30), 다이빙 선수, muscular broad-shouldered build, wearing competitive swimmer with goggles on forehead, athletic torso, warm smiling eyes, charming smirk, light stubble, bust portrait facing viewer, ocean waves background with #f59e0b and #92400e tones, bara manga style, mature masculine anime art, thick clean lineart, clean cel shading, SFW, fully clothed sportswear context --ar 200:270
```

### c128 · 찬 (R) — 41세 기관사 [fit]
```
handsome korean man in his 40s (age 41), 기관사, fit athletic build, wearing pilot uniform with epaulettes, confident gaze, gentle smile, bust portrait facing viewer, snowy mountain peaks background with #2dd4bf and #0f766e tones, bara manga style, mature masculine anime art, thick clean lineart, polished cel shading, rim lighting, SFW, fully clothed sportswear context --ar 200:270
```

---
*생성 후 얼굴·손 재검수 필수. SSR 12장부터 제작 권장 (노출 빈도 대비 임팩트 최대).*
