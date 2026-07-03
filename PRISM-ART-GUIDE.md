# PRISM 크러시 카드 — AI 일러스트 제작 가이드 v2

작성일: 2026-07-03 (카드 리뷰 패널 6인 피드백 반영판)
목적: 카드 128장을 생성형 AI로 제작해 절차적 SVG를 교체.

## 파이프라인 (앱에 이미 연결됨)

1. 아래 프롬프트로 생성 (권장 1024×1382 ≈ 비율 0.74, MJ는 `--ar 20:27`)
2. `prism/art/c001.webp` 형식으로 저장 (webp, 200KB 이하)
3. `node prism/gen-art-manifest.mjs` → 자동 반영 (없는 카드는 SVG 폴백)
4. **제작 순서 추천: SSR 12장 → SR 24장 → R → N** (노출 임팩트순)

## 캐릭터 일관성 전략 (중요 — 리뷰 지적 반영)

같은 캐릭터가 매번 다른 얼굴로 나오는 것을 막으려면:
1. **캐릭터 시트 먼저**: 카드별 프롬프트로 3-view character sheet를 1장 생성 → 마음에 드는 얼굴 고정
2. **시드/레퍼런스 고정**: MJ는 `--cref <시트 URL> --cw 60`, SD 계열은 시트 이미지로 IP-Adapter/reference 사용
3. 시리즈 전체 톤 통일: 같은 모델·같은 스타일 프롬프트 유지, 배치당 10장 이하로 검수

## 스타일 공통 (전 카드)

- 한국 게이 망가/바라 풍 성인 남성, 굵고 깔끔한 선의 셀셰이딩 (참조: 성인 남성 체형을 다루는 상업 BL/바라 일러스트 문법)
- 구도: 가슴 위 버스트 컷, 정면~15도, 시선 카메라. **얼굴을 캔버스 상단 절반에 배치** (하단 22%는 UI가 덮음) — 프롬프트에 포함됨
- 수위: 전연령 광고 정책 — 기본 착의. **예외: 수영/씨름은 실제 경기복 컨텍스트로 상반신 노출 허용하되 선정적 연출 금지** (현행 SVG와 동일 기준)
- 금지: 실존 인물 유사, 미성년 외모, 텍스트/워터마크

### 네거티브 프롬프트 (SD/NAI 계열용 — MJ는 생략 가능)
- 공통: `text, watermark, extra fingers, deformed hands, child, teenage face, photorealistic`
- **slim 체형 카드는 'feminine face'를 네거티브에 넣지 말 것** — 미형 라인이 죽습니다. 대신 포지티브에 'androgynous beauty' 계열 유지
- muscular/bulky 카드에만 선택적으로: `feminine face, delicate build`

### 등급별 연출
| 등급 | 연출 |
|---|---|
| N (56) | 깔끔한 셀셰이딩, 배경 모티프 은은 |
| R (36) | 림라이트, 배경 모티프 선명 |
| SR (24) | 드라마틱 조명 + 발광 파티클 |
| SSR (12) | 시네마틱, 금빛/무지개 파티클, 최고 디테일 — **한 장당 시간 2배 투자** |

## 카드별 프롬프트 (128장 — 정체성 완전 반영: 헤어·수염·체형·나이·액세서리)

### c01 · 도윤 (N) — 26세 바리스타 · fit · 민면
```
handsome korean young man in his early 20s (26), barista, fit athletic build, toned, handsome friendly face, clean jawline, dark brown short cropped hair, clean shaven, wearing work apron over shirt, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #8b5cf6 and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c02 · 하람 (N) — 23세 대학생 · slim · 민면
```
handsome korean young man in his early 20s (23), college student, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black middle-parted hair, clean shaven, wearing fitted t-shirt, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #3b82f6 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c03 · 은호 (N) — 29세 서점 직원 · slim · 민면
```
handsome korean man in his late 20s-early 30s (29), bookstore clerk, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, stylish glasses, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #2dd4bf and #0d9488 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c04 · 시우 (N) — 31세 요가 강사 · muscular · 수염자국
```
handsome korean man in his late 20s-early 30s (31), yoga instructor, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black-brown buzz cut, light stubble, wearing athletic tank top, small gold earring, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #34d399 and #059669 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c05 · 로운 (N) — 27세 플로리스트 · fit · 민면
```
handsome korean man in his late 20s-early 30s (27), florist, fit athletic build, toned, handsome friendly face, clean jawline, chestnut brown curly hair, clean shaven, wearing button-up shirt with rolled sleeves, small flower tucked behind ear, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f472b6 and #db2777 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c06 · 재이 (N) — 28세 사진작가 · fit · 수염자국
```
handsome korean man in his late 20s-early 30s (28), photographer, fit athletic build, toned, handsome friendly face, clean jawline, charcoal undercut hairstyle, light stubble, wearing fitted t-shirt, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #94a3b8 and #475569 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c07 · 태오 (R) — 33세 셰프 · bulky · 수염자국
```
handsome korean mature man in his 30s (33), subtle smile lines, chef, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, black short cropped hair, light stubble, wearing double-breasted chef whites, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f59e0b and #d97706 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c08 · 무진 (R) — 30세 필라테스 코치 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (30), pilates coach, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black undercut hairstyle, clean shaven, wearing athletic tank top, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f43f5e and #be123c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c09 · 반 (R) — 27세 DJ · fit · 수염자국
```
handsome korean man in his late 20s-early 30s (27), DJ, fit athletic build, toned, handsome friendly face, clean jawline, black buzz cut, light stubble, wearing fitted t-shirt, dj headphones around head, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #0ea5e9 and #0369a1 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c10 · 제노 (R) — 34세 바텐더 · fit · 수염자국
```
handsome korean mature man in his 30s (34), subtle smile lines, bartender, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown slicked-back pompadour, light stubble, wearing bartender vest over dress shirt, loose tie, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #a855f7 and #7e22ce tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c11 · 늘봄 (R) — 32세 수의사 · fit · 민면
```
handsome korean man in his late 20s-early 30s (32), veterinarian, fit athletic build, toned, handsome friendly face, clean jawline, dark middle-parted hair, clean shaven, wearing medical scrubs, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #22c55e and #15803d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c12 · 강토 (SR) — 36세 소방관 · bulky · 수염자국
```
handsome korean mature man in his 30s (36), subtle smile lines, firefighter, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, black short cropped hair, light stubble, wearing firefighter turnout gear with suspenders over station tee, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c13 · 파도 (SR) — 29세 수영 코치 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (29), swimming coach, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black undercut hairstyle, clean shaven, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #38bdf8 and #2563eb tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c14 · 윤슬 (SR) — 38세 파일럿 · fit · 수염자국
```
handsome korean mature man in his 30s (38), subtle smile lines, airline pilot, fit athletic build, toned, handsome friendly face, clean jawline, black slicked-back pompadour, light stubble, wearing pilot uniform with epaulettes, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #818cf8 and #4f46e5 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c15 · 세인트 (SSR) — 24세 아이돌 · slim · 민면
```
handsome korean young man in his early 20s (24), k-pop idol, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, pale lavender middle-parted hair, clean shaven, wearing black stage outfit with glitter accents, small gold earring, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #e879f9 and #8b5cf6 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c16 · 느와르 (SSR) — 26세 발레리노 · slim · 민면
```
handsome korean young man in his early 20s (26), ballet dancer, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, jet black middle-parted hair, clean shaven, wearing black long-sleeve dance leotard, black choker, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f5f5f5 and #71717a tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c017 · 준서 (N) — 20세 항해사 · slim · 수염자국
```
handsome korean young man in his early 20s (20), ship navigator, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black short cropped hair, light stubble, wearing pilot uniform with epaulettes, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c018 · 민재 (R) — 31세 물리치료사 · fit · 민면
```
handsome korean man in his late 20s-early 30s (31), physical therapist, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown undercut hairstyle, clean shaven, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c019 · 지호 (SSR) — 42세 스트리머 · muscular · 민면
```
handsome korean distinguished man in his 40s (42), mature features, faint crow's feet, streamer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown curly hair, clean shaven, wearing casual hoodie with drawstrings, black choker, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #f5f5f5 and #71717a tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c020 · 태윤 (N) — 23세 소믈리에 · fit · 민면
```
handsome korean young man in his early 20s (23), sommelier, fit athletic build, toned, handsome friendly face, clean jawline, black middle-parted hair, clean shaven, wearing bartender vest over dress shirt, loose tie, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c021 · 서진 (SR) — 34세 골키퍼 · fit · 민면
```
handsome korean mature man in his 30s (34), subtle smile lines, goalkeeper, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray slicked-back pompadour, clean shaven, wearing soccer jersey with number 10, stylish glasses, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #c084fc and #7c3aed tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c022 · 도현 (N) — 45세 교사 · fit · 수염자국
```
handsome korean distinguished man in his 40s (45), mature features, faint crow's feet, teacher, fit athletic build, toned, handsome friendly face, clean jawline, black-brown buzz cut, light stubble, wearing button-up shirt with rolled sleeves, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c023 · 건우 (SR) — 26세 경호원 · bulky · 수염자국
```
handsome korean young man in his early 20s (26), bodyguard, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, dark brown short cropped hair, light stubble, wearing tailored suit with necktie, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #22d3ee and #4f46e5 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c024 · 현서 (N) — 37세 브런치 셰프 · fit · 민면
```
handsome korean mature man in his 30s (37), subtle smile lines, brunch chef, fit athletic build, toned, handsome friendly face, clean jawline, warm brown undercut hairstyle, clean shaven, wearing double-breasted chef whites, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c025 · 지완 (SR) — 48세 온천 마을 안내인 · muscular · 민면
```
handsome korean distinguished man in his 40s (48), mature features, faint crow's feet, hot spring village guide, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black curly hair, clean shaven, wearing dark yukata with obi belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #c084fc and #7c3aed tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c026 · 태민 (N) — 29세 뮤지컬 배우 · fit · 민면
```
handsome korean man in his late 20s-early 30s (29), musical actor, fit athletic build, toned, handsome friendly face, clean jawline, brown middle-parted hair, clean shaven, wearing black stage outfit with glitter accents, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c027 · 유찬 (SR) — 40세 럭비 선수 · bulky · 수염자국
```
handsome korean mature man in his 30s (40), subtle smile lines, rugby player, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, black slicked-back pompadour, light stubble, wearing athletic tank top, black choker, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #22d3ee and #4f46e5 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c028 · 승우 (N) — 21세 수영 선수 · muscular · 민면
```
handsome korean young man in his early 20s (21), competitive swimmer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, espresso brown buzz cut, clean shaven, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso (sports context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c029 · 민혁 (R) — 32세 승무원 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (32), flight attendant, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown short cropped hair, clean shaven, wearing pilot uniform with epaulettes, stylish glasses, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #f472b6 and #be185d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c030 · 정우 (N) — 43세 한의사 · fit · 민면
```
handsome korean distinguished man in his 40s (43), mature features, faint crow's feet, korean medicine doctor, fit athletic build, toned, handsome friendly face, clean jawline, black undercut hairstyle, clean shaven, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c031 · 시온 (R) — 24세 힙합 프로듀서 · fit · 수염자국
```
handsome korean young man in his early 20s (24), hiphop producer, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray curly hair, light stubble, wearing casual hoodie with drawstrings, small gold earring, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #fb923c and #c2410c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c032 · 하진 (N) — 35세 재즈 피아니스트 · fit · 수염자국
```
handsome korean mature man in his 30s (35), subtle smile lines, jazz pianist, fit athletic build, toned, handsome friendly face, clean jawline, black-brown middle-parted hair, light stubble, wearing bartender vest over dress shirt, loose tie, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c033 · 예준 (R) — 46세 농구 선수 · muscular · 민면
```
handsome korean distinguished man in his 40s (46), mature features, faint crow's feet, basketball player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark brown slicked-back pompadour, clean shaven, wearing sleeveless basketball jersey number 23, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c034 · 주원 (N) — 27세 플로리스트 · fit · 민면
```
handsome korean man in his late 20s-early 30s (27), florist, fit athletic build, toned, handsome friendly face, clean jawline, warm brown buzz cut, clean shaven, wearing button-up shirt with rolled sleeves, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c035 · 지안 (R) — 38세 변호사 · muscular · 민면
```
handsome korean mature man in his 30s (38), subtle smile lines, lawyer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black short cropped hair, clean shaven, wearing tailored suit with necktie, black choker, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #a78bfa and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c036 · 선우 (SSR) — 49세 정육 장인 · bulky · 수염
```
handsome korean distinguished man in his 40s (49), mature features, faint crow's feet, master butcher, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, brown undercut hairstyle, full well-groomed beard, wearing work apron over shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #34d399 and #38bdf8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c037 · 은찬 (R) — 24세 체대생 · slim · 수염자국
```
handsome korean young man in his early 20s (24), phys-ed college student, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black curly hair, light stubble, wearing black gakuran school uniform with gold buttons, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #38bdf8 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c038 · 강민 (SSR) — 41세 인디 보컬 · fit · 민면
```
handsome korean distinguished man in his 40s (41), mature features, faint crow's feet, indie vocalist, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown middle-parted hair, clean shaven, wearing black stage outfit with glitter accents, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #e879f9 and #8b5cf6 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c039 · 태양 (N) — 22세 배구 선수 · muscular · 민면
```
handsome korean young man in his early 20s (22), volleyball player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown slicked-back pompadour, clean shaven, wearing athletic tank top, small gold earring, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c040 · 다온 (SR) — 33세 다이빙 선수 · muscular · 민면
```
handsome korean mature man in his 30s (33), subtle smile lines, diver, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black buzz cut, clean shaven, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso (sports context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f43f5e and #7e22ce tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c041 · 라온 (N) — 44세 기관사 · fit · 민면
```
handsome korean distinguished man in his 40s (44), mature features, faint crow's feet, train engineer, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray short cropped hair, clean shaven, wearing pilot uniform with epaulettes, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c042 · 시원 (SR) — 25세 치과의사 · fit · 수염자국
```
handsome korean young man in his early 20s (25), dentist, fit athletic build, toned, handsome friendly face, clean jawline, black-brown undercut hairstyle, light stubble, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c043 · 무영 (N) — 36세 태권도 사범 · muscular · 민면
```
handsome korean mature man in his 30s (36), subtle smile lines, taekwondo master, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark brown curly hair, clean shaven, wearing white taekwondo dobok with black v-neck trim, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c044 · 찬영 (SR) — 47세 마술사 · fit · 민면
```
handsome korean distinguished man in his 40s (47), mature features, faint crow's feet, magician, fit athletic build, toned, handsome friendly face, clean jawline, warm brown middle-parted hair, clean shaven, wearing bartender vest over dress shirt, loose tie, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #f43f5e and #7e22ce tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c045 · 세준 (N) — 28세 스트릿볼러 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (28), streetball player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black slicked-back pompadour, clean shaven, wearing sleeveless basketball jersey number 23, sport headband, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c046 · 우진 (SR) — 39세 여행 가이드 · slim · 민면
```
handsome korean mature man in his 30s (39), subtle smile lines, tour guide, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown buzz cut, clean shaven, wearing fitted t-shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c047 · 한결 (N) — 20세 회계사 · slim · 수염자국
```
handsome korean young man in his early 20s (20), accountant, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black short cropped hair, light stubble, wearing tailored suit with necktie, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c048 · 온유 (R) — 31세 도예가 · fit · 민면
```
handsome korean man in his late 20s-early 30s (31), ceramic artist, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown undercut hairstyle, clean shaven, wearing work apron over shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c049 · 강현 (N) — 24세 미대생 · slim · 민면
```
handsome korean young man in his early 20s (24), art college student, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, chestnut brown curly hair, clean shaven, wearing black gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c050 · 해성 (R) — 23세 건축가 · fit · 민면
```
handsome korean young man in his early 20s (23), architect, fit athletic build, toned, handsome friendly face, clean jawline, black middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #a78bfa and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c051 · 도영 (N) — 34세 서퍼 · muscular · 민면
```
handsome korean mature man in his 30s (34), subtle smile lines, surfer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, charcoal gray slicked-back pompadour, clean shaven, wearing athletic tank top, black choker, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c052 · 이안 (R) — 45세 철인3종 선수 · muscular · 수염자국
```
handsome korean distinguished man in his 40s (45), mature features, faint crow's feet, triathlete, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black-brown buzz cut, light stubble, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso (sports context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #38bdf8 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c053 · 서준 (N) — 26세 드론 조종사 · bulky · 민면
```
handsome korean young man in his early 20s (26), drone pilot, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, dark brown short cropped hair, clean shaven, wearing pilot uniform with epaulettes, stylish glasses, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c054 · 하율 (R) — 37세 간호사 · fit · 민면
```
handsome korean mature man in his 30s (37), subtle smile lines, nurse, fit athletic build, toned, handsome friendly face, clean jawline, warm brown undercut hairstyle, clean shaven, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f472b6 and #be185d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c055 · 지율 (SSR) — 48세 태권도 국가대표 · muscular · 민면
```
handsome korean distinguished man in his 40s (48), mature features, faint crow's feet, national taekwondo athlete, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black curly hair, clean shaven, wearing white taekwondo dobok with black v-neck trim, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #f5f5f5 and #71717a tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c056 · 연우 (R) — 29세 호텔리어 · slim · 민면
```
handsome korean man in his late 20s-early 30s (29), hotelier, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown middle-parted hair, clean shaven, wearing bartender vest over dress shirt, loose tie, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #fb923c and #c2410c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c057 · 시현 (SSR) — 40세 배드민턴 선수 · slim · 수염자국
```
handsome korean mature man in his 30s (40), subtle smile lines, badminton player, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black slicked-back pompadour, light stubble, wearing white badminton polo shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #fbbf24 and #f472b6 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c058 · 준영 (N) — 21세 사진작가 · fit · 수염자국
```
handsome korean young man in his early 20s (21), photographer, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown buzz cut, light stubble, wearing fitted t-shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c059 · 태호 (SR) — 32세 아나운서 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (32), news anchor, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown short cropped hair, clean shaven, wearing tailored suit with necktie, black choker, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #22d3ee and #4f46e5 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c060 · 동하 (N) — 43세 플랜트 집사 · fit · 민면
```
handsome korean distinguished man in his 40s (43), mature features, faint crow's feet, plant shop owner, fit athletic build, toned, handsome friendly face, clean jawline, black undercut hairstyle, clean shaven, wearing work apron over shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c061 · 루안 (SR) — 24세 공대생 · slim · 민면
```
handsome korean young man in his early 20s (24), engineering student, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, charcoal gray curly hair, clean shaven, wearing black gakuran school uniform with gold buttons, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #c084fc and #7c3aed tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c062 · 현빈 (N) — 35세 큐레이터 · fit · 수염자국
```
handsome korean mature man in his 30s (35), subtle smile lines, curator, fit athletic build, toned, handsome friendly face, clean jawline, black-brown middle-parted hair, light stubble, wearing button-up shirt with rolled sleeves, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c063 · 승현 (SR) — 46세 인명구조원 · muscular · 민면
```
handsome korean distinguished man in his 40s (46), mature features, faint crow's feet, lifeguard, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark brown slicked-back pompadour, clean shaven, wearing athletic tank top, small gold earring, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #22d3ee and #4f46e5 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c064 · 지훈 (N) — 27세 씨름 선수 · bulky · 수염
```
handsome korean man in his late 20s-early 30s (27), korean ssireum wrestler, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, warm brown buzz cut, full well-groomed beard, wearing korean ssireum wrestler with satba sash around waist, athletic bare torso (traditional sport context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c065 · 민규 (R) — 38세 국악인 · bulky · 민면
```
handsome korean mature man in his 30s (38), subtle smile lines, traditional korean musician, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, dark blue-black short cropped hair, clean shaven, wearing white martial arts gi with colored belt, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #a78bfa and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c066 · 성진 (N) — 49세 약사 · slim · 민면
```
handsome korean distinguished man in his 40s (49), mature features, faint crow's feet, pharmacist, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown undercut hairstyle, clean shaven, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c067 · 윤재 (R) — 30세 유도 선수 · muscular · 수염자국
```
handsome korean man in his late 20s-early 30s (30), judo athlete, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black curly hair, light stubble, wearing white martial arts gi with colored belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #38bdf8 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c068 · 경수 (N) — 41세 소방관 · bulky · 수염
```
handsome korean distinguished man in his 40s (41), mature features, faint crow's feet, firefighter, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, espresso brown middle-parted hair, full well-groomed beard, wearing firefighter turnout gear with suspenders over station tee, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c069 · 형준 (R) — 22세 탁구 선수 · muscular · 민면
```
handsome korean young man in his early 20s (22), table tennis player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown slicked-back pompadour, clean shaven, wearing white badminton polo shirt, stylish glasses, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #f472b6 and #be185d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c070 · 재윤 (N) — 33세 반려견 훈련사 · fit · 민면
```
handsome korean mature man in his 30s (33), subtle smile lines, dog trainer, fit athletic build, toned, handsome friendly face, clean jawline, black buzz cut, clean shaven, wearing fitted t-shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c071 · 호진 (R) — 44세 웹툰 작가 · fit · 민면
```
handsome korean distinguished man in his 40s (44), mature features, faint crow's feet, webtoon artist, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray short cropped hair, clean shaven, wearing casual hoodie with drawstrings, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #fb923c and #c2410c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c072 · 범준 (N) — 25세 조향사 · fit · 수염자국
```
handsome korean young man in his early 20s (25), perfumer, fit athletic build, toned, handsome friendly face, clean jawline, black-brown undercut hairstyle, light stubble, wearing work apron over shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c073 · 석현 (R) — 24세 음대생 · slim · 민면
```
handsome korean young man in his early 20s (24), music student, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, dark brown curly hair, clean shaven, wearing black gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c074 · 진우 (SSR) — 47세 사서 · fit · 민면
```
handsome korean distinguished man in his 40s (47), mature features, faint crow's feet, librarian, fit athletic build, toned, handsome friendly face, clean jawline, warm brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #e879f9 and #8b5cf6 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c075 · 규현 (R) — 28세 복싱 코치 · muscular · 수염자국
```
handsome korean man in his late 20s-early 30s (28), boxing coach, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black slicked-back pompadour, light stubble, wearing athletic tank top, black choker, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #a78bfa and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c076 · 상윤 (SSR) — 39세 씨름 천하장사 · bulky · 수염
```
handsome korean mature man in his 30s (39), subtle smile lines, ssireum grand champion, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, brown buzz cut, full well-groomed beard, wearing korean ssireum wrestler with satba sash around waist, athletic bare torso (traditional sport context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #34d399 and #38bdf8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c077 · 태검 (N) — 20세 발레 강사 · fit · 수염자국
```
handsome korean young man in his early 20s (20), ballet instructor, fit athletic build, toned, handsome friendly face, clean jawline, black short cropped hair, light stubble, wearing black long-sleeve dance leotard, stylish glasses, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c078 · 백호 (SR) — 31세 헬스 트레이너 · muscular · 수염자국
```
handsome korean man in his late 20s-early 30s (31), personal trainer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, espresso brown undercut hairstyle, light stubble, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c079 · 천둥 (N) — 42세 검도 사범 · muscular · 수염자국
```
handsome korean distinguished man in his 40s (42), mature features, faint crow's feet, kendo master, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown curly hair, light stubble, wearing white martial arts gi with colored belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c080 · 마루 (SR) — 23세 산악구조대 · bulky · 수염
```
handsome korean young man in his early 20s (23), mountain rescuer, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, black middle-parted hair, full well-groomed beard, wearing firefighter turnout gear with suspenders over station tee, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #f43f5e and #7e22ce tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c081 · 바다 (N) — 34세 테니스 코치 · fit · 민면
```
handsome korean mature man in his 30s (34), subtle smile lines, tennis coach, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray slicked-back pompadour, clean shaven, wearing white badminton polo shirt, sport headband, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c082 · 산들 (SR) — 45세 목수 · bulky · 수염
```
handsome korean distinguished man in his 40s (45), mature features, faint crow's feet, carpenter, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, black-brown buzz cut, full well-groomed beard, wearing fitted t-shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c083 · 노을 (N) — 26세 게임 개발자 · bulky · 민면
```
handsome korean young man in his early 20s (26), game developer, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, dark brown short cropped hair, clean shaven, wearing casual hoodie with drawstrings, black choker, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c084 · 가온 (R) — 37세 수제맥주 브루어 · bulky · 수염
```
handsome korean mature man in his 30s (37), subtle smile lines, craft beer brewer, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, warm brown undercut hairstyle, full well-groomed beard, wearing work apron over shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #f472b6 and #be185d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c085 · 새벽 (N) — 48세 축구 선수 · muscular · 민면
```
handsome korean distinguished man in his 40s (48), mature features, faint crow's feet, soccer player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black curly hair, clean shaven, wearing soccer jersey with number 10, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c086 · 여름 (R) — 29세 통역사 · slim · 민면
```
handsome korean man in his late 20s-early 30s (29), interpreter, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #fb923c and #c2410c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c087 · 겨울 (N) — 40세 파티시에 · slim · 수염자국
```
handsome korean mature man in his 30s (40), subtle smile lines, patissier, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black slicked-back pompadour, light stubble, wearing double-breasted chef whites, small gold earring, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c088 · 우람 (R) — 21세 료칸 지배인 · fit · 민면
```
handsome korean young man in his early 20s (21), ryokan manager, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown buzz cut, clean shaven, wearing dark yukata with obi belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c089 · 힘찬 (N) — 32세 현대무용수 · fit · 민면
```
handsome korean man in his late 20s-early 30s (32), contemporary dancer, fit athletic build, toned, handsome friendly face, clean jawline, chestnut brown short cropped hair, clean shaven, wearing black long-sleeve dance leotard, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c090 · 슬기 (R) — 43세 크로스핏 코치 · muscular · 수염자국
```
handsome korean distinguished man in his 40s (43), mature features, faint crow's feet, crossfit coach, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black undercut hairstyle, light stubble, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #a78bfa and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c091 · 보검 (N) — 24세 주짓수 코치 · muscular · 수염자국
```
handsome korean young man in his early 20s (24), jiujitsu coach, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, charcoal gray curly hair, light stubble, wearing white martial arts gi with colored belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c092 · 한울 (R) — 35세 해양경찰 · fit · 수염자국
```
handsome korean mature man in his 30s (35), subtle smile lines, coast guard officer, fit athletic build, toned, handsome friendly face, clean jawline, black-brown middle-parted hair, light stubble, wearing pilot uniform with epaulettes, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #38bdf8 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c093 · 누리 (SSR) — 46세 응급구조사 · bulky · 민면
```
handsome korean distinguished man in his 40s (46), mature features, faint crow's feet, paramedic, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, dark brown slicked-back pompadour, clean shaven, wearing medical scrubs, stylish glasses, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #fbbf24 and #f472b6 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c094 · 아라 (N) — 27세 자동차 정비사 · fit · 수염자국
```
handsome korean man in his late 20s-early 30s (27), car mechanic, fit athletic build, toned, handsome friendly face, clean jawline, warm brown buzz cut, light stubble, wearing fitted t-shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c095 · 도담 (SSR) — 38세 프로게이머 · muscular · 민면
```
handsome korean mature man in his 30s (38), subtle smile lines, pro gamer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black short cropped hair, clean shaven, wearing casual hoodie with drawstrings, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #f5f5f5 and #71717a tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c096 · 벼리 (N) — 49세 바리스타 · slim · 민면
```
handsome korean distinguished man in his 40s (49), mature features, faint crow's feet, barista, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown undercut hairstyle, clean shaven, wearing work apron over shirt, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c097 · 믿음 (SR) — 30세 풋살 코치 · slim · 수염자국
```
handsome korean man in his late 20s-early 30s (30), futsal coach, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black curly hair, light stubble, wearing soccer jersey with number 10, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #c084fc and #7c3aed tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c098 · 기람 (N) — 41세 천문학자 · fit · 민면
```
handsome korean distinguished man in his 40s (41), mature features, faint crow's feet, astronomer, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c099 · 솔찬 (SR) — 22세 스시 셰프 · muscular · 수염자국
```
handsome korean young man in his early 20s (22), sushi chef, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown slicked-back pompadour, light stubble, wearing double-breasted chef whites, black choker, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #22d3ee and #4f46e5 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c100 · 윤슬비 (N) — 33세 유카타 찻집 주인 · fit · 민면
```
handsome korean mature man in his 30s (33), subtle smile lines, teahouse owner, fit athletic build, toned, handsome friendly face, clean jawline, black buzz cut, clean shaven, wearing dark yukata with obi belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c101 · 담율 (SR) — 44세 배우 · fit · 민면
```
handsome korean distinguished man in his 40s (44), mature features, faint crow's feet, actor, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray short cropped hair, clean shaven, wearing black stage outfit with glitter accents, stylish glasses, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #c084fc and #7c3aed tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c102 · 현담 (N) — 25세 클라이밍 강사 · muscular · 수염자국
```
handsome korean young man in his early 20s (25), climbing instructor, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black-brown undercut hairstyle, light stubble, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c103 · 무결 (R) — 36세 합기도 사범 · muscular · 민면
```
handsome korean mature man in his 30s (36), subtle smile lines, hapkido master, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark brown curly hair, clean shaven, wearing white martial arts gi with colored belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c104 · 서강 (N) — 47세 항해사 · fit · 수염
```
handsome korean distinguished man in his 40s (47), mature features, faint crow's feet, ship navigator, fit athletic build, toned, handsome friendly face, clean jawline, warm brown middle-parted hair, full well-groomed beard, wearing pilot uniform with epaulettes, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c105 · 한별 (R) — 28세 물리치료사 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (28), physical therapist, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black slicked-back pompadour, clean shaven, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #a78bfa and #6d28d9 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c106 · 은결 (N) — 39세 스트리머 · slim · 민면
```
handsome korean mature man in his 30s (39), subtle smile lines, streamer, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown buzz cut, clean shaven, wearing casual hoodie with drawstrings, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #78716c and #44403c tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c107 · 도하 (R) — 20세 소믈리에 · slim · 수염자국
```
handsome korean young man in his early 20s (20), sommelier, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black short cropped hair, light stubble, wearing bartender vest over dress shirt, loose tie, black choker, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #38bdf8 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c108 · 류진 (N) — 31세 골키퍼 · fit · 민면
```
handsome korean man in his late 20s-early 30s (31), goalkeeper, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown undercut hairstyle, clean shaven, wearing soccer jersey with number 10, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #8b5cf6 and #4c1d95 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c109 · 백현 (R) — 42세 교사 · muscular · 민면
```
handsome korean distinguished man in his 40s (42), mature features, faint crow's feet, teacher, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown curly hair, clean shaven, wearing button-up shirt with rolled sleeves, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #f472b6 and #be185d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c110 · 시우진 (N) — 23세 경호원 · fit · 수염자국
```
handsome korean young man in his early 20s (23), bodyguard, fit athletic build, toned, handsome friendly face, clean jawline, black middle-parted hair, light stubble, wearing tailored suit with necktie, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #10b981 and #065f46 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c111 · 강토르 (R) — 34세 브런치 셰프 · fit · 민면
```
handsome korean mature man in his 30s (34), subtle smile lines, brunch chef, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray slicked-back pompadour, clean shaven, wearing double-breasted chef whites, small gold earring, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #fb923c and #c2410c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c112 · 제이 (SSR) — 45세 온천 마을 안내인 · fit · 수염자국
```
handsome korean distinguished man in his 40s (45), mature features, faint crow's feet, hot spring village guide, fit athletic build, toned, handsome friendly face, clean jawline, black-brown buzz cut, light stubble, wearing dark yukata with obi belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #34d399 and #38bdf8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c113 · 카이 (N) — 26세 뮤지컬 배우 · fit · 민면
```
handsome korean young man in his early 20s (26), musical actor, fit athletic build, toned, handsome friendly face, clean jawline, dark brown short cropped hair, clean shaven, wearing black stage outfit with glitter accents, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c114 · 레오 (SR) — 37세 럭비 선수 · bulky · 수염
```
handsome korean mature man in his 30s (37), subtle smile lines, rugby player, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, warm brown undercut hairstyle, full well-groomed beard, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c115 · 노아 (N) — 48세 수영 선수 · muscular · 민면
```
handsome korean distinguished man in his 40s (48), mature features, faint crow's feet, competitive swimmer, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, dark blue-black buzz cut, clean shaven, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso (sports context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c116 · 단우 (SR) — 29세 승무원 · slim · 민면
```
handsome korean man in his late 20s-early 30s (29), flight attendant, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, brown middle-parted hair, clean shaven, wearing pilot uniform with epaulettes, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #f43f5e and #7e22ce tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c117 · 률아 (N) — 40세 한의사 · slim · 수염자국
```
handsome korean mature man in his 30s (40), subtle smile lines, korean medicine doctor, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, black slicked-back pompadour, light stubble, wearing medical scrubs, stylish glasses, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c118 · 혁준 (SR) — 21세 힙합 프로듀서 · fit · 수염자국
```
handsome korean young man in his early 20s (21), hiphop producer, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown buzz cut, light stubble, wearing casual hoodie with drawstrings, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f97316 and #dc2626 tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c119 · 검호 (N) — 32세 재즈 피아니스트 · muscular · 민면
```
handsome korean man in his late 20s-early 30s (32), jazz pianist, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, chestnut brown short cropped hair, clean shaven, wearing bartender vest over dress shirt, loose tie, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, dramatic god rays background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c120 · 웅재 (SR) — 43세 농구 선수 · muscular · 민면
```
handsome korean distinguished man in his 40s (43), mature features, faint crow's feet, basketball player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black undercut hairstyle, clean shaven, wearing sleeveless basketball jersey number 23, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #f43f5e and #7e22ce tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c121 · 산하 (N) — 24세 플로리스트 · fit · 민면
```
handsome korean young man in his early 20s (24), florist, fit athletic build, toned, handsome friendly face, clean jawline, charcoal gray curly hair, clean shaven, wearing button-up shirt with rolled sleeves, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, starry night sky background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c122 · 도원 (R) — 35세 변호사 · fit · 수염자국
```
handsome korean mature man in his 30s (35), subtle smile lines, lawyer, fit athletic build, toned, handsome friendly face, clean jawline, black-brown middle-parted hair, light stubble, wearing tailored suit with necktie, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, floating music notes, concert glow background in #38bdf8 and #1d4ed8 tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c123 · 해린 (N) — 46세 정육 장인 · bulky · 수염자국
```
handsome korean distinguished man in his 40s (46), mature features, faint crow's feet, master butcher, big burly bear build, heavyset thick muscle, powerful frame, rugged mature face, heavy jaw, warm expression, dark brown slicked-back pompadour, light stubble, wearing work apron over shirt, black choker, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, night city skyline with bokeh lights background in #3b82f6 and #1e3a8a tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c124 · 무현 (R) — 21세 체대생 · slim · 민면
```
handsome korean young man in his early 20s (21), phys-ed college student, slim graceful build, elegant proportions, strikingly beautiful face, refined delicate jawline, long elegant neck, warm brown buzz cut, clean shaven, wearing black gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, falling flower petals background in #f472b6 and #be185d tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c125 · 강율 (N) — 38세 인디 보컬 · fit · 민면
```
handsome korean mature man in his 30s (38), subtle smile lines, indie vocalist, fit athletic build, toned, handsome friendly face, clean jawline, dark blue-black short cropped hair, clean shaven, wearing black stage outfit with glitter accents, stylish glasses, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, soft dreamy bokeh lights background in #64748b and #334155 tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c126 · 호수 (R) — 49세 배구 선수 · muscular · 민면
```
handsome korean distinguished man in his 40s (49), mature features, faint crow's feet, volleyball player, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, brown undercut hairstyle, clean shaven, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #fb923c and #c2410c tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c127 · 별하 (N) — 30세 다이빙 선수 · muscular · 수염자국
```
handsome korean man in his late 20s-early 30s (30), diver, muscular broad-shouldered build, defined pecs and arms, ruggedly handsome face, strong square jaw, black buzz cut, light stubble, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso (sports context), warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, ocean waves and sea spray background in #f59e0b and #92400e tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c128 · 찬율 (R) — 41세 기관사 · fit · 민면
```
handsome korean distinguished man in his 40s (41), mature features, faint crow's feet, train engineer, fit athletic build, toned, handsome friendly face, clean jawline, espresso brown middle-parted hair, clean shaven, wearing pilot uniform with epaulettes, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, lower quarter kept uncluttered, snowy mountain peaks background in #2dd4bf and #0f766e tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

---
*얼굴·손 재검수 필수. 슬림 라인(세인트·느와르 등)은 미형 유지가 생명 — 'feminine face' 네거티브 금지.*
