# PRISM 크러시 카드 — AI 일러스트 제작 가이드 v3

작성일: 2026-07-04 (카드 패널 2라운드 피드백 반영판)
변경: 카드별 얼굴 파라미터(턱·눈매·눈썹·코)를 프롬프트에 완전 반영 — SVG 도감과 1:1 동기화,
hex 색상 → 자연어, 씨름 문법·검도 고증 수정, 나이 경계(27/36/44)를 SVG 주름 로직과 일치.

## 파이프라인

1. 아래 프롬프트로 생성 (1024×1382, MJ `--ar 20:27`)
2. `prism/art/c001.webp` 저장 → `node prism/gen-art-manifest.mjs` → 자동 반영
3. 제작 순서: SSR 12 → SR 24 → R → N

## 캐릭터 일관성 (필수)

1. 카드 프롬프트로 3-view 캐릭터 시트 1장 생성 → 얼굴 확정
2. MJ `--cref <시트> --cw 60` / SD는 IP-Adapter·reference로 고정
3. 같은 모델·같은 스타일 문구 유지, 10장 단위 검수

## 공통 스타일

- 한국 게이 망가/바라 풍 성인 남성, 굵은 선 셀셰이딩
- 가슴 위 버스트, 정면~15도, 시선 카메라, 얼굴은 캔버스 상단 절반 (하단 22% UI)
- 수위: 기본 착의 · 수영/씨름은 경기복 컨텍스트 예외 (선정 연출 금지) · 미성년 외모/실존 유사/텍스트 금지
- SD 네거티브: `text, watermark, extra fingers, deformed hands, child, teenage face, photorealistic`
  (slim 카드는 'feminine face' 넣지 말 것 / muscular·bulky만 선택적으로 추가)

## 카드별 프롬프트 (128장 — 얼굴 파츠·수염·체형·나이 완전 반영)

### c01 · 도윤 (N) — 26세 바리스타 · fit · 민면
```
handsome korean young man in his early-mid 20s (26), barista, fit athletic build, toned, oval face, balanced almond eyes, arched expressive brows, refined short nose, dark brown short cropped hair, clean shaven, wearing work apron over shirt, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in violet and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c02 · 하람 (N) — 23세 대학생 · slim · 민면
```
handsome korean young man in his early-mid 20s (23), college student, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, softly sloped brows, refined short nose, black middle-parted hair, clean shaven, wearing fitted t-shirt, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in blue and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c03 · 은호 (N) — 29세 서점 직원 · slim · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, bookstore clerk, slim graceful build, elegant proportions, sharp V-line chin, balanced almond eyes, arched expressive brows, straight defined nose, brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, stylish glasses, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in teal and deep teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c04 · 시우 (N) — 31세 요가 강사 · muscular · 수염자국
```
handsome korean man in his late 20s to early 30s (31), youthful, yoga instructor, muscular broad-shouldered build, defined pecs and arms, strong square jaw, sharp upturned eyes, intense, angular masculine brows, straight defined nose, black-brown buzz cut, light stubble, wearing athletic tank top, small gold earring, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in emerald and deep green tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c05 · 로운 (N) — 27세 플로리스트 · fit · 민면
```
handsome korean man in his late 20s to early 30s (27), youthful, florist, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, arched expressive brows, refined short nose, chestnut brown curly hair, clean shaven, wearing button-up shirt with rolled sleeves, small flower tucked behind ear, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in pink and magenta tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c06 · 재이 (N) — 28세 사진작가 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (28), youthful, photographer, fit athletic build, toned, oval face, sharp upturned eyes, intense, softly sloped brows, straight defined nose, charcoal undercut hairstyle, light stubble, wearing fitted t-shirt, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in silver gray and slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c07 · 태오 (R) — 33세 셰프 · bulky · 수염자국
```
handsome korean man in his late 20s to early 30s (33), youthful, chef, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, straight thick brows, prominent strong nose, black short cropped hair, light stubble, wearing double-breasted chef whites, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in amber and burnt orange tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c08 · 무진 (R) — 30세 필라테스 코치 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (30), youthful, pilates coach, muscular broad-shouldered build, defined pecs and arms, oval face, sharp upturned eyes, intense, angular masculine brows, straight defined nose, black undercut hairstyle, clean shaven, wearing athletic tank top, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in rose red and crimson tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c09 · 반 (R) — 27세 DJ · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (27), youthful, DJ, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, straight thick brows, prominent strong nose, black buzz cut, light stubble, wearing fitted t-shirt, dj headphones around head, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in sky blue and deep ocean blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c10 · 제노 (R) — 34세 바텐더 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (34), youthful, bartender, fit athletic build, toned, sharp V-line chin, sharp upturned eyes, intense, softly sloped brows, straight defined nose, espresso brown slicked-back pompadour, light stubble, wearing bartender vest over dress shirt, loose tie, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in purple and royal purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c11 · 늘봄 (R) — 32세 수의사 · fit · 민면
```
handsome korean man in his late 20s to early 30s (32), youthful, veterinarian, fit athletic build, toned, oval face, gentle round downturned eyes, soft, arched expressive brows, refined short nose, dark middle-parted hair, clean shaven, wearing medical scrubs, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in green and forest green tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c12 · 강토 (SR) — 36세 소방관 · bulky · 수염자국
```
handsome korean mature man (36), subtle smile lines, firefighter, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, straight thick brows, prominent strong nose, black short cropped hair, light stubble, wearing firefighter turnout gear with suspenders over station tee, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c13 · 파도 (SR) — 29세 수영 코치 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, swimming coach, muscular broad-shouldered build, defined pecs and arms, strong square jaw, sharp upturned eyes, intense, angular masculine brows, straight defined nose, blue-black undercut hairstyle, clean shaven, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in aqua and cobalt tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c14 · 윤슬 (SR) — 38세 파일럿 · fit · 수염자국
```
handsome korean mature man (38), subtle smile lines, airline pilot, fit athletic build, toned, oval face, sharp upturned eyes, intense, softly sloped brows, straight defined nose, black slicked-back pompadour, light stubble, wearing pilot uniform with epaulettes, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in periwinkle and indigo tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c15 · 세인트 (SSR) — 24세 아이돌 · slim · 민면
```
handsome korean young man in his early-mid 20s (24), k-pop idol, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, arched expressive brows, refined short nose, pale lavender middle-parted hair, clean shaven, wearing black stage outfit with glitter accents, small gold earring, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in orchid pink and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c16 · 느와르 (SSR) — 26세 발레리노 · slim · 민면
```
handsome korean young man in his early-mid 20s (26), ballet dancer, slim graceful build, elegant proportions, sharp V-line chin, sharp upturned eyes, intense, softly sloped brows, refined short nose, jet black middle-parted hair, clean shaven, wearing black long-sleeve dance leotard, black choker, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in silver white and smoke gray tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c017 · 준서 (N) — 20세 항해사 · slim · 수염자국
```
handsome korean young man in his early-mid 20s (20), ship navigator, slim graceful build, elegant proportions, strong square jaw, sharp upturned eyes, intense, arched expressive brows, refined short nose, black short cropped hair, light stubble, wearing pilot uniform with epaulettes, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c018 · 민재 (R) — 31세 물리치료사 · fit · 민면
```
handsome korean man in his late 20s to early 30s (31), youthful, physical therapist, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, refined short nose, espresso brown undercut hairstyle, clean shaven, wearing medical scrubs, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c019 · 지호 (SSR) — 23세 스트리머 · muscular · 민면
```
handsome korean young man in his early-mid 20s (23), streamer, muscular broad-shouldered build, defined pecs and arms, oval face, balanced almond eyes, arched expressive brows, straight defined nose, chestnut brown curly hair, clean shaven, wearing casual hoodie with drawstrings, small gold earring, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in silver white and smoke gray tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c020 · 태윤 (N) — 23세 소믈리에 · fit · 민면
```
handsome korean young man in his early-mid 20s (23), sommelier, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, straight thick brows, prominent strong nose, black middle-parted hair, clean shaven, wearing bartender vest over dress shirt, loose tie, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c021 · 서진 (SR) — 34세 골키퍼 · fit · 민면
```
handsome korean man in his late 20s to early 30s (34), youthful, goalkeeper, fit athletic build, toned, strong square jaw, balanced almond eyes, angular masculine brows, refined short nose, charcoal gray slicked-back pompadour, clean shaven, wearing soccer jersey with number 10, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in lavender and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c022 · 도현 (N) — 45세 교사 · fit · 수염자국
```
handsome korean distinguished man in his mid-late 40s (45), crow's feet and faint forehead line, dignified, teacher, fit athletic build, toned, sharp V-line chin, sharp upturned eyes, intense, angular masculine brows, straight defined nose, black-brown buzz cut, light stubble, wearing button-up shirt with rolled sleeves, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c023 · 건우 (SR) — 26세 경호원 · bulky · 수염자국
```
handsome korean young man in his early-mid 20s (26), bodyguard, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, sharp upturned eyes, intense, angular masculine brows, straight defined nose, dark brown short cropped hair, light stubble, wearing tailored suit with necktie, small gold earring, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in cyan and indigo tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c024 · 현서 (N) — 37세 브런치 셰프 · fit · 민면
```
handsome korean mature man (37), subtle smile lines, brunch chef, fit athletic build, toned, strong square jaw, balanced almond eyes, arched expressive brows, straight defined nose, warm brown undercut hairstyle, clean shaven, wearing double-breasted chef whites, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c025 · 지완 (SR) — 48세 온천 마을 안내인 · muscular · 민면
```
handsome korean distinguished man in his mid-late 40s (48), crow's feet and faint forehead line, dignified, hot spring village guide, muscular broad-shouldered build, defined pecs and arms, oval face, gentle round downturned eyes, soft, arched expressive brows, straight defined nose, blue-black curly hair, clean shaven, wearing dark yukata with obi belt, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in lavender and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c026 · 태민 (N) — 29세 뮤지컬 배우 · fit · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, musical actor, fit athletic build, toned, strong square jaw, balanced almond eyes, arched expressive brows, prominent strong nose, brown middle-parted hair, clean shaven, wearing black stage outfit with glitter accents, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c027 · 유찬 (SR) — 40세 럭비 선수 · bulky · 수염자국
```
handsome korean mature man (40), subtle smile lines, rugby player, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, sharp upturned eyes, intense, softly sloped brows, refined short nose, black slicked-back pompadour, light stubble, wearing athletic tank top, small gold earring, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in cyan and indigo tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c028 · 승우 (N) — 21세 수영 선수 · muscular · 민면
```
handsome korean young man in his early-mid 20s (21), competitive swimmer, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, prominent strong nose, espresso brown buzz cut, clean shaven, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso in sports context, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c029 · 민혁 (R) — 32세 승무원 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (32), youthful, flight attendant, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, angular masculine brows, refined short nose, chestnut brown short cropped hair, clean shaven, wearing pilot uniform with epaulettes, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in pink and vivid tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c030 · 정우 (N) — 43세 한의사 · fit · 민면
```
handsome korean mature man (43), subtle smile lines, korean medicine doctor, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, straight thick brows, straight defined nose, black undercut hairstyle, clean shaven, wearing medical scrubs, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c031 · 시온 (R) — 24세 힙합 프로듀서 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (24), hiphop producer, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, softly sloped brows, refined short nose, charcoal gray curly hair, light stubble, wearing casual hoodie with drawstrings, small gold earring, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in tangerine and rust tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c032 · 하진 (N) — 35세 재즈 피아니스트 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (35), youthful, jazz pianist, fit athletic build, toned, oval face, sharp upturned eyes, intense, arched expressive brows, straight defined nose, black-brown middle-parted hair, light stubble, wearing bartender vest over dress shirt, loose tie, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c033 · 예준 (R) — 46세 농구 선수 · muscular · 민면
```
handsome korean distinguished man in his mid-late 40s (46), crow's feet and faint forehead line, dignified, basketball player, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, arched expressive brows, prominent strong nose, dark brown slicked-back pompadour, clean shaven, wearing sleeveless basketball jersey number 23, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c034 · 주원 (N) — 27세 플로리스트 · fit · 민면
```
handsome korean man in his late 20s to early 30s (27), youthful, florist, fit athletic build, toned, sharp V-line chin, balanced almond eyes, straight thick brows, straight defined nose, warm brown buzz cut, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c035 · 지안 (R) — 38세 변호사 · muscular · 민면
```
handsome korean mature man (38), subtle smile lines, lawyer, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, gentle round downturned eyes, soft, arched expressive brows, refined short nose, blue-black short cropped hair, clean shaven, wearing tailored suit with necktie, small gold earring, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in vivid and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c036 · 선우 (SSR) — 39세 정육 장인 · bulky · 수염
```
handsome korean mature man (39), subtle smile lines, master butcher, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, sharp upturned eyes, intense, softly sloped brows, straight defined nose, brown undercut hairstyle, full well-groomed beard, wearing work apron over shirt, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in emerald and aqua tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c037 · 은찬 (R) — 24세 체대생 · slim · 수염자국
```
handsome korean young man in his early-mid 20s (24), phys-ed college student, slim graceful build, elegant proportions, strong square jaw, gentle round downturned eyes, soft, softly sloped brows, straight defined nose, black curly hair, light stubble, wearing black gakuran school uniform with gold buttons, stylish glasses, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in aqua and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c038 · 강민 (SSR) — 29세 인디 보컬 · slim · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, indie vocalist, slim graceful build, elegant proportions, oval face, gentle round downturned eyes, soft, straight thick brows, refined short nose, espresso brown middle-parted hair, clean shaven, wearing black stage outfit with glitter accents, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in orchid pink and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c039 · 태양 (N) — 22세 배구 선수 · muscular · 민면
```
handsome korean young man in his early-mid 20s (22), volleyball player, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, straight thick brows, prominent strong nose, chestnut brown slicked-back pompadour, clean shaven, wearing athletic tank top, small gold earring, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c040 · 다온 (SR) — 33세 다이빙 선수 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (33), youthful, diver, muscular broad-shouldered build, defined pecs and arms, oval face, gentle round downturned eyes, soft, angular masculine brows, prominent strong nose, black buzz cut, clean shaven, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso in sports context, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in rose red and royal purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c041 · 라온 (N) — 44세 기관사 · fit · 민면
```
handsome korean distinguished man in his mid-late 40s (44), crow's feet and faint forehead line, dignified, train engineer, fit athletic build, toned, oval face, sharp upturned eyes, intense, softly sloped brows, straight defined nose, charcoal gray short cropped hair, clean shaven, wearing pilot uniform with epaulettes, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c042 · 시원 (SR) — 25세 치과의사 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (25), dentist, fit athletic build, toned, strong square jaw, balanced almond eyes, straight thick brows, prominent strong nose, black-brown undercut hairstyle, light stubble, wearing medical scrubs, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c043 · 무영 (N) — 36세 태권도 사범 · muscular · 민면
```
handsome korean mature man (36), subtle smile lines, taekwondo master, muscular broad-shouldered build, defined pecs and arms, oval face, gentle round downturned eyes, soft, angular masculine brows, prominent strong nose, dark brown curly hair, clean shaven, wearing white taekwondo dobok with black v-neck trim, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c044 · 찬영 (SR) — 47세 마술사 · fit · 민면
```
handsome korean distinguished man in his mid-late 40s (47), crow's feet and faint forehead line, dignified, magician, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, angular masculine brows, prominent strong nose, warm brown middle-parted hair, clean shaven, wearing bartender vest over dress shirt, loose tie, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in rose red and royal purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c045 · 세준 (N) — 28세 스트릿볼러 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (28), youthful, streetball player, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, arched expressive brows, straight defined nose, blue-black slicked-back pompadour, clean shaven, wearing sleeveless basketball jersey number 23, sport headband, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c046 · 우진 (SR) — 39세 여행 가이드 · slim · 민면
```
handsome korean mature man (39), subtle smile lines, tour guide, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, softly sloped brows, refined short nose, brown buzz cut, clean shaven, wearing fitted t-shirt, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c047 · 한결 (N) — 20세 회계사 · slim · 수염자국
```
handsome korean young man in his early-mid 20s (20), accountant, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, angular masculine brows, prominent strong nose, black short cropped hair, light stubble, wearing tailored suit with necktie, small gold earring, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c048 · 온유 (R) — 31세 도예가 · fit · 민면
```
handsome korean man in his late 20s to early 30s (31), youthful, ceramic artist, fit athletic build, toned, oval face, sharp upturned eyes, intense, angular masculine brows, prominent strong nose, espresso brown undercut hairstyle, clean shaven, wearing work apron over shirt, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c049 · 강현 (N) — 24세 미대생 · slim · 민면
```
handsome korean young man in his early-mid 20s (24), art college student, slim graceful build, elegant proportions, strong square jaw, balanced almond eyes, angular masculine brows, refined short nose, chestnut brown curly hair, clean shaven, wearing black gakuran school uniform with gold buttons, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c050 · 해성 (R) — 23세 건축가 · fit · 민면
```
handsome korean young man in his early-mid 20s (23), architect, fit athletic build, toned, oval face, balanced almond eyes, angular masculine brows, prominent strong nose, black middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in vivid and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c051 · 도영 (N) — 34세 서퍼 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (34), youthful, surfer, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, sharp upturned eyes, intense, straight thick brows, prominent strong nose, charcoal gray slicked-back pompadour, clean shaven, wearing athletic tank top, small gold earring, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c052 · 이안 (R) — 45세 철인3종 선수 · muscular · 수염자국
```
handsome korean distinguished man in his mid-late 40s (45), crow's feet and faint forehead line, dignified, triathlete, muscular broad-shouldered build, defined pecs and arms, oval face, sharp upturned eyes, intense, straight thick brows, straight defined nose, black-brown buzz cut, light stubble, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso in sports context, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in aqua and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c053 · 서준 (N) — 26세 드론 조종사 · bulky · 민면
```
handsome korean young man in his early-mid 20s (26), drone pilot, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, straight thick brows, prominent strong nose, dark brown short cropped hair, clean shaven, wearing pilot uniform with epaulettes, stylish glasses, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c054 · 하율 (R) — 37세 간호사 · fit · 민면
```
handsome korean mature man (37), subtle smile lines, nurse, fit athletic build, toned, oval face, balanced almond eyes, arched expressive brows, prominent strong nose, warm brown undercut hairstyle, clean shaven, wearing medical scrubs, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in pink and vivid tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c055 · 지율 (SSR) — 32세 태권도 국가대표 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (32), youthful, national taekwondo athlete, muscular broad-shouldered build, defined pecs and arms, strong square jaw, balanced almond eyes, straight thick brows, prominent strong nose, blue-black curly hair, clean shaven, wearing white taekwondo dobok with black v-neck trim, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in silver white and smoke gray tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c056 · 연우 (R) — 29세 호텔리어 · slim · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, hotelier, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, refined short nose, brown middle-parted hair, clean shaven, wearing bartender vest over dress shirt, loose tie, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in tangerine and rust tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c057 · 시현 (SSR) — 35세 배드민턴 선수 · slim · 수염자국
```
handsome korean man in his late 20s to early 30s (35), youthful, badminton player, slim graceful build, elegant proportions, strong square jaw, sharp upturned eyes, intense, softly sloped brows, refined short nose, black slicked-back pompadour, light stubble, wearing white badminton polo shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in gold and pink tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c058 · 준영 (N) — 21세 사진작가 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (21), photographer, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, arched expressive brows, straight defined nose, espresso brown buzz cut, light stubble, wearing fitted t-shirt, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c059 · 태호 (SR) — 32세 아나운서 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (32), youthful, news anchor, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, sharp upturned eyes, intense, angular masculine brows, refined short nose, chestnut brown short cropped hair, clean shaven, wearing tailored suit with necktie, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in cyan and indigo tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c060 · 동하 (N) — 43세 플랜트 집사 · fit · 민면
```
handsome korean mature man (43), subtle smile lines, plant shop owner, fit athletic build, toned, oval face, gentle round downturned eyes, soft, arched expressive brows, prominent strong nose, black undercut hairstyle, clean shaven, wearing work apron over shirt, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c061 · 루안 (SR) — 24세 공대생 · slim · 민면
```
handsome korean young man in his early-mid 20s (24), engineering student, slim graceful build, elegant proportions, oval face, gentle round downturned eyes, soft, angular masculine brows, refined short nose, charcoal gray curly hair, clean shaven, wearing black gakuran school uniform with gold buttons, stylish glasses, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in lavender and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c062 · 현빈 (N) — 35세 큐레이터 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (35), youthful, curator, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, angular masculine brows, prominent strong nose, black-brown middle-parted hair, light stubble, wearing button-up shirt with rolled sleeves, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c063 · 승현 (SR) — 46세 인명구조원 · muscular · 민면
```
handsome korean distinguished man in his mid-late 40s (46), crow's feet and faint forehead line, dignified, lifeguard, muscular broad-shouldered build, defined pecs and arms, oval face, balanced almond eyes, angular masculine brows, refined short nose, dark brown slicked-back pompadour, clean shaven, wearing athletic tank top, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in cyan and indigo tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c064 · 지훈 (N) — 27세 씨름 선수 · bulky · 수염
```
handsome korean man in his late 20s to early 30s (27), youthful, korean ssireum wrestler, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, gentle round downturned eyes, soft, softly sloped brows, prominent strong nose, warm brown buzz cut, full well-groomed beard, wearing traditional korean ssireum satba sash wrapped around waist, athletic bare torso in traditional sport context, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c065 · 민규 (R) — 38세 국악인 · bulky · 민면
```
handsome korean mature man (38), subtle smile lines, traditional korean musician, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, sharp upturned eyes, intense, softly sloped brows, straight defined nose, blue-black short cropped hair, clean shaven, wearing modern hanbok jeogori, playful wink, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in vivid and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c066 · 성진 (N) — 49세 약사 · slim · 민면
```
handsome korean distinguished man in his mid-late 40s (49), crow's feet and faint forehead line, dignified, pharmacist, slim graceful build, elegant proportions, oval face, gentle round downturned eyes, soft, angular masculine brows, refined short nose, brown undercut hairstyle, clean shaven, wearing medical scrubs, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c067 · 윤재 (R) — 30세 유도 선수 · muscular · 수염자국
```
handsome korean man in his late 20s to early 30s (30), youthful, judo athlete, muscular broad-shouldered build, defined pecs and arms, oval face, sharp upturned eyes, intense, arched expressive brows, prominent strong nose, black curly hair, light stubble, wearing white martial arts gi with colored belt, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in aqua and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c068 · 경수 (N) — 41세 소방관 · bulky · 수염
```
handsome korean mature man (41), subtle smile lines, firefighter, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, sharp upturned eyes, intense, straight thick brows, prominent strong nose, espresso brown middle-parted hair, full well-groomed beard, wearing firefighter turnout gear with suspenders over station tee, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c069 · 형준 (R) — 22세 탁구 선수 · muscular · 민면
```
handsome korean young man in his early-mid 20s (22), table tennis player, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, softly sloped brows, prominent strong nose, chestnut brown slicked-back pompadour, clean shaven, wearing white badminton polo shirt, stylish glasses, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in pink and vivid tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c070 · 재윤 (N) — 33세 반려견 훈련사 · fit · 민면
```
handsome korean man in his late 20s to early 30s (33), youthful, dog trainer, fit athletic build, toned, oval face, gentle round downturned eyes, soft, arched expressive brows, straight defined nose, black buzz cut, clean shaven, wearing fitted t-shirt, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c071 · 호진 (R) — 44세 웹툰 작가 · fit · 민면
```
handsome korean distinguished man in his mid-late 40s (44), crow's feet and faint forehead line, dignified, webtoon artist, fit athletic build, toned, oval face, sharp upturned eyes, intense, softly sloped brows, refined short nose, charcoal gray short cropped hair, clean shaven, wearing casual hoodie with drawstrings, small gold earring, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in tangerine and rust tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c072 · 범준 (N) — 25세 조향사 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (25), perfumer, fit athletic build, toned, sharp V-line chin, sharp upturned eyes, intense, arched expressive brows, refined short nose, black-brown undercut hairstyle, light stubble, wearing work apron over shirt, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c073 · 석현 (R) — 24세 음대생 · slim · 민면
```
handsome korean young man in his early-mid 20s (24), music student, slim graceful build, elegant proportions, strong square jaw, balanced almond eyes, arched expressive brows, prominent strong nose, dark brown curly hair, clean shaven, wearing black gakuran school uniform with gold buttons, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c074 · 진우 (SSR) — 38세 사서 · slim · 민면
```
handsome korean mature man (38), subtle smile lines, librarian, slim graceful build, elegant proportions, oval face, gentle round downturned eyes, soft, softly sloped brows, prominent strong nose, warm brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in orchid pink and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c075 · 규현 (R) — 28세 복싱 코치 · muscular · 수염자국
```
handsome korean man in his late 20s to early 30s (28), youthful, boxing coach, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, refined short nose, blue-black slicked-back pompadour, light stubble, wearing athletic tank top, small gold earring, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in vivid and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c076 · 상윤 (SSR) — 41세 씨름 천하장사 · bulky · 수염
```
handsome korean mature man (41), subtle smile lines, ssireum grand champion, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, sharp upturned eyes, intense, straight thick brows, prominent strong nose, brown buzz cut, full well-groomed beard, wearing traditional korean ssireum satba sash wrapped around waist, athletic bare torso in traditional sport context, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in emerald and aqua tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c077 · 태검 (N) — 20세 발레 강사 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (20), ballet instructor, fit athletic build, toned, oval face, balanced almond eyes, angular masculine brows, refined short nose, black short cropped hair, light stubble, wearing black long-sleeve dance leotard, stylish glasses, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c078 · 백호 (SR) — 31세 헬스 트레이너 · muscular · 수염자국
```
handsome korean man in his late 20s to early 30s (31), youthful, personal trainer, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, straight thick brows, refined short nose, espresso brown undercut hairstyle, light stubble, wearing athletic tank top, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c079 · 천둥 (N) — 42세 검도 사범 · muscular · 수염자국
```
handsome korean mature man (42), subtle smile lines, kendo master, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, sharp upturned eyes, intense, softly sloped brows, straight defined nose, chestnut brown curly hair, light stubble, wearing navy kendo dogi and hakama, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c080 · 마루 (SR) — 23세 산악구조대 · bulky · 수염
```
handsome korean young man in his early-mid 20s (23), mountain rescuer, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, angular masculine brows, refined short nose, black middle-parted hair, full well-groomed beard, wearing firefighter turnout gear with suspenders over station tee, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in rose red and royal purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c081 · 바다 (N) — 34세 테니스 코치 · fit · 민면
```
handsome korean man in his late 20s to early 30s (34), youthful, tennis coach, fit athletic build, toned, oval face, gentle round downturned eyes, soft, straight thick brows, prominent strong nose, charcoal gray slicked-back pompadour, clean shaven, wearing white badminton polo shirt, sport headband, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c082 · 산들 (SR) — 45세 목수 · bulky · 수염
```
handsome korean distinguished man in his mid-late 40s (45), crow's feet and faint forehead line, dignified, carpenter, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, gentle round downturned eyes, soft, straight thick brows, straight defined nose, black-brown buzz cut, full well-groomed beard, wearing fitted t-shirt, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c083 · 노을 (N) — 26세 게임 개발자 · bulky · 민면
```
handsome korean young man in his early-mid 20s (26), game developer, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, gentle round downturned eyes, soft, softly sloped brows, prominent strong nose, dark brown short cropped hair, clean shaven, wearing casual hoodie with drawstrings, small gold earring, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c084 · 가온 (R) — 37세 수제맥주 브루어 · bulky · 수염
```
handsome korean mature man (37), subtle smile lines, craft beer brewer, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, angular masculine brows, refined short nose, warm brown undercut hairstyle, full well-groomed beard, wearing work apron over shirt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in pink and vivid tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c085 · 새벽 (N) — 48세 축구 선수 · muscular · 민면
```
handsome korean distinguished man in his mid-late 40s (48), crow's feet and faint forehead line, dignified, soccer player, muscular broad-shouldered build, defined pecs and arms, oval face, balanced almond eyes, straight thick brows, prominent strong nose, blue-black curly hair, clean shaven, wearing soccer jersey with number 10, stylish glasses, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c086 · 여름 (R) — 29세 통역사 · slim · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, interpreter, slim graceful build, elegant proportions, strong square jaw, gentle round downturned eyes, soft, softly sloped brows, prominent strong nose, brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in tangerine and rust tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c087 · 겨울 (N) — 40세 파티시에 · slim · 수염자국
```
handsome korean mature man (40), subtle smile lines, patissier, slim graceful build, elegant proportions, sharp V-line chin, balanced almond eyes, softly sloped brows, straight defined nose, black slicked-back pompadour, light stubble, wearing double-breasted chef whites, small gold earring, playful wink, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c088 · 우람 (R) — 34세 료칸 지배인 · fit · 민면
```
handsome korean man in his late 20s to early 30s (34), youthful, ryokan manager, fit athletic build, toned, strong square jaw, gentle round downturned eyes, soft, straight thick brows, refined short nose, espresso brown buzz cut, clean shaven, wearing dark yukata with obi belt, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c089 · 힘찬 (N) — 32세 현대무용수 · fit · 민면
```
handsome korean man in his late 20s to early 30s (32), youthful, contemporary dancer, fit athletic build, toned, strong square jaw, balanced almond eyes, angular masculine brows, prominent strong nose, chestnut brown short cropped hair, clean shaven, wearing black long-sleeve dance leotard, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c090 · 슬기 (R) — 43세 크로스핏 코치 · muscular · 수염자국
```
handsome korean mature man (43), subtle smile lines, crossfit coach, muscular broad-shouldered build, defined pecs and arms, oval face, balanced almond eyes, straight thick brows, prominent strong nose, black undercut hairstyle, light stubble, wearing athletic tank top, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in vivid and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c091 · 보검 (N) — 24세 주짓수 코치 · muscular · 수염자국
```
handsome korean young man in his early-mid 20s (24), jiujitsu coach, muscular broad-shouldered build, defined pecs and arms, strong square jaw, sharp upturned eyes, intense, softly sloped brows, refined short nose, charcoal gray curly hair, light stubble, wearing white martial arts gi with colored belt, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c092 · 한울 (R) — 35세 해양경찰 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (35), youthful, coast guard officer, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, arched expressive brows, straight defined nose, black-brown middle-parted hair, light stubble, wearing pilot uniform with epaulettes, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in aqua and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c093 · 누리 (SSR) — 44세 응급구조사 · bulky · 민면
```
handsome korean distinguished man in his mid-late 40s (44), crow's feet and faint forehead line, dignified, paramedic, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, gentle round downturned eyes, soft, arched expressive brows, straight defined nose, dark brown slicked-back pompadour, clean shaven, wearing medical scrubs, stylish glasses, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in gold and pink tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c094 · 아라 (N) — 27세 자동차 정비사 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (27), youthful, car mechanic, fit athletic build, toned, strong square jaw, gentle round downturned eyes, soft, angular masculine brows, refined short nose, warm brown buzz cut, light stubble, wearing fitted t-shirt, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c095 · 도담 (SSR) — 47세 프로게이머 · slim · 민면
```
handsome korean distinguished man in his mid-late 40s (47), crow's feet and faint forehead line, dignified, pro gamer, slim graceful build, elegant proportions, oval face, gentle round downturned eyes, soft, angular masculine brows, refined short nose, blue-black short cropped hair, clean shaven, wearing casual hoodie with drawstrings, small gold earring, confident direct gaze, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in silver white and smoke gray tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c096 · 벼리 (N) — 49세 바리스타 · slim · 민면
```
handsome korean distinguished man in his mid-late 40s (49), crow's feet and faint forehead line, dignified, barista, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, softly sloped brows, prominent strong nose, brown undercut hairstyle, clean shaven, wearing work apron over shirt, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c097 · 믿음 (SR) — 30세 풋살 코치 · slim · 수염자국
```
handsome korean man in his late 20s to early 30s (30), youthful, futsal coach, slim graceful build, elegant proportions, oval face, sharp upturned eyes, intense, straight thick brows, straight defined nose, black curly hair, light stubble, wearing soccer jersey with number 10, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in lavender and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c098 · 기람 (N) — 41세 천문학자 · fit · 민면
```
handsome korean mature man (41), subtle smile lines, astronomer, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, straight defined nose, espresso brown middle-parted hair, clean shaven, wearing button-up shirt with rolled sleeves, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c099 · 솔찬 (SR) — 22세 스시 셰프 · muscular · 수염자국
```
handsome korean young man in his early-mid 20s (22), sushi chef, muscular broad-shouldered build, defined pecs and arms, oval face, balanced almond eyes, softly sloped brows, prominent strong nose, chestnut brown slicked-back pompadour, light stubble, wearing double-breasted chef whites, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in cyan and indigo tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c100 · 윤슬비 (N) — 33세 유카타 찻집 주인 · fit · 민면
```
handsome korean man in his late 20s to early 30s (33), youthful, teahouse owner, fit athletic build, toned, oval face, gentle round downturned eyes, soft, arched expressive brows, straight defined nose, black buzz cut, clean shaven, wearing dark yukata with obi belt, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c101 · 담율 (SR) — 44세 배우 · fit · 민면
```
handsome korean distinguished man in his mid-late 40s (44), crow's feet and faint forehead line, dignified, actor, fit athletic build, toned, sharp V-line chin, balanced almond eyes, arched expressive brows, straight defined nose, charcoal gray short cropped hair, clean shaven, wearing black stage outfit with glitter accents, stylish glasses, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in lavender and violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c102 · 현담 (N) — 25세 클라이밍 강사 · muscular · 수염자국
```
handsome korean young man in his early-mid 20s (25), climbing instructor, muscular broad-shouldered build, defined pecs and arms, oval face, gentle round downturned eyes, soft, angular masculine brows, straight defined nose, black-brown undercut hairstyle, light stubble, wearing athletic tank top, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c103 · 무결 (R) — 36세 합기도 사범 · muscular · 민면
```
handsome korean mature man (36), subtle smile lines, hapkido master, muscular broad-shouldered build, defined pecs and arms, oval face, gentle round downturned eyes, soft, angular masculine brows, refined short nose, dark brown curly hair, clean shaven, wearing white martial arts gi with colored belt, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c104 · 서강 (N) — 47세 항해사 · fit · 수염
```
handsome korean distinguished man in his mid-late 40s (47), crow's feet and faint forehead line, dignified, ship navigator, fit athletic build, toned, oval face, gentle round downturned eyes, soft, straight thick brows, prominent strong nose, warm brown middle-parted hair, full well-groomed beard, wearing pilot uniform with epaulettes, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c105 · 한별 (R) — 28세 물리치료사 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (28), youthful, physical therapist, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, balanced almond eyes, straight thick brows, refined short nose, blue-black slicked-back pompadour, clean shaven, wearing medical scrubs, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in vivid and deep violet tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c106 · 은결 (N) — 39세 스트리머 · slim · 민면
```
handsome korean mature man (39), subtle smile lines, streamer, slim graceful build, elegant proportions, oval face, gentle round downturned eyes, soft, straight thick brows, straight defined nose, brown buzz cut, clean shaven, wearing casual hoodie with drawstrings, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in warm gray and umber tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c107 · 도하 (R) — 20세 소믈리에 · slim · 수염자국
```
handsome korean young man in his early-mid 20s (20), sommelier, slim graceful build, elegant proportions, sharp V-line chin, sharp upturned eyes, intense, softly sloped brows, straight defined nose, black short cropped hair, light stubble, wearing bartender vest over dress shirt, loose tie, small gold earring, playful wink, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in aqua and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c108 · 류진 (N) — 31세 골키퍼 · fit · 민면
```
handsome korean man in his late 20s to early 30s (31), youthful, goalkeeper, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, arched expressive brows, refined short nose, espresso brown undercut hairstyle, clean shaven, wearing soccer jersey with number 10, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in violet and deep purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c109 · 백현 (R) — 42세 교사 · muscular · 민면
```
handsome korean mature man (42), subtle smile lines, teacher, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, sharp upturned eyes, intense, straight thick brows, prominent strong nose, chestnut brown curly hair, clean shaven, wearing button-up shirt with rolled sleeves, stylish glasses, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in pink and vivid tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c110 · 시우진 (N) — 23세 경호원 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (23), bodyguard, fit athletic build, toned, sharp V-line chin, sharp upturned eyes, intense, angular masculine brows, prominent strong nose, black middle-parted hair, light stubble, wearing tailored suit with necktie, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in vivid and pine tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c111 · 강토르 (R) — 34세 브런치 셰프 · fit · 민면
```
handsome korean man in his late 20s to early 30s (34), youthful, brunch chef, fit athletic build, toned, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, straight defined nose, charcoal gray slicked-back pompadour, clean shaven, wearing double-breasted chef whites, small gold earring, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in tangerine and rust tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c112 · 제이 (SSR) — 49세 온천 마을 안내인 · fit · 수염자국
```
handsome korean distinguished man in his mid-late 40s (49), crow's feet and faint forehead line, dignified, hot spring village guide, fit athletic build, toned, strong square jaw, sharp upturned eyes, intense, softly sloped brows, prominent strong nose, black-brown buzz cut, light stubble, wearing dark yukata with obi belt, confident direct gaze, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in emerald and aqua tones, mature masculine anime illustration, bara manga style, thick clean lineart, masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere, SFW --ar 20:27
```

### c113 · 카이 (N) — 26세 뮤지컬 배우 · fit · 민면
```
handsome korean young man in his early-mid 20s (26), musical actor, fit athletic build, toned, sharp V-line chin, balanced almond eyes, softly sloped brows, straight defined nose, dark brown short cropped hair, clean shaven, wearing black stage outfit with glitter accents, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c114 · 레오 (SR) — 37세 럭비 선수 · bulky · 수염
```
handsome korean mature man (37), subtle smile lines, rugby player, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, angular masculine brows, prominent strong nose, warm brown undercut hairstyle, full well-groomed beard, wearing athletic tank top, playful wink, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c115 · 노아 (N) — 48세 수영 선수 · muscular · 민면
```
handsome korean distinguished man in his mid-late 40s (48), crow's feet and faint forehead line, dignified, competitive swimmer, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, sharp upturned eyes, intense, angular masculine brows, prominent strong nose, blue-black buzz cut, clean shaven, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso in sports context, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c116 · 단우 (SR) — 29세 승무원 · slim · 민면
```
handsome korean man in his late 20s to early 30s (29), youthful, flight attendant, slim graceful build, elegant proportions, strong square jaw, gentle round downturned eyes, soft, arched expressive brows, straight defined nose, brown middle-parted hair, clean shaven, wearing pilot uniform with epaulettes, warm smiling eyes, subtle soft smile, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in rose red and royal purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c117 · 률아 (N) — 40세 한의사 · slim · 수염자국
```
handsome korean mature man (40), subtle smile lines, korean medicine doctor, slim graceful build, elegant proportions, sharp V-line chin, gentle round downturned eyes, soft, arched expressive brows, prominent strong nose, black slicked-back pompadour, light stubble, wearing medical scrubs, stylish glasses, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c118 · 혁준 (SR) — 21세 힙합 프로듀서 · fit · 수염자국
```
handsome korean young man in his early-mid 20s (21), hiphop producer, fit athletic build, toned, sharp V-line chin, sharp upturned eyes, intense, angular masculine brows, refined short nose, espresso brown buzz cut, light stubble, wearing casual hoodie with drawstrings, warm smiling eyes, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in orange and red tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c119 · 검호 (N) — 32세 재즈 피아니스트 · muscular · 민면
```
handsome korean man in his late 20s to early 30s (32), youthful, jazz pianist, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, balanced almond eyes, angular masculine brows, prominent strong nose, chestnut brown short cropped hair, clean shaven, wearing bartender vest over dress shirt, loose tie, small gold earring, confident direct gaze, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, dramatic god rays background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c120 · 웅재 (SR) — 43세 농구 선수 · muscular · 민면
```
handsome korean mature man (43), subtle smile lines, basketball player, muscular broad-shouldered build, defined pecs and arms, strong square jaw, gentle round downturned eyes, soft, straight thick brows, refined short nose, black undercut hairstyle, clean shaven, wearing sleeveless basketball jersey number 23, warm smiling eyes, bright confident grin, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in rose red and royal purple tones, mature masculine anime illustration, bara manga style, thick clean lineart, highly detailed rendering, dramatic rim light, glowing particles, SFW --ar 20:27
```

### c121 · 산하 (N) — 24세 플로리스트 · fit · 민면
```
handsome korean young man in his early-mid 20s (24), florist, fit athletic build, toned, sharp V-line chin, balanced almond eyes, angular masculine brows, refined short nose, charcoal gray curly hair, clean shaven, wearing button-up shirt with rolled sleeves, playful wink, gentle smile, chest-up bust portrait facing viewer, face in upper half of frame, starry night sky background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c122 · 도원 (R) — 35세 변호사 · fit · 수염자국
```
handsome korean man in his late 20s to early 30s (35), youthful, lawyer, fit athletic build, toned, strong square jaw, balanced almond eyes, straight thick brows, prominent strong nose, black-brown middle-parted hair, light stubble, wearing tailored suit with necktie, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, floating music notes, concert glow background in aqua and royal blue tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c123 · 해린 (N) — 46세 정육 장인 · bulky · 수염자국
```
handsome korean distinguished man in his mid-late 40s (46), crow's feet and faint forehead line, dignified, master butcher, big burly bear build, heavyset thick muscle, powerful frame, strong square jaw, balanced almond eyes, straight thick brows, refined short nose, dark brown slicked-back pompadour, light stubble, wearing work apron over shirt, small gold earring, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, night city skyline with bokeh lights background in blue and navy tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c124 · 무현 (R) — 21세 체대생 · slim · 민면
```
handsome korean young man in his early-mid 20s (21), phys-ed college student, slim graceful build, elegant proportions, strong square jaw, gentle round downturned eyes, soft, softly sloped brows, straight defined nose, warm brown buzz cut, clean shaven, wearing black gakuran school uniform with gold buttons, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, falling flower petals background in pink and vivid tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c125 · 강율 (N) — 38세 인디 보컬 · fit · 민면
```
handsome korean mature man (38), subtle smile lines, indie vocalist, fit athletic build, toned, oval face, balanced almond eyes, straight thick brows, straight defined nose, blue-black short cropped hair, clean shaven, wearing black stage outfit with glitter accents, stylish glasses, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, soft dreamy bokeh lights background in steel and dark slate tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c126 · 호수 (R) — 49세 배구 선수 · muscular · 민면
```
handsome korean distinguished man in his mid-late 40s (49), crow's feet and faint forehead line, dignified, volleyball player, muscular broad-shouldered build, defined pecs and arms, strong square jaw, sharp upturned eyes, intense, arched expressive brows, straight defined nose, brown undercut hairstyle, clean shaven, wearing athletic tank top, warm smiling eyes, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in tangerine and rust tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

### c127 · 별하 (N) — 30세 다이빙 선수 · muscular · 수염자국
```
handsome korean man in his late 20s to early 30s (30), youthful, diver, muscular broad-shouldered build, defined pecs and arms, sharp V-line chin, gentle round downturned eyes, soft, straight thick brows, straight defined nose, black buzz cut, light stubble, wearing competition swim gear, goggles pushed up on forehead, athletic bare torso in sports context, playful wink, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, ocean waves and sea spray background in amber and bronze tones, mature masculine anime illustration, bara manga style, thick clean lineart, clean cel shading, SFW --ar 20:27
```

### c128 · 찬율 (R) — 41세 기관사 · fit · 민면
```
handsome korean mature man (41), subtle smile lines, train engineer, fit athletic build, toned, oval face, sharp upturned eyes, intense, arched expressive brows, refined short nose, espresso brown middle-parted hair, clean shaven, wearing pilot uniform with epaulettes, confident direct gaze, charming smirk, chest-up bust portrait facing viewer, face in upper half of frame, snowy mountain peaks background in teal and dark teal tones, mature masculine anime illustration, bara manga style, thick clean lineart, polished cel shading, rim lighting, SFW --ar 20:27
```

---
*얼굴·손 재검수 필수. 프롬프트는 cards.js 데이터에서 자동 생성 — 도감과 항상 동기화됩니다.*
