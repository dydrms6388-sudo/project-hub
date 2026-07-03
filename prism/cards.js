/* PRISM 크러시 카드 — 절차적 SVG 캐릭터 (바라/망가풍 근육질 남성 일러스트)
   모든 인물은 가상의 성인 일러스트 캐릭터입니다. */
(function () {
  "use strict";

  const SKIN = ["#ffd2a8", "#f0b98a", "#dfa070", "#c08252"];
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  };

  /* 캐릭터 16종 — rarity: N(6) R(5) SR(3) SSR(2) */
  const CHARS = [
    { id: "c01", name: "도윤", job: "바리스타", rarity: "N", skin: 0, hair: ["crop", "#3d2b1f"], outfit: ["apron", "#7c5cff", "#23232e"], acc: "none", eye: "smile", mouth: "smile", stubble: 0, aura: ["#8b5cf6", "#6d28d9"], line: "오늘의 원두는 제가 골라드릴게요." },
    { id: "c02", name: "하람", job: "대학생", rarity: "N", skin: 1, hair: ["mid", "#1f1f28"], outfit: ["tee", "#3b82f6"], acc: "none", eye: "open", mouth: "grin", stubble: 0, aura: ["#3b82f6", "#1d4ed8"], line: "과제 끝나면 같이 야식 어때요?" },
    { id: "c03", name: "은호", job: "서점 직원", rarity: "N", skin: 0, hair: ["mid", "#4a3527"], outfit: ["shirt", "#2dd4bf"], acc: "glasses", eye: "smile", mouth: "smile", stubble: 0, aura: ["#2dd4bf", "#0d9488"], line: "당신께 어울리는 책을 찾았어요." },
    { id: "c04", name: "시우", job: "요가 강사", rarity: "N", skin: 2, hair: ["buzz", "#26201c"], outfit: ["tank", "#34d399"], acc: "earring", eye: "smile", mouth: "smile", stubble: 1, aura: ["#34d399", "#059669"], line: "호흡부터 같이 맞춰볼까요?" },
    { id: "c05", name: "로운", job: "플로리스트", rarity: "N", skin: 1, hair: ["curly", "#5b3a24"], outfit: ["shirt", "#f472b6"], acc: "flower", eye: "open", mouth: "smile", stubble: 0, aura: ["#f472b6", "#db2777"], line: "이 꽃, 당신 생각나서 골랐어요." },
    { id: "c06", name: "재이", job: "사진작가", rarity: "N", skin: 0, hair: ["undercut", "#2b2b33"], outfit: ["tee", "#111827"], acc: "earring", eye: "open", mouth: "smirk", stubble: 1, aura: ["#94a3b8", "#475569"], line: "렌즈 너머로도 빛나는 사람이네요." },
    { id: "c07", name: "태오", job: "셰프", rarity: "R", skin: 1, hair: ["crop", "#141414"], outfit: ["chef", "#f8fafc"], acc: "none", eye: "open", mouth: "grin", stubble: 1, aura: ["#f59e0b", "#d97706"], line: "내 파스타 한 입이면 넘어올걸요." },
    { id: "c08", name: "무진", job: "필라테스 코치", rarity: "R", skin: 2, hair: ["undercut", "#1c1c22"], outfit: ["tank", "#f43f5e"], acc: "none", eye: "wink", mouth: "smirk", stubble: 0, aura: ["#f43f5e", "#be123c"], line: "코어에 힘! 시선은 나한테." },
    { id: "c09", name: "반", job: "DJ", rarity: "R", skin: 3, hair: ["buzz", "#111"], outfit: ["tee", "#0ea5e9"], acc: "headphones", eye: "wink", mouth: "grin", stubble: 1, aura: ["#0ea5e9", "#0369a1"], line: "다음 트랙은 우리 둘 얘기예요." },
    { id: "c10", name: "제노", job: "바텐더", rarity: "R", skin: 0, hair: ["pomp", "#241a12"], outfit: ["vest", "#1e293b"], acc: "earring", eye: "open", mouth: "smirk", stubble: 1, aura: ["#a855f7", "#7e22ce"], line: "당신 취향으로 한 잔, 말아볼게요." },
    { id: "c11", name: "늘봄", job: "수의사", rarity: "R", skin: 1, hair: ["mid", "#3a2d22"], outfit: ["scrub", "#22c55e"], acc: "none", eye: "smile", mouth: "smile", stubble: 0, aura: ["#22c55e", "#15803d"], line: "강아지도 당신도, 제가 지켜줄게요." },
    { id: "c12", name: "강토", job: "소방관", rarity: "SR", skin: 2, hair: ["crop", "#17120e"], outfit: ["fire", "#374151"], acc: "none", eye: "open", mouth: "grin", stubble: 1, aura: ["#f97316", "#dc2626"], line: "위험한 건 불이지, 내가 아니에요." },
    { id: "c13", name: "파도", job: "수영 코치", rarity: "SR", skin: 2, hair: ["undercut", "#0e2a3a"], outfit: ["tank", "#38bdf8"], acc: "none", eye: "wink", mouth: "grin", stubble: 0, aura: ["#38bdf8", "#2563eb"], line: "물살보다 빠르게 스며들게요." },
    { id: "c14", name: "윤슬", job: "파일럿", rarity: "SR", skin: 0, hair: ["pomp", "#1a1a20"], outfit: ["pilot", "#0f172a"], acc: "none", eye: "smile", mouth: "smirk", stubble: 1, aura: ["#818cf8", "#4f46e5"], line: "다음 목적지는 당신 마음이에요." },
    { id: "c15", name: "세인트", job: "아이돌", rarity: "SSR", skin: 0, hair: ["mid", "#e6d3ff"], outfit: ["stage", "#0b0b14"], acc: "earring", eye: "wink", mouth: "smile", stubble: 0, aura: ["#e879f9", "#8b5cf6"], line: "무대 위 십만 명보다, 너 하나." },
    { id: "c16", name: "느와르", job: "발레리노", rarity: "SSR", skin: 1, hair: ["mid", "#101014"], outfit: ["ballet", "#18181b"], acc: "choker", eye: "open", mouth: "smirk", stubble: 0, aura: ["#f5f5f5", "#71717a"], line: "마지막 회전은 당신 앞에서." },
  ];

  const RARITY = {
    N: { label: "N", weight: 60, color: "#94a3b8", frame: "linear-gradient(160deg,#334155,#1e293b)" },
    R: { label: "R", weight: 27, color: "#38bdf8", frame: "linear-gradient(160deg,#0ea5e9,#1d4ed8)" },
    SR: { label: "SR", weight: 10, color: "#c084fc", frame: "linear-gradient(160deg,#c084fc,#7c3aed)" },
    SSR: { label: "SSR", weight: 3, color: "#fbbf24", frame: "linear-gradient(120deg,#fbbf24,#f472b6,#818cf8,#34d399)" },
  };

  /* ── 얼굴 파츠 (망가풍 — 각진 턱, 낮고 두꺼운 눈썹, 날카로운 눈) ── */
  function hairSVG(style, color) {
    const hi = shade(color, 1.7);
    switch (style) {
      case "crop": return `<path d="M58,94 C56,50 78,36 100,36 C122,36 144,50 142,94 C140,72 126,61 100,61 C74,61 60,72 58,94Z" fill="${color}"/>
        <path d="M68,54 L76,46 M84,50 L90,43 M100,48 L104,41 M116,50 L122,44" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
        <path d="M74,52 C84,46 96,44 106,45" stroke="${hi}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`;
      case "undercut": return `<path d="M58,94 C56,48 80,36 104,36 C130,36 144,56 142,88 C138,62 124,54 98,56 C74,58 62,72 58,94Z" fill="${color}"/>
        <path d="M61,82 C61,68 70,58 84,53 L79,46 C64,52 58,66 57,82Z" fill="${shade(color, 0.55)}"/>
        <path d="M86,50 C98,44 114,44 124,50" stroke="${hi}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".55"/>`;
      case "curly": return `<g fill="${color}"><circle cx="70" cy="62" r="14"/><circle cx="88" cy="50" r="15"/><circle cx="110" cy="49" r="15"/><circle cx="128" cy="60" r="13"/><circle cx="139" cy="78" r="10"/><circle cx="61" cy="79" r="10"/><path d="M58,92 C61,60 78,46 100,46 C122,46 139,60 142,92 C139,76 124,64 100,64 C76,64 61,76 58,92Z"/></g>
        <circle cx="93" cy="49" r="4" fill="${hi}" opacity=".5"/><circle cx="117" cy="51" r="4" fill="${hi}" opacity=".5"/>`;
      case "mid": return `<path d="M57,100 C55,46 76,32 100,32 C124,32 145,46 143,100 C143,78 139,62 127,55 C116,49 105,52 100,60 C95,52 84,49 73,55 C61,62 57,78 57,100Z" fill="${color}"/>
        <path d="M89,40 C84,46 80,52 78,58 M111,40 C116,46 120,52 122,58" stroke="${hi}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`;
      case "pomp": return `<path d="M58,90 C58,58 64,32 92,26 C120,20 146,38 143,90 C141,62 129,48 109,46 C91,44 74,50 66,64 C60,74 59,82 58,90Z" fill="${color}"/>
        <path d="M72,46 C82,36 96,32 110,34" stroke="${hi}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>`;
      case "buzz": default: return `<path d="M59,88 C59,50 79,38 100,38 C121,38 141,50 141,88 C137,66 121,57 100,57 C79,57 63,66 59,88Z" fill="${color}" opacity=".92"/>`;
    }
  }
  function eyesSVG(kind, shape) {
    const iris = "#1c1410";
    const lid = "#2a1d14";
    // shape 0=기본, 1=날카로운 눈매(가늘고 치켜올라감), 2=순한 눈매(둥글고 처짐)
    const openEye = (cx) => {
      if (shape === 1) return `<path d="M${cx - 10},102 Q${cx},97.5 ${cx + 10},99 Q${cx + 8},104.5 ${cx - 1},104.5 Q${cx - 8},104.5 ${cx - 10},102Z" fill="#fff"/>
      <circle cx="${cx + 1.5}" cy="101.5" r="3.4" fill="${iris}"/><circle cx="${cx + 2.8}" cy="100.2" r="1.2" fill="#fff"/>
      <path d="M${cx - 11},101.5 Q${cx},95.5 ${cx + 11},97.5" stroke="${lid}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M${cx + 9},97.8 L${cx + 12.5},95.6" stroke="${lid}" stroke-width="2.6" stroke-linecap="round"/>`;
      if (shape === 2) return `<path d="M${cx - 8.5},100 Q${cx},94.5 ${cx + 8.5},100.5 Q${cx + 7.5},108 ${cx - 1},108 Q${cx - 8},107 ${cx - 8.5},100Z" fill="#fff"/>
      <circle cx="${cx}" cy="102.5" r="4.4" fill="${iris}"/><circle cx="${cx + 1.7}" cy="100.6" r="1.6" fill="#fff"/>
      <path d="M${cx - 9.5},99 Q${cx},93.5 ${cx + 9.5},100.5" stroke="${lid}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      return `<path d="M${cx - 9},101 Q${cx},95 ${cx + 9},100 Q${cx + 8},106 ${cx - 1},106 Q${cx - 8},106 ${cx - 9},101Z" fill="#fff"/>
      <circle cx="${cx + 1}" cy="101.5" r="4" fill="${iris}"/><circle cx="${cx + 2.6}" cy="99.8" r="1.4" fill="#fff"/>
      <path d="M${cx - 10},100 Q${cx},93.5 ${cx + 10},99" stroke="${lid}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    };
    const smileEye = (cx) => shape === 1
      ? `<path d="M${cx - 9},103 Q${cx},96.5 ${cx + 10},101.5" stroke="${lid}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
      : `<path d="M${cx - 9},104 Q${cx},96 ${cx + 9},104" stroke="${lid}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    const winkEye = (cx) => `<path d="M${cx - 9},102 Q${cx},106.5 ${cx + 9},102" stroke="${lid}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    if (kind === "smile") return `<g class="cv-eyes">${smileEye(81)}${smileEye(119)}</g>`;
    if (kind === "wink") return `<g class="cv-eyes">${openEye(81)}${winkEye(119)}</g>`;
    return `<g class="cv-eyes">${openEye(81)}${openEye(119)}</g>`;
  }
  function browsSVG(color, style) {
    const c = shade(color, 1.15);
    // 0=각진(기본) 1=아치형 2=일자 두꺼움 3=완만한 사선
    switch (style) {
      case 1: return `<g class="cv-brows" stroke="${c}" stroke-width="4.6" fill="none" stroke-linecap="round">
        <path d="M68,92 Q80,84.5 93,89"/><path d="M132,92 Q120,84.5 107,89"/></g>`;
      case 2: return `<g class="cv-brows" fill="${c}">
        <rect x="66" y="86.5" width="28" height="5.6" rx="2.8"/><rect x="106" y="86.5" width="28" height="5.6" rx="2.8"/></g>`;
      case 3: return `<g class="cv-brows" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M69,93.5 L92,88"/><path d="M131,93.5 L108,88"/></g>`;
      default: return `<g class="cv-brows" fill="${c}">
        <path d="M67,91 L93,86 L94,90.5 L68,95.5Z"/>
        <path d="M133,91 L107,86 L106,90.5 L132,95.5Z"/></g>`;
    }
  }
  function mouthSVG(kind) {
    const lip = "#6e2c37";
    if (kind === "grin") return `<path d="M85,126 Q100,140 115,126 Q100,132 85,126Z" fill="#5e1f2c"/><path d="M88.5,127.5 Q100,133 111.5,127.5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    if (kind === "smirk") return `<path d="M88,130 Q103,136 115,127" stroke="${lip}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M113,127 L117,124" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
    if (kind === "soft") return `<path d="M91,129 Q100,134 109,129" stroke="${lip}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    return `<path d="M87,128 Q100,136 113,128" stroke="${lip}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  }
  /* 턱선 3종 + 나이 표현 */
  const HEADS = [
    // 0: 계란형 (기본)
    "M58,98 C58,56 76,42 100,42 C124,42 142,56 142,98 C142,124 133,142 118,149 C112,152.5 106,154 100,154 C94,154 88,152.5 82,149 C67,142 58,124 58,98Z",
    // 1: 각진 사각턱 (남성적)
    "M58,96 C58,54 76,40 100,40 C124,40 142,54 142,96 C142,120 139,138 126,148 C118,153.5 108,155.5 100,155.5 C92,155.5 82,153.5 74,148 C61,138 58,120 58,96Z",
    // 2: 갸름한 V라인
    "M60,96 C60,54 78,42 100,42 C122,42 140,54 140,96 C140,124 129,145 113,152 C107,154.8 103,155.5 100,155.5 C97,155.5 93,154.8 87,152 C71,145 60,124 60,96Z",
  ];
  function ageLinesSVG(age, skin) {
    const c = shade(skin, 0.66);
    let out = "";
    if (age >= 36) out += `<path d="M87,116 Q84,125 88,132 M113,116 Q116,125 112,132" stroke="${c}" stroke-width="2.3" fill="none" stroke-linecap="round" opacity=".5"/>`;
    if (age >= 44) out += `<path d="M72,104.5 Q75,107.5 78,105 M128,104.5 Q125,107.5 122,105" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".45"/>
      <path d="M84,72 Q100,68 116,72" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".35"/>`;
    return out;
  }

  /* ── 몸 (넓은 어깨 · 두꺼운 목 · 가슴 라인) ── */
  function outfitSVG(style, c1, c2, skin, skinD) {
    const muscle = shade(skin, 0.78);
    // 상반신 실루엣 (어깨 x10~190)
    const base = (color) => `<path d="M8,272 C16,208 52,178 100,178 C148,178 184,208 192,272Z" fill="${color}"/>`;
    // 승모근 음영 (목 아래 은은하게)
    const traps = `<path d="M70,186 C80,178 90,175 100,175 C110,175 120,178 130,186" stroke="${skinD}" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>`;
    // 쇄골 + 가슴 라인 (피부 노출 스타일용)
    const chest = `<path d="M78,190 Q90,197 100,194 M122,190 Q110,197 100,194" stroke="${muscle}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8"/>
      <path d="M98,206 C86,210 76,220 72,232 M102,206 C114,210 124,220 128,232" stroke="${muscle}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M100,204 L100,240" stroke="${muscle}" stroke-width="2.2" opacity=".5"/>`;
    // 삼각근 (민소매용)
    const delts = `<path d="M20,244 C22,218 36,198 56,190 M180,244 C178,218 164,198 144,190" stroke="${muscle}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>`;
    switch (style) {
      case "tank": return `${base(skin)}${traps}${chest}${delts}
        <path d="M58,272 C60,222 70,200 84,192 C94,204 106,204 116,192 C130,200 140,222 142,272Z" fill="${c1}"/>
        <path d="M84,192 C94,204 106,204 116,192" stroke="${shade(c1, 0.7)}" stroke-width="2.5" fill="none"/>
        <path d="M78,224 C88,232 112,232 122,224" stroke="${shade(c1, 0.72)}" stroke-width="2.2" fill="none" opacity=".6"/>`;
      case "shirt": return `${base(c1)}<path d="M100,194 L82,180 L72,194 L92,208Z M100,194 L118,180 L128,194 L108,208Z" fill="${shade(c1, 1.15)}"/>
        <path d="M100,206 L100,272" stroke="${shade(c1, 0.75)}" stroke-width="2.5"/><circle cx="100" cy="224" r="2.3" fill="${shade(c1, 0.6)}"/><circle cx="100" cy="246" r="2.3" fill="${shade(c1, 0.6)}"/>
        <path d="M100,194 L94,204 L100,214 L106,204Z" fill="${skin}" opacity=".9"/>
        <path d="M36,240 C44,214 58,196 78,188 M164,240 C156,214 142,196 122,188" stroke="${shade(c1, 0.72)}" stroke-width="2.4" fill="none" opacity=".8"/>`;
      case "apron": return `${base(c1)}
        <path d="M82,182 C90,196 110,196 118,182 C113,192 108,196 100,196 C92,196 87,192 82,182Z" fill="${shade(c1, 0.72)}"/>
        <path d="M64,272 L68,210 Q100,198 132,210 L136,272Z" fill="${c2}"/>
        <path d="M68,210 Q100,198 132,210" stroke="${shade(c2, 1.7)}" stroke-width="3" fill="none"/>
        <path d="M76,236 L124,236" stroke="${shade(c2, 1.6)}" stroke-width="2.5" opacity=".6"/>
        <path d="M36,240 C44,214 58,196 78,188 M164,240 C156,214 142,196 122,188" stroke="${shade(c1, 0.72)}" stroke-width="2.4" fill="none" opacity=".8"/>`;
      case "chef": return `${base(c1)}<path d="M100,196 L100,272" stroke="#cbd5e1" stroke-width="2.5"/>
        <circle cx="86" cy="218" r="2.5" fill="#cbd5e1"/><circle cx="86" cy="238" r="2.5" fill="#cbd5e1"/><circle cx="114" cy="218" r="2.5" fill="#cbd5e1"/><circle cx="114" cy="238" r="2.5" fill="#cbd5e1"/>
        <path d="M82,184 L100,198 L118,184" stroke="#cbd5e1" stroke-width="3" fill="none"/>
        <path d="M34,242 C42,214 58,196 80,188 M166,242 C158,214 142,196 120,188" stroke="#cbd5e1" stroke-width="2.4" fill="none" opacity=".7"/>`;
      case "vest": return `${base("#f8fafc")}<path d="M34,272 C42,218 60,196 80,190 L96,272Z" fill="${c1}"/><path d="M166,272 C158,218 140,196 120,190 L104,272Z" fill="${c1}"/>
        <path d="M100,198 L88,186 L80,194 M100,198 L112,186 L120,194" stroke="#94a3b8" stroke-width="2.5" fill="none"/>
        <path d="M96,214 L100,208 L104,214 L100,248Z" fill="#16161c"/>
        <path d="M84,214 Q92,222 96,232 M116,214 Q108,222 104,232" stroke="#cbd5e1" stroke-width="2" fill="none" opacity=".8"/>`;
      case "scrub": return `${base(c1)}<path d="M100,192 L84,180 L76,196 L96,208Z M100,192 L116,180 L124,196 L104,208Z" fill="${shade(c1, 0.8)}"/>
        <rect x="60" y="226" width="24" height="17" rx="3" fill="${shade(c1, 0.8)}"/><path d="M66,234.5 h12 M72,228.5 v12" stroke="#fff" stroke-width="2.4"/>
        <path d="M36,242 C44,214 58,196 78,188 M164,242 C156,214 142,196 122,188" stroke="${shade(c1, 0.72)}" stroke-width="2.4" fill="none" opacity=".8"/>`;
      case "fire": return `${base(c1)}<path d="M66,192 L76,272 L60,272 C58,242 60,212 66,192Z" fill="#f59e0b"/><path d="M134,192 L124,272 L140,272 C142,242 140,212 134,192Z" fill="#f59e0b"/>
        <path d="M66,216 L134,216 M66,240 L134,240" stroke="#fbbf24" stroke-width="4.5" opacity=".9"/>
        <path d="M100,196 L100,272" stroke="${shade(c1, 0.7)}" stroke-width="2"/>
        <path d="M82,182 Q100,192 118,182" stroke="${shade(c1, 1.6)}" stroke-width="3" fill="none"/>`;
      case "pilot": return `${base(c1)}<path d="M100,194 L82,182 L74,194 L92,208Z M100,194 L118,182 L126,194 L108,208Z" fill="${shade(c1, 1.9)}"/>
        <path d="M52,222 L74,222 M52,231 L74,231" stroke="#fbbf24" stroke-width="3.4"/><path d="M126,222 L148,222 M126,231 L148,231" stroke="#fbbf24" stroke-width="3.4"/>
        <path d="M100,208 L100,272" stroke="${shade(c1, 2.3)}" stroke-width="2"/>
        <path d="M84,214 L92,222 M116,214 L108,222" stroke="${shade(c1, 2)}" stroke-width="2" opacity=".8"/>`;
      case "stage": return `${base(c1)}<path d="M100,196 L84,182 L76,198 L94,210Z M100,196 L116,182 L124,198 L106,210Z" fill="#27272a"/>
        <path d="M100,196 L92,208 L100,222 L108,208Z" fill="${skin}" opacity=".95"/>
        <path d="M74,216 L90,232 M112,228 L128,212 M82,250 L96,262" stroke="#e879f9" stroke-width="2.6" opacity=".9"/>
        <circle cx="120" cy="244" r="2.8" fill="#fbbf24"/><circle cx="68" cy="230" r="2.3" fill="#38bdf8"/><circle cx="134" cy="224" r="2.1" fill="#f472b6"/>`;
      case "ballet": return `${base(c1)}
        <path d="M84,180 C92,192 108,192 116,180 C112,190 106,194 100,194 C94,194 88,190 84,180Z" fill="#26262b"/>
        <path d="M80,216 Q100,226 120,216 M76,240 Q100,250 124,240" stroke="#4a4a52" stroke-width="2.2" fill="none" opacity=".9"/>
        <path d="M36,240 C44,212 58,194 78,186 M164,240 C156,212 142,194 122,186" stroke="#4a4a52" stroke-width="2.4" fill="none" opacity=".9"/>
        <path d="M100,194 L100,270" stroke="#3a3a40" stroke-width="2" opacity=".7"/>`;
      case "suit": return `${base(c1)}<path d="M100,232 L80,186 L64,200 L92,244Z M100,232 L120,186 L136,200 L108,244Z" fill="${shade(c1, 0.7)}"/>
        <path d="M100,230 L84,188 L100,196 L116,188Z" fill="#f1f5f9"/>
        <path d="M95,208 L100,200 L105,208 L100,252Z" fill="${c2}"/>
        <path d="M80,186 L64,200 M120,186 L136,200" stroke="${shade(c1, 1.5)}" stroke-width="2" opacity=".7"/>`;
      case "hoodie": return `${base(c1)}<path d="M70,196 C78,182 122,182 130,196 C124,186 110,182 100,182 C90,182 76,186 70,196Z" fill="${shade(c1, 0.7)}"/>
        <path d="M60,206 C70,192 84,184 100,184 C116,184 130,192 140,206 L134,214 C124,200 112,194 100,194 C88,194 76,200 66,214Z" fill="${shade(c1, 0.82)}"/>
        <path d="M92,200 L91,226 M108,200 L109,226" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
        <circle cx="91" cy="228" r="2.4" fill="#e2e8f0"/><circle cx="109" cy="228" r="2.4" fill="#e2e8f0"/>
        <path d="M70,248 L130,248 L126,270 L74,270Z" fill="${shade(c1, 0.85)}" opacity=".8"/>`;
      case "gi": return `${base("#f8fafc")}<path d="M100,240 L74,184 L58,202 L94,252Z" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
        <path d="M100,240 L126,184 L142,202 L106,252Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
        <path d="M100,238 L88,190 L100,198 L112,190Z" fill="${skin}" opacity=".95"/>
        <path d="M58,252 L142,252 L142,262 L58,262Z" fill="${c1}"/><path d="M94,252 L88,270 M106,252 L112,270" stroke="${c1}" stroke-width="5"/>`;
      case "swim": { // 수영 선수 — 상반신 + 복근 라인 (스포츠 컨텍스트)
        const abs = `<path d="M100,238 L100,268 M88,246 Q100,251 112,246 M86,260 Q100,265 114,260" stroke="${muscle}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>`;
        return `${base(skin)}${traps}${chest}${delts}${abs}
        <path d="M30,262 Q54,250 74,252 M170,262 Q146,250 126,252" stroke="${shade(c1, 1.1)}" stroke-width="5" fill="none" opacity=".5"/>`;
      }
      case "ssireum": { // 씨름 — 샅바
        const abs = `<path d="M100,236 L100,258 M88,244 Q100,249 112,244" stroke="${muscle}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>`;
        return `${base(skin)}${traps}${chest}${delts}${abs}
        <path d="M46,270 L58,256 Q100,246 142,256 L154,270 L46,270Z" fill="${c1}"/>
        <path d="M58,256 Q100,246 142,256" stroke="${shade(c1, 0.7)}" stroke-width="3" fill="none"/>
        <path d="M134,258 L149,245 L156,253 L142,264Z" fill="${shade(c1, 0.85)}"/>
        <path d="M138,258 L134,262" stroke="${shade(c1, 0.7)}" stroke-width="3" stroke-linecap="round"/>`;
      }
      case "kimono": return `${base(c2)}
        <path d="M100,244 L72,184 L52,206 L92,258Z" fill="${c1}" stroke="${shade(c1, 0.7)}" stroke-width="2"/>
        <path d="M100,244 L128,184 L148,206 L108,258Z" fill="${shade(c1, 0.88)}" stroke="${shade(c1, 0.7)}" stroke-width="2"/>
        <path d="M100,242 L88,192 L100,200 L112,192Z" fill="${skin}" opacity=".95"/>
        <g fill="${shade(c1, 1.5)}" opacity=".7"><circle cx="70" cy="220" r="3"/><circle cx="128" cy="212" r="3"/><circle cx="82" cy="244" r="2.5"/><circle cx="120" cy="240" r="2.5"/></g>
        <path d="M54,258 L146,258 L146,270 L54,270Z" fill="${shade(c2, 0.7)}"/><path d="M92,258 L108,258 L108,270 L92,270Z" fill="${shade(c2, 1.4)}"/>`;
      case "school": return `${base(c1)}
        <path d="M84,178 L84,190 L116,190 L116,178" stroke="${shade(c1, 1.6)}" stroke-width="3" fill="none"/>
        <path d="M100,190 L100,270" stroke="${shade(c1, 1.5)}" stroke-width="2.5"/>
        <circle cx="100" cy="206" r="2.6" fill="#fbbf24"/><circle cx="100" cy="226" r="2.6" fill="#fbbf24"/><circle cx="100" cy="246" r="2.6" fill="#fbbf24"/>
        <path d="M84,190 L92,200 M116,190 L108,200" stroke="${shade(c1, 1.5)}" stroke-width="2" opacity=".8"/>`;
      case "soccer": return `${base(c1)}
        <path d="M100,196 L86,182 L78,192 L94,204Z M100,196 L114,182 L122,192 L106,204Z" fill="#fff"/>
        <path d="M66,196 L72,270 M134,196 L128,270" stroke="${shade(c1, 0.7)}" stroke-width="6" opacity=".8"/>
        <text x="100" y="248" font-size="34" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">10</text>`;
      case "basketball": return `${base(skin)}${traps}${chest}${delts}
        <path d="M58,272 C60,222 70,200 84,192 C94,204 106,204 116,192 C130,200 140,222 142,272Z" fill="${c1}"/>
        <path d="M84,192 C94,204 106,204 116,192" stroke="#fff" stroke-width="3" fill="none"/>
        <path d="M62,240 C64,220 70,204 82,194 M138,240 C136,220 130,204 118,194" stroke="#fff" stroke-width="3" fill="none" opacity=".85"/>
        <text x="100" y="250" font-size="30" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">23</text>`;
      case "badminton": return `${base("#f8fafc")}
        <path d="M100,196 L88,184 L80,194 L94,206Z M100,196 L112,184 L120,194 L106,206Z" fill="${c1}"/>
        <path d="M100,206 L100,236" stroke="#cbd5e1" stroke-width="2.5"/><circle cx="100" cy="214" r="2.2" fill="#cbd5e1"/><circle cx="100" cy="228" r="2.2" fill="#cbd5e1"/>
        <path d="M52,238 L148,254 L148,266 L52,250Z" fill="${c1}" opacity=".9"/>
        <path d="M36,240 C44,214 58,196 78,188 M164,240 C156,214 142,196 122,188" stroke="#cbd5e1" stroke-width="2.4" fill="none" opacity=".8"/>`;
      case "dobok": return `${base("#f8fafc")}
        <path d="M100,232 L80,184 L100,192 L120,184Z" fill="#111"/>
        <path d="M80,184 L60,204 L94,246 L100,232 L106,246 L140,204 L120,184 L100,196Z" fill="#fff" stroke="#cbd5e1" stroke-width="2"/>
        <path d="M100,196 L86,188 M100,196 L114,188" stroke="#111" stroke-width="4"/>
        <path d="M56,254 L144,254 L144,264 L56,264Z" fill="${c1}"/><path d="M94,254 L106,254 L106,270 L94,270Z" fill="${c1}"/>`;
      case "tee": default: return `${base(c1)}<path d="M82,182 C90,196 110,196 118,182 C113,192 108,196 100,196 C92,196 87,192 82,182Z" fill="${shade(c1, 0.72)}"/>
        <path d="M62,232 C66,214 74,200 86,192 M138,232 C134,214 126,200 114,192" stroke="${shade(c1, 0.72)}" stroke-width="2.6" fill="none" opacity=".85"/>
        <path d="M74,246 Q86,254 100,252 M126,246 Q114,254 100,252" stroke="${shade(c1, 0.78)}" stroke-width="2.2" fill="none" opacity=".6"/>`;
    }
  }

  /* ── 배경 모티프 8종 (배경군 다양화) ── */
  function bgSVG(kind) {
    switch (kind) {
      case "waves": return `<g stroke="#fff" stroke-width="2.5" fill="none" opacity=".22"><path d="M-10,70 Q20,58 50,70 T110,70 T170,70 T230,70"/><path d="M-10,100 Q20,88 50,100 T110,100 T170,100 T230,100"/><path d="M-10,130 Q20,118 50,130 T110,130 T170,130 T230,130"/></g>`;
      case "city": return `<g fill="#000" opacity=".2"><rect x="6" y="96" width="18" height="90"/><rect x="28" y="72" width="22" height="120"/><rect x="54" y="110" width="14" height="80"/><rect x="134" y="86" width="20" height="100"/><rect x="158" y="60" width="24" height="130"/><rect x="186" y="104" width="12" height="86"/></g><g fill="#fde68a" opacity=".55"><rect x="33" y="82" width="4" height="4"/><rect x="41" y="94" width="4" height="4"/><rect x="163" y="72" width="4" height="4"/><rect x="171" y="88" width="4" height="4"/><rect x="163" y="104" width="4" height="4"/></g>`;
      case "peaks": return `<g fill="#000" opacity=".18"><path d="M-10,190 L40,90 L70,150 L100,80 L140,190Z"/><path d="M90,190 L150,100 L210,190Z"/></g><g fill="#fff" opacity=".5"><path d="M40,90 L48,106 L32,106Z"/><path d="M100,80 L108,98 L92,98Z"/></g>`;
      case "bokeh": return `<g fill="#fff"><circle cx="30" cy="60" r="12" opacity=".12"/><circle cx="168" cy="44" r="16" opacity=".1"/><circle cx="180" cy="130" r="9" opacity=".14"/><circle cx="22" cy="150" r="7" opacity=".16"/><circle cx="150" cy="200" r="13" opacity=".08"/><circle cx="52" cy="30" r="6" opacity=".2"/></g>`;
      case "notes": return `<g fill="#fff" opacity=".3" font-size="20" font-family="serif"><text x="24" y="66">♪</text><text x="160" y="50">♫</text><text x="176" y="140">♪</text><text x="16" y="160">♬</text></g>`;
      case "rays": return `<g stroke="#fff" opacity=".14" stroke-width="10"><path d="M100,-20 L30,300"/><path d="M100,-20 L100,300"/><path d="M100,-20 L170,300"/></g>`;
      case "petals": return `<g fill="#ffd7e6" opacity=".55"><ellipse cx="30" cy="52" rx="5" ry="3" transform="rotate(30 30 52)"/><ellipse cx="166" cy="38" rx="5" ry="3" transform="rotate(-20 166 38)"/><ellipse cx="180" cy="120" rx="4.5" ry="2.8" transform="rotate(45 180 120)"/><ellipse cx="20" cy="140" rx="4.5" ry="2.8" transform="rotate(-40 20 140)"/><ellipse cx="148" cy="196" rx="5" ry="3" transform="rotate(15 148 196)"/></g>`;
      case "stars": default: return `<g fill="#fff" opacity=".7"><circle cx="26" cy="50" r="2"/><circle cx="174" cy="80" r="1.6"/><circle cx="160" cy="32" r="2.2"/><circle cx="36" cy="148" r="1.5"/></g>`;
    }
  }
  function accSVG(acc) {
    switch (acc) {
      case "earring": return `<circle cx="55" cy="114" r="3" fill="#fbbf24"/><circle cx="55" cy="119.5" r="1.8" fill="#fde68a"/>`;
      case "glasses": return `<g stroke="#1f2430" stroke-width="3" fill="rgba(255,255,255,.07)"><rect x="65" y="92" width="29" height="21" rx="8"/><rect x="106" y="92" width="29" height="21" rx="8"/><path d="M94,101 L106,101" fill="none"/></g>`;
      case "headphones": return `<path d="M53,90 C53,50 147,50 147,90" stroke="#111827" stroke-width="7" fill="none"/><rect x="45" y="86" width="14" height="27" rx="7" fill="#0ea5e9"/><rect x="141" y="86" width="14" height="27" rx="7" fill="#0ea5e9"/>`;
      case "flower": return `<g transform="translate(135,62)"><circle r="5" fill="#fbbf24"/><g fill="#f472b6"><circle cx="0" cy="-8" r="4.6"/><circle cx="7.6" cy="-2.4" r="4.6"/><circle cx="4.7" cy="6.5" r="4.6"/><circle cx="-4.7" cy="6.5" r="4.6"/><circle cx="-7.6" cy="-2.4" r="4.6"/></g></g>`;
      case "choker": return `<path d="M85,164 Q100,171 115,164" stroke="#111" stroke-width="5.5" fill="none"/><circle cx="100" cy="169" r="2.6" fill="#e4e4e7"/>`;
      case "goggles": return `<path d="M56,70 C70,60 130,60 144,70" stroke="#0f172a" stroke-width="5" fill="none"/>
        <rect x="66" y="58" width="28" height="15" rx="7" fill="#22d3ee" opacity=".85" stroke="#0f172a" stroke-width="2.5"/>
        <rect x="106" y="58" width="28" height="15" rx="7" fill="#22d3ee" opacity=".85" stroke="#0f172a" stroke-width="2.5"/>
        <path d="M94,65 L106,65" stroke="#0f172a" stroke-width="3"/>`;
      case "headband": return `<path d="M56,76 C70,64 130,64 144,76 L144,86 C130,74 70,74 56,86Z" fill="#ef4444"/>`;
      default: return "";
    }
  }

  /* 체형 4종 — 상반신 가로 스케일 (몸 체형 다양화) */
  const BUILDS = { slim: 0.88, fit: 1.0, muscular: 1.14, bulky: 1.3 };

  /* 캐릭터 렌더 — art/ 폴더에 일러스트가 있으면 이미지 우선, 없으면 절차적 SVG 폴백
     (일러스트 등록: prism/art/에 <id>.webp|.png 추가 후 `node prism/gen-art-manifest.mjs`) */
  function charSVG(c, opts) {
    const ART = window.PRISM_CARD_ART || {};
    if (ART[c.id]) {
      return `<img class="cv cv-art" src="art/${ART[c.id]}" alt="${c.name} — ${c.job}" loading="lazy" draggable="false">`;
    }
    const skin = SKIN[c.skin], skinD = shade(skin, 0.8);
    const o = opts || {};
    const idSuf = c.id + (o.uid || "");
    const B = BUILDS[c.build] || 1.0;
    return `<svg viewBox="0 0 200 270" xmlns="http://www.w3.org/2000/svg" class="cv ${o.animate ? "cv-anim" : ""}" role="img" aria-label="${c.name} — ${c.job}">
      <defs>
        <radialGradient id="aura-${idSuf}" cx="50%" cy="38%" r="68%">
          <stop offset="0%" stop-color="${c.aura[0]}" stop-opacity=".9"/>
          <stop offset="100%" stop-color="${c.aura[1]}" stop-opacity=".3"/>
        </radialGradient>
        <radialGradient id="halo-${idSuf}" cx="50%" cy="34%" r="42%">
          <stop offset="0%" stop-color="#fff" stop-opacity=".28"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="vig-${idSuf}" x1="0" y1="0" x2="0" y2="1">
          <stop offset=".55" stop-color="#000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity=".38"/>
        </linearGradient>
      </defs>
      <rect width="200" height="270" fill="url(#aura-${idSuf})"/>
      <g class="cv-sparks">${bgSVG(c.bg || "stars")}</g>
      ${c.rarity === "SSR" ? `<path d="M-10,180 C40,150 70,200 120,168 C160,142 190,170 210,150 L210,210 C160,230 120,200 70,224 C40,238 10,222 -10,232Z" fill="${c.aura[0]}" opacity=".22"/>
      <path d="M-10,60 C50,90 90,40 150,66 C175,77 195,60 210,70" stroke="${c.aura[0]}" stroke-width="9" fill="none" opacity=".28" stroke-linecap="round"/>` : ""}
      ${c.rarity === "SSR" ? `<g opacity=".85"><path d="M6,6 L36,6 M6,6 L6,36 M164,6 L194,6 L194,36 M6,234 L6,264 L36,264 M194,234 L194,264 L164,264" stroke="#fbe08a" stroke-width="3.5" fill="none"/>
        <circle cx="100" cy="96" r="88" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5" stroke-dasharray="3 7"/>
        <g class="cv-sparks" fill="#fde68a"><path d="M30,40 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3Z"/><path d="M170,60 l2.4,5.6 5.6,2.4 -5.6,2.4 -2.4,5.6 -2.4,-5.6 -5.6,-2.4 5.6,-2.4Z"/><path d="M162,180 l2,4.8 4.8,2 -4.8,2 -2,4.8 -2,-4.8 -4.8,-2 4.8,-2Z"/></g></g>` : ""}
      ${c.rarity === "SR" ? `<circle cx="100" cy="96" r="86" fill="none" stroke="#e9d5ff" stroke-width="1.4" opacity=".45"/>` : ""}
      <circle cx="100" cy="96" r="82" fill="url(#halo-${idSuf})"/>
      <g class="cv-body">
        <g transform="translate(100,0) scale(${B},1) translate(-100,0)">
          ${outfitSVG(c.outfit[0], c.outfit[1], c.outfit[2] || c.outfit[1], skin, skinD)}
          ${(c.build === "muscular" || c.build === "bulky") && ["tank", "swim", "ssireum", "basketball"].includes(c.outfit[0])
            ? `<path d="M84,152 C74,160 62,168 50,176 M116,152 C126,160 138,168 150,176" stroke="${skinD}" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".7"/>` : ""}
          ${c.build === "bulky" && ["tank", "swim", "ssireum", "basketball"].includes(c.outfit[0])
            ? `<path d="M54,248 Q100,262 146,248" stroke="${shade(skin, 0.78)}" stroke-width="2.6" fill="none" opacity=".55"/>` : ""}
          ${c.build === "bulky" && !["tank", "swim", "ssireum", "basketball"].includes(c.outfit[0])
            ? `<path d="M60,214 C56,234 56,252 60,268 M140,214 C144,234 144,252 140,268 M66,240 Q100,250 134,240" stroke="rgba(0,0,0,.20)" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : ""}
          <path d="M84,138 L84,174 C84,188 116,188 116,174 L116,138Z" fill="${skinD}"/>
          <path d="M87,152 Q100,158 113,152" stroke="${shade(skin, 0.68)}" stroke-width="2" fill="none" opacity=".6"/>
        </g>
        <path d="${HEADS[(c.face && c.face.jaw) || 0]}" fill="${skin}"/>
        <path d="M62,90 C62,64 74,50 92,46 C76,54 68,70 66,90 C65,106 68,124 76,136 C66,126 62,110 62,90Z" fill="${shade(skin, 0.88)}" opacity=".55"/>
        <path d="M124,52 C134,60 139,74 139,96 C139,114 134,130 124,140" stroke="#fff" stroke-width="3" fill="none" opacity=".28" stroke-linecap="round"/>
        <path d="M72,126 C78,144 122,144 128,126 C124,142 112,150 100,150 C88,150 76,142 72,126Z" fill="${shade(skin, 0.75)}" opacity=".3"/>
        ${c.stubble === 2 ? `<path d="M70,116 C72,146 128,146 130,116 C130,150 112,156 100,156 C88,156 70,150 70,116Z" fill="${c.hair[1]}" opacity=".92"/>
        <path d="M84,128 Q100,140 116,128 Q100,133 84,128Z" fill="${SKIN[c.skin]}"/>
        <path d="M87,125 Q100,134 113,125" stroke="#5e2530" stroke-width="3.4" fill="none" stroke-linecap="round"/>` : c.stubble ? `<path d="M73,122 C76,144 124,144 127,122 C126,147 111,153 100,153 C89,153 74,147 73,122Z" fill="${c.hair[1]}" opacity=".16"/>` : ""}
        <ellipse cx="56.5" cy="104" rx="7" ry="10.5" fill="${skin}"/><ellipse cx="143.5" cy="104" rx="7" ry="10.5" fill="${skin}"/>
        ${hairSVG(c.hair[0], c.hair[1])}
        ${browsSVG(c.hair[1], (c.face && c.face.brow) || 0)}
        ${eyesSVG(c.eye, (c.face && c.face.eyeShape) || 0)}
        ${[`<path d="M99,101 L98.4,113 M96,116 Q100,118.5 104,116" stroke="${shade(skin, 0.72)}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
           `<path d="M99,100 L98,116 M95,119 Q100,122 105,119" stroke="${shade(skin, 0.72)}" stroke-width="2.7" fill="none" stroke-linecap="round"/>`,
           `<path d="M99.5,99 L97.8,118 M94,121 Q100,124.5 106,121" stroke="${shade(skin, 0.72)}" stroke-width="3" fill="none" stroke-linecap="round"/>`][(c.face && c.face.nose) || 0]}
        ${ageLinesSVG(c.age || 27, skin)}
        ${c.stubble === 2 ? "" : mouthSVG(c.mouth)}
        ${c.rarity !== "N" && !c.stubble ? `<ellipse cx="73" cy="117" rx="6" ry="3.2" fill="#f87171" opacity=".16"/><ellipse cx="127" cy="117" rx="6" ry="3.2" fill="#f87171" opacity=".16"/>` : ""}
        ${accSVG(c.acc)}
      </g>
      <rect width="200" height="270" fill="url(#vig-${idSuf})"/>
      <g class="cv-shine"><rect x="-70" y="0" width="46" height="270" fill="#fff" opacity=".14" transform="skewX(-18)"/></g>
    </svg>`;
  }

  /* ══ 확장 로스터 생성 (c17~c128 · 총 128장) ══
     직업군·나이군·배경군·외형을 결정적으로 조합 — 빌드마다 동일한 카드 도감 */
  const NAMES = ["준서","민재","지호","태윤","서진","도현","건우","현서","지완","태민","유찬","승우","민혁","정우","시온","하진","예준","주원","지안","선우","은찬","강민","태양","다온","라온","시원","무영","찬영","세준","우진","한결","온유","강현","해성","도영","이안","서준","하율","지율","연우","시현","준영","태호","동하","루안","현빈","승현","지훈","민규","성진","윤재","경수","형준","재윤","호진","범준","석현","진우","규현","상윤","태검","백호","천둥","마루","바다","산들","노을","가온","새벽","여름","겨울","우람","힘찬","슬기","보검","한울","누리","아라","도담","벼리","믿음","기람","솔찬","윤슬비","담율","현담","무결","서강","한별","은결","도하","류진","백현","시우진","강토르","제이","카이","레오","노아","단우","률아","혁준","검호","웅재","산하","도원","해린","무현","강율","호수","별하","찬율","결하","훈서","랑도"];
  const JOBS = [
    ["경호원", "suit", "#1e293b", "#334155", 1], ["변호사", "suit", "#0f172a", "#7c3aed", 0], ["회계사", "suit", "#1e293b", "#0ea5e9", 0], ["아나운서", "suit", "#312e81", "#f43f5e", 0],
    ["웹툰 작가", "hoodie", "#4338ca", "", 0], ["게임 개발자", "hoodie", "#0f766e", "", 0], ["프로게이머", "hoodie", "#b91c1c", "", 0], ["스트리머", "hoodie", "#7c3aed", "", 0], ["힙합 프로듀서", "hoodie", "#111827", "", 1],
    ["태권도 사범", "dobok", "#111", "", 0], ["태권도 국가대표", "dobok", "#dc2626", "", 0], ["유도 선수", "gi", "#1d4ed8", "", 1], ["검도 사범", "gi", "#312e81", "", 1], ["주짓수 코치", "gi", "#7c3aed", "", 1], ["합기도 사범", "gi", "#0f766e", "", 0],
    ["수영 선수", "swim", "#0ea5e9", "", 0, "goggles"], ["다이빙 선수", "swim", "#2563eb", "", 0, "goggles"], ["철인3종 선수", "swim", "#0f766e", "", 1, "goggles"],
    ["씨름 선수", "ssireum", "#dc2626", "", 1], ["씨름 천하장사", "ssireum", "#2563eb", "", 1],
    ["료칸 지배인", "kimono", "#3f6212", "#292524", 0], ["유카타 찻집 주인", "kimono", "#7c2d12", "#1c1917", 0], ["온천 마을 안내인", "kimono", "#1e3a8a", "#0f172a", 0],
    ["체대생", "school", "#111827", "", 0], ["미대생", "school", "#1e3a8a", "", 0], ["공대생", "school", "#0f172a", "", 0], ["음대생", "school", "#312e81", "", 0],
    ["축구 선수", "soccer", "#dc2626", "", 0], ["풋살 코치", "soccer", "#1d4ed8", "", 0], ["골키퍼", "soccer", "#16a34a", "", 0],
    ["농구 선수", "basketball", "#f97316", "", 0], ["스트릿볼러", "basketball", "#111827", "", 0, "headband"],
    ["배드민턴 선수", "badminton", "#16a34a", "", 0], ["탁구 선수", "badminton", "#dc2626", "", 0], ["테니스 코치", "badminton", "#1d4ed8", "", 0, "headband"],
    ["응급구조사", "scrub", "#ef4444", "", 0], ["물리치료사", "scrub", "#0ea5e9", "", 0], ["한의사", "scrub", "#14b8a6", "", 0], ["치과의사", "scrub", "#38bdf8", "", 0], ["간호사", "scrub", "#22c55e", "", 0], ["약사", "scrub", "#f8fafc", "", 0],
    ["헬스 트레이너", "tank", "#f43f5e", "", 1], ["크로스핏 코치", "tank", "#f97316", "", 1], ["클라이밍 강사", "tank", "#84cc16", "", 0], ["럭비 선수", "tank", "#166534", "", 1], ["배구 선수", "tank", "#2563eb", "", 0], ["서퍼", "tank", "#06b6d4", "", 0], ["인명구조원", "tank", "#ef4444", "", 0], ["복싱 코치", "tank", "#dc2626", "", 1],
    ["파티시에", "chef", "#fdf2f8", "", 0], ["스시 셰프", "chef", "#f8fafc", "", 1], ["브런치 셰프", "chef", "#fffbeb", "", 0], ["정육 장인", "apron", "#7f1d1d", "#27272a", 1], ["도예가", "apron", "#78716c", "#292524", 0], ["플랜트 집사", "apron", "#166534", "#14532d", 0], ["조향사", "apron", "#6d28d9", "#1e1b4b", 0], ["수제맥주 브루어", "apron", "#b45309", "#292524", 1],
    ["바리스타", "apron", "#57534e", "#1c1917", 0], ["소믈리에", "vest", "#450a0a", "", 0], ["재즈 피아니스트", "vest", "#1e1b4b", "", 0], ["마술사", "vest", "#111827", "", 0], ["호텔리어", "vest", "#0f172a", "", 0],
    ["소방관", "fire", "#374151", "", 1], ["산악구조대", "fire", "#3f6212", "", 1], ["해양경찰", "pilot", "#0c4a6e", "", 0], ["항해사", "pilot", "#082f49", "", 1], ["승무원", "pilot", "#1e1b4b", "", 0], ["기관사", "pilot", "#27272a", "", 0], ["드론 조종사", "pilot", "#134e4a", "", 0],
    ["국악인", "gi", "#7f1d1d", "", 0], ["발레 강사", "ballet", "#18181b", "", 0], ["현대무용수", "ballet", "#27272a", "", 0], ["배우", "stage", "#0b0b14", "", 0], ["뮤지컬 배우", "stage", "#1e1b4b", "", 0], ["인디 보컬", "stage", "#171717", "", 0],
    ["건축가", "shirt", "#334155", "", 0], ["큐레이터", "shirt", "#7c3aed", "", 0], ["사서", "shirt", "#0f766e", "", 0], ["통역사", "shirt", "#1d4ed8", "", 0], ["천문학자", "shirt", "#312e81", "", 0], ["교사", "shirt", "#0369a1", "", 0], ["플로리스트", "shirt", "#db2777", "", 0], ["여행 가이드", "tee", "#f59e0b", "", 0], ["사진작가", "tee", "#374151", "", 1], ["반려견 훈련사", "tee", "#65a30d", "", 0], ["목수", "tee", "#92400e", "", 1], ["자동차 정비사", "tee", "#1f2937", "", 1],
  ];
  const LINES = [
    "오늘 하루, 마지막 메시지는 당신이면 좋겠어요.", "운명은 안 믿는데, 당신 프로필은 두 번 봤어요.", "제 취미요? 방금 당신 생각하는 걸로 바뀌었어요.",
    "우리 동네에 이런 사람이 있었다니.", "커피는 제가 살게요. 이야기는 당신이 들려줘요.", "당신 웃음소리, 벌써 궁금해지는데요.",
    "주말 계획 비워둘게요. 채워줄래요?", "첫인상보다 두 번째가 더 좋은 사람이 될게요.", "지금 이 순간도 연습이 아니라 진심이에요.",
    "밤하늘보다 당신 얘기가 더 길었으면.", "천천히 와요. 여기서 기다릴게요.", "당신의 하루 끝, 제가 맡아도 될까요?",
    "좋아하는 노래 알려줘요. 플레이리스트에 넣게.", "비 오는 날엔 제가 우산이 될게요.", "당신이라면, 월요일도 나쁘지 않아요.",
    "한 판 승부? 지는 쪽이 저녁 사기.", "근육은 거들 뿐, 마음이 진짜예요.", "제 스케줄에 당신 자리 하나 비워뒀어요.",
    "오늘 운세: 당신을 만나면 대길.", "어색한 침묵도 당신과라면 편할 것 같아요.", "메뉴 고민은 그만, 저랑 다 먹으러 가요.",
    "당신의 최애 공간, 저도 데려가줘요.", "손은 따뜻한 편이에요. 확인해볼래요?", "오래 볼 사람이니까, 천천히 알아가요.",
    "제일 잘하는 요리로 초대할게요.", "산책 코스 추천해줘요. 같이 걷게.", "당신 앞에선 계산 없이 웃게 되네요.",
    "다음 휴가지, 같이 정할래요?", "고민 많은 밤엔 제가 전화할게요.", "시작은 가볍게, 마음은 깊게.",
    "오늘의 나를 만든 건 8할이 설렘이에요.", "당신을 만나러 가는 길이 제일 짧았으면.",
  ];
  const HAIR_STYLES = ["crop", "undercut", "curly", "mid", "pomp", "buzz"];
  const HAIR_COLORS = ["#1f1f28", "#17120e", "#3d2b1f", "#4a3527", "#5b3a24", "#26201c", "#0e2a3a", "#241a12", "#3b3b45", "#5c4033"];
  const BGS = ["stars", "waves", "city", "peaks", "bokeh", "notes", "rays", "petals"];
  const AURAS = {
    N: [["#64748b", "#334155"], ["#78716c", "#44403c"], ["#3b82f6", "#1e3a8a"], ["#10b981", "#065f46"], ["#f59e0b", "#92400e"], ["#8b5cf6", "#4c1d95"]],
    R: [["#38bdf8", "#1d4ed8"], ["#2dd4bf", "#0f766e"], ["#f472b6", "#be185d"], ["#a78bfa", "#6d28d9"], ["#fb923c", "#c2410c"]],
    SR: [["#c084fc", "#7c3aed"], ["#f97316", "#dc2626"], ["#22d3ee", "#4f46e5"], ["#f43f5e", "#7e22ce"]],
    SSR: [["#fbbf24", "#f472b6"], ["#e879f9", "#8b5cf6"], ["#f5f5f5", "#71717a"], ["#34d399", "#38bdf8"]],
  };
  const EYES = ["open", "smile", "wink"], MOUTHS = ["smile", "grin", "smirk", "soft"], ACCS = ["none", "none", "earring", "none", "glasses", "none", "earring", "none"];
  // 등급 분포: 기존 16장(N6/R5/SR3/SSR2) + 생성 112장 = N56/R36/SR24/SSR12
  const GEN_RARITY = [].concat(Array(50).fill("N"), Array(31).fill("R"), Array(21).fill("SR"), Array(10).fill("SSR"));
  // 직업 순서 결정적 셔플 (모든 직업이 고르게 등장하도록 — 곱셈 계수와 배열 길이의 공약수 문제 회피)
  const JOB_ORDER = JOBS.map((_, k) => k).sort((a, b) => ((a * 137 + 71) % 997) - ((b * 137 + 71) % 997));
  for (let i = 0; i < 112; i++) {
    const rarity = GEN_RARITY[(i * 53) % 112]; // 결정적 셔플
    const job = JOBS[JOB_ORDER[i % JOBS.length]];
    const auras = AURAS[rarity];
    const NO_ACC = ["gi", "dobok", "fire", "ssireum", "kimono", "swim"];
    // 체형: 직업 특성 우선, 나머지는 분포 (슬림 20% / 탄탄 40% / 근육질 25% / 곰 15%)
    const BULKY_JOBS = ["씨름 선수", "씨름 천하장사", "럭비 선수", "정육 장인", "수제맥주 브루어", "목수"];
    const MUSC_OUTFITS = ["tank", "swim", "fire", "basketball", "gi", "dobok"];
    const SLIM_OUTFITS = ["school", "stage", "ballet"];
    const beardy = BULKY_JOBS.includes(job[0]) || ["소방관", "산악구조대", "스시 셰프", "수제맥주 브루어", "정육 장인", "목수", "항해사"].includes(job[0]);
    const build = BULKY_JOBS.includes(job[0]) ? "bulky"
      : MUSC_OUTFITS.includes(job[1]) ? ((i % 3) ? "muscular" : "bulky")
      : SLIM_OUTFITS.includes(job[1]) ? ((i % 3) ? "slim" : "fit")
      : ["slim", "fit", "fit", "fit", "muscular", "fit", "muscular", "slim", "bulky", "fit"][(i * 3) % 10];
    // 파츠별 독립 해시 — 선형 모듈로 상관(i%3 붕괴) 방지
    const H = (n, k) => { let x = ((n + 13) * 2654435761) ^ (k * 40503 + 977); x = ((x >>> 13) ^ x) * 1274126177; return (x >>> 8); };
    const eyeRoll = H(i, 5) % 20; // wink 15% / open 40% / smile 45%
    CHARS.push({
      build,
      face: { jaw: build === "bulky" ? 1 : H(i, 1) % 3, eyeShape: build === "slim" && i % 2 ? 2 : H(i, 2) % 3, brow: H(i, 3) % 4, nose: H(i, 4) % 3 },
      id: "c" + String(i + 17).padStart(3, "0"),
      name: NAMES[i % NAMES.length],
      job: job[0],
      // 나이군: 20~49 · 학생 콘셉트는 20대 초반으로 고정
      age: job[1] === "school" ? 20 + ((i * 11) % 6) : 20 + ((i * 11) % 30),
      rarity,
      skin: (i * 7) % 4,
      hair: [job[1] === "swim" ? "buzz" : HAIR_STYLES[(i * 13) % 6], HAIR_COLORS[(i * 17) % 10]],
      outfit: [job[1], job[2], job[3] || job[2]],
      acc: job[5] || (NO_ACC.includes(job[1]) ? "none" : ACCS[(i * 19) % ACCS.length]),
      eye: eyeRoll < 3 ? "wink" : eyeRoll < 11 ? "open" : "smile",
      mouth: ["smile", "grin", "smirk", "soft"][H(i, 6) % 4],
      stubble: beardy && i % 2 ? 2 : (job[4] || (i % 5 === 0 ? 1 : 0)), // 2 = 풀비어드 (곰상)
      bg: job[1] === "swim" ? "waves" : job[1] === "kimono" ? "petals" : BGS[(i * 37) % 8],
      aura: auras[(i * 41) % auras.length],
      line: LINES[(i * 43) % LINES.length],
    });
  }
  // ── 후처리 1: 완전 동일 외형(쌍둥이) 제거 — 충돌 시 눈썹→코 순서로 섭동
  {
    const sig = (c) => JSON.stringify([c.face, c.eye, c.mouth, c.skin, c.stubble, c.hair]);
    const seen = new Set();
    CHARS.forEach((c) => {
      if (!c.face) return;
      let guard = 0;
      while (seen.has(sig(c)) && guard < 12) {
        c.face.brow = (c.face.brow + 1) % 4;
        if (++guard % 4 === 0) c.face.nose = (c.face.nose + 1) % 3;
        if (guard % 7 === 0) c.face.jaw = (c.face.jaw + 1) % 3;
      }
      seen.add(sig(c));
    });
  }
  // ── 후처리 2: 생성 SSR 나이 분산(20~40대) + 슬림 청년 공급 확보
  {
    const genSSR = CHARS.filter((c) => c.rarity === "SSR" && +c.id.slice(1) >= 17);
    const ages = [23, 26, 29, 32, 35, 38, 41, 44, 47, 49];
    genSSR.forEach((c, k) => {
      if (c.outfit[0] !== "school") c.age = ages[k % ages.length];
      if (k % 3 === 2 && !["ssireum", "fire"].includes(c.outfit[0])) { c.build = "slim"; c.face.eyeShape = 2; c.stubble = 0; }
    });
  }
  // ── 후처리 3: 직업-나이 개연성 (사범·장인·지배인급은 30세 이상)
  CHARS.forEach((c) => {
    if (/사범|장인|지배인|천하장사|대표|오너/.test(c.job) && c.age < 30) c.age = Math.min(49, c.age + 13);
  });

  // 기존 16장 나이·체형 부여
  const BASE_AGES = { c01: 26, c02: 23, c03: 29, c04: 31, c05: 27, c06: 28, c07: 33, c08: 30, c09: 27, c10: 34, c11: 32, c12: 36, c13: 29, c14: 38, c15: 24, c16: 26 };
  const BASE_BUILDS = { c01: "fit", c02: "slim", c03: "slim", c04: "muscular", c05: "fit", c06: "fit", c07: "bulky", c08: "muscular", c09: "fit", c10: "fit", c11: "fit", c12: "bulky", c13: "muscular", c14: "fit", c15: "slim", c16: "slim" };
  const BASE_FACES = { c01: [0,0,1,0], c02: [2,2,3,0], c03: [2,0,1,1], c04: [1,1,0,1], c05: [2,2,1,0], c06: [0,1,3,1], c07: [1,0,2,2], c08: [0,1,0,1], c09: [1,1,2,2], c10: [2,1,3,1], c11: [0,2,1,0], c12: [1,0,2,2], c13: [1,1,0,1], c14: [0,1,3,1], c15: [2,2,1,0], c16: [2,1,3,0] };
  CHARS.forEach((c) => {
    if (BASE_AGES[c.id]) c.age = BASE_AGES[c.id];
    if (BASE_BUILDS[c.id]) c.build = BASE_BUILDS[c.id];
    if (BASE_FACES[c.id]) { const f = BASE_FACES[c.id]; c.face = { jaw: f[0], eyeShape: f[1], brow: f[2], nose: f[3] }; }
  });

  window.PRISM_CARDS = { CHARS, RARITY, charSVG };
})();
