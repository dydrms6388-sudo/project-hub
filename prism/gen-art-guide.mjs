// PRISM-ART-GUIDE.md 자동 생성 — cards.js 데이터와 항상 동기화
// 사용: node prism/gen-art-guide.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const dir = dirname(fileURLToPath(import.meta.url));
globalThis.window = {};
require(join(dir, "cards.js"));
const { CHARS } = globalThis.window.PRISM_CARDS;

const JOB_EN = { "바리스타":"barista","대학생":"college student","서점 직원":"bookstore clerk","요가 강사":"yoga instructor","플로리스트":"florist","사진작가":"photographer","셰프":"chef","필라테스 코치":"pilates coach","DJ":"DJ","바텐더":"bartender","수의사":"veterinarian","소방관":"firefighter","수영 코치":"swimming coach","파일럿":"airline pilot","아이돌":"k-pop idol","발레리노":"ballet dancer","경호원":"bodyguard","변호사":"lawyer","회계사":"accountant","아나운서":"news anchor","웹툰 작가":"webtoon artist","게임 개발자":"game developer","프로게이머":"pro gamer","게임단 감독":"esports team coach","스트리머":"streamer","힙합 프로듀서":"hiphop producer","태권도 사범":"taekwondo master","태권도 국가대표":"national taekwondo athlete","유도 선수":"judo athlete","유도 코치":"judo coach","검도 사범":"kendo master","주짓수 코치":"jiujitsu coach","합기도 사범":"hapkido master","수영 선수":"competitive swimmer","수영 코치":"swimming coach","다이빙 선수":"diver","철인3종 선수":"triathlete","철인3종 코치":"triathlon coach","씨름 선수":"korean ssireum wrestler","씨름 천하장사":"ssireum grand champion","료칸 지배인":"ryokan manager","유카타 찻집 주인":"teahouse owner","온천 마을 안내인":"hot spring village guide","체대생":"phys-ed college student","미대생":"art college student","공대생":"engineering student","음대생":"music student","축구 선수":"soccer player","축구 코치":"soccer coach","풋살 코치":"futsal coach","골키퍼":"goalkeeper","농구 선수":"basketball player","농구 코치":"basketball coach","스트릿볼러":"streetball player","배드민턴 선수":"badminton player","배드민턴 코치":"badminton coach","탁구 선수":"table tennis player","탁구 코치":"table tennis coach","테니스 코치":"tennis coach","배구 선수":"volleyball player","배구 코치":"volleyball coach","응급구조사":"paramedic","물리치료사":"physical therapist","한의사":"korean medicine doctor","치과의사":"dentist","간호사":"nurse","약사":"pharmacist","헬스 트레이너":"personal trainer","크로스핏 코치":"crossfit coach","클라이밍 강사":"climbing instructor","럭비 선수":"rugby player","럭비 코치":"rugby coach","서퍼":"surfer","인명구조원":"lifeguard","복싱 코치":"boxing coach","파티시에":"patissier","스시 셰프":"sushi chef","브런치 셰프":"brunch chef","정육 장인":"master butcher","도예가":"ceramic artist","플랜트 집사":"plant shop owner","조향사":"perfumer","수제맥주 브루어":"craft beer brewer","소믈리에":"sommelier","재즈 피아니스트":"jazz pianist","마술사":"magician","호텔리어":"hotelier","산악구조대":"mountain rescuer","해양경찰":"coast guard officer","항해사":"ship navigator","승무원":"flight attendant","기관사":"train engineer","드론 조종사":"drone pilot","국악인":"traditional korean musician","발레 강사":"ballet instructor","현대무용수":"contemporary dancer","배우":"actor","뮤지컬 배우":"musical actor","인디 보컬":"indie vocalist","건축가":"architect","큐레이터":"curator","사서":"librarian","통역사":"interpreter","천문학자":"astronomer","교사":"teacher","여행 가이드":"tour guide","반려견 훈련사":"dog trainer","목수":"carpenter","자동차 정비사":"car mechanic" };
const HAIR_EN = { crop:"short cropped hair", undercut:"undercut hairstyle", curly:"curly hair", mid:"middle-parted hair", pomp:"slicked-back pompadour", buzz:"buzz cut" };
const HCOLOR_EN = { "#1f1f28":"black","#17120e":"black","#3d2b1f":"dark brown","#4a3527":"brown","#5b3a24":"chestnut brown","#26201c":"black-brown","#0e2a3a":"blue-black","#241a12":"espresso brown","#3b3b45":"charcoal gray","#5c4033":"warm brown","#e6d3ff":"pale lavender","#101014":"jet black","#141414":"black","#1c1c22":"black","#111":"black","#1a1a20":"black","#2b2b33":"charcoal" };
const BUILD_EN = { slim:"slim graceful build, elegant proportions", fit:"fit athletic build, toned", muscular:"muscular broad-shouldered build, defined pecs and arms", bulky:"big burly bear build, heavyset thick muscle, powerful frame" };
const JAW_EN = ["oval face", "strong square jaw", "sharp V-line chin"];
const EYESHAPE_EN = ["balanced almond eyes", "intense sharp upturned eyes", "soft gentle round downturned eyes"];
const BROW_EN = ["angular masculine brows", "arched expressive brows", "straight thick brows", "softly sloped brows"];
const NOSE_EN = ["refined short nose", "straight defined nose", "prominent strong nose"];
const AURA_NAME = (hex) => ({"#8b5cf6":"violet","#6d28d9":"deep violet","#3b82f6":"blue","#1d4ed8":"royal blue","#2dd4bf":"teal","#0d9488":"deep teal","#34d399":"emerald","#059669":"deep green","#f472b6":"pink","#db2777":"magenta","#94a3b8":"silver gray","#475569":"slate","#f59e0b":"amber","#d97706":"burnt orange","#f43f5e":"rose red","#be123c":"crimson","#0ea5e9":"sky blue","#0369a1":"deep ocean blue","#a855f7":"purple","#7e22ce":"royal purple","#22c55e":"green","#15803d":"forest green","#f97316":"orange","#dc2626":"red","#38bdf8":"aqua","#2563eb":"cobalt","#818cf8":"periwinkle","#4f46e5":"indigo","#e879f9":"orchid pink","#f5f5f5":"silver white","#71717a":"smoke gray","#64748b":"steel","#334155":"dark slate","#78716c":"warm gray","#44403c":"umber","#1e3a8a":"navy","#065f46":"pine","#92400e":"bronze","#4c1d95":"deep purple","#0f766e":"dark teal","#fb923c":"tangerine","#c2410c":"rust","#c084fc":"lavender","#7c3aed":"violet","#22d3ee":"cyan","#fbbf24":"gold"}[hex] || "vivid");
const BG_EN = { stars:"starry night sky", waves:"ocean waves and sea spray", city:"night city skyline with bokeh lights", peaks:"snowy mountain peaks", bokeh:"soft dreamy bokeh lights", notes:"floating music notes, concert glow", rays:"dramatic god rays", petals:"falling flower petals" };
const OUTFIT_EN = { tee:"fitted t-shirt", tank:"athletic tank top", shirt:"button-up shirt with rolled sleeves", chef:"double-breasted chef whites", vest:"bartender vest over dress shirt, loose tie", scrub:"medical scrubs", fire:"firefighter turnout gear with suspenders over station tee", pilot:"pilot uniform with epaulettes", stage:"black stage outfit with glitter accents", ballet:"black long-sleeve dance leotard", apron:"work apron over shirt", suit:"tailored suit with necktie", hoodie:"casual hoodie with drawstrings", gi:"white martial arts gi with colored belt", dobok:"white taekwondo dobok with black v-neck trim", swim:"competition swim gear, goggles pushed up on forehead, athletic bare torso in sports context", ssireum:"traditional korean ssireum satba sash worn diagonally across chest and around waist, athletic bare torso in traditional sport context", kimono:"dark yukata with obi belt", school:"black gakuran school uniform with gold buttons", soccer:"soccer jersey with number 10", basketball:"sleeveless basketball jersey number 23", badminton:"white badminton polo shirt" };
const EYE_EN = { open:"confident direct gaze", smile:"warm smiling eyes", wink:"playful wink" };
const MOUTH_EN = { smile:"gentle smile", grin:"bright confident grin", smirk:"charming smirk", soft:"subtle soft smile" };
const ACC_EN = { earring:"small gold earring", glasses:"stylish glasses", headphones:"dj headphones around head", flower:"small flower tucked behind ear", choker:"black choker", goggles:"", headband:"sport headband", none:"" };
const AGE_EN = (a) => a < 27 ? `young man in his early-mid 20s (${a})` : a < 36 ? `man in his late 20s to early 30s (${a}), youthful` : a < 44 ? `mature man (${a}), subtle smile lines` : `distinguished man in his mid-late 40s (${a}), crow's feet and faint forehead line, dignified`;
const R_STYLE = { N:"clean cel shading", R:"polished cel shading, rim lighting", SR:"highly detailed rendering, dramatic rim light, glowing particles", SSR:"masterpiece, cinematic lighting, iridescent particle effects, ornate golden atmosphere" };
const STUBBLE_EN = (s) => s === 2 ? "full well-groomed beard" : s === 1 ? "light stubble" : "clean shaven";
const OUTFIT_OVERRIDE = { "검도 사범":"navy kendo dogi and hakama", "국악인":"modern hanbok jeogori" };

let md = `# PRISM 크러시 카드 — AI 일러스트 제작 가이드 v4

생성: node prism/gen-art-guide.mjs (cards.js와 자동 동기화 — 직접 수정 금지)

## 파이프라인
1. 프롬프트로 생성 (1024×1382, MJ \`--ar 20:27\`) → 2. \`prism/art/c001.webp\` 저장 → 3. \`node prism/gen-art-manifest.mjs\` → 자동 반영
제작 순서: SSR 12 → SR 24 → R → N

## 캐릭터 일관성 (필수)
1. 카드 프롬프트로 3-view 캐릭터 시트 1장 → 얼굴 확정
2. MJ \`--cref <시트> --cw 60\` / SD는 IP-Adapter·reference
3. 같은 모델·스타일 문구 유지, 10장 단위 검수

## 공통 스타일
- 한국 게이 망가/바라 풍 성인 남성, 굵은 선 셀셰이딩
- 가슴 위 버스트, 정면~15도, 얼굴 상단 절반 (하단 22% UI)
- 수위: 기본 착의 · 수영/씨름 경기복 예외(선정 연출 금지) · 미성년 외모/실존 유사/텍스트 금지
- SD 네거티브: \`text, watermark, extra fingers, deformed hands, child, teenage face, photorealistic\`
  (slim 카드는 'feminine face' 금지 / muscular·bulky만 선택 추가)

## 카드별 프롬프트 (128장)

`;

for (const c of CHARS) {
  const f = c.face || { jaw: 0, eyeShape: 0, brow: 0, nose: 1 };
  const outfit = OUTFIT_OVERRIDE[c.job] || OUTFIT_EN[c.outfit[0]] || "casual outfit";
  const parts = [
    `handsome korean ${AGE_EN(c.age)}`,
    JOB_EN[c.job] || "professional",
    BUILD_EN[c.build] || BUILD_EN.fit,
    JAW_EN[f.jaw], EYESHAPE_EN[f.eyeShape], BROW_EN[f.brow], NOSE_EN[f.nose],
    `${HCOLOR_EN[c.hair[1]] || "dark"} ${HAIR_EN[c.hair[0]]}`,
    STUBBLE_EN(c.stubble),
    `wearing ${outfit}`,
    ACC_EN[c.acc] || "",
    EYE_EN[c.eye], MOUTH_EN[c.mouth],
    `chest-up bust portrait facing viewer, face in upper half of frame`,
    `${BG_EN[c.bg || "stars"]} background in ${AURA_NAME(c.aura[0])} and ${AURA_NAME(c.aura[1])} tones`,
    `mature masculine anime illustration, bara manga style, thick clean lineart`,
    R_STYLE[c.rarity], "SFW",
  ].filter(Boolean);
  md += `### ${c.id} · ${c.name} (${c.rarity}) — ${c.age}세 ${c.job} · ${c.build} · ${c.stubble===2?"수염":c.stubble?"수염자국":"민면"}\n\`\`\`\n${parts.join(", ")} --ar 20:27\n\`\`\`\n\n`;
}
md += `---\n*얼굴·손 재검수 필수. cards.js 변경 시 이 스크립트를 재실행하세요.*\n`;
writeFileSync(join(dir, "..", "PRISM-ART-GUIDE.md"), md);
console.log("guide v4:", md.length, "chars,", CHARS.length, "prompts");
