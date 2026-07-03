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
      case "crop": return `<path d="M58,92 C56,52 78,38 100,38 C122,38 144,52 142,92 C140,68 126,56 100,56 C74,56 60,68 58,92Z" fill="${color}"/>
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
      case "buzz": default: return `<path d="M59,84 C59,52 79,40 100,40 C121,40 141,52 141,84 C137,64 121,54 100,54 C79,54 63,64 59,84Z" fill="${color}" opacity=".92"/>`;
    }
  }
  function eyesSVG(kind, browColor) {
    const iris = "#1c1410";
    const lid = "#2a1d14";
    const openEye = (cx) => `<path d="M${cx - 9},101 Q${cx},95 ${cx + 9},100 Q${cx + 8},106 ${cx - 1},106 Q${cx - 8},106 ${cx - 9},101Z" fill="#fff"/>
      <circle cx="${cx + 1}" cy="101.5" r="4" fill="${iris}"/><circle cx="${cx + 2.6}" cy="99.8" r="1.4" fill="#fff"/>
      <path d="M${cx - 10},100 Q${cx},93.5 ${cx + 10},99" stroke="${lid}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    const smileEye = (cx) => `<path d="M${cx - 9},104 Q${cx},96 ${cx + 9},104" stroke="${lid}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    const winkEye = (cx) => `<path d="M${cx - 9},102 Q${cx},106.5 ${cx + 9},102" stroke="${lid}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    if (kind === "smile") return `<g class="cv-eyes">${smileEye(81)}${smileEye(119)}</g>`;
    if (kind === "wink") return `<g class="cv-eyes">${openEye(81)}${winkEye(119)}</g>`;
    return `<g class="cv-eyes">${openEye(81)}${openEye(119)}</g>`;
  }
  function browsSVG(color) {
    const c = shade(color, 1.15);
    return `<g class="cv-brows" fill="${c}">
      <path d="M67,91 L93,86 L94,90.5 L68,95.5Z"/>
      <path d="M133,91 L107,86 L106,90.5 L132,95.5Z"/></g>`;
  }
  function mouthSVG(kind) {
    const lip = "#6e2c37";
    if (kind === "grin") return `<path d="M85,126 Q100,140 115,126 Q100,132 85,126Z" fill="#5e1f2c"/><path d="M88.5,127.5 Q100,133 111.5,127.5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    if (kind === "smirk") return `<path d="M88,130 Q103,136 115,127" stroke="${lip}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M113,127 L117,124" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
    return `<path d="M87,128 Q100,136 113,128" stroke="${lip}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
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
      case "tee": default: return `${base(c1)}<path d="M82,182 C90,196 110,196 118,182 C113,192 108,196 100,196 C92,196 87,192 82,182Z" fill="${shade(c1, 0.72)}"/>
        <path d="M62,232 C66,214 74,200 86,192 M138,232 C134,214 126,200 114,192" stroke="${shade(c1, 0.72)}" stroke-width="2.6" fill="none" opacity=".85"/>
        <path d="M74,246 Q86,254 100,252 M126,246 Q114,254 100,252" stroke="${shade(c1, 0.78)}" stroke-width="2.2" fill="none" opacity=".6"/>`;
    }
  }
  function accSVG(acc) {
    switch (acc) {
      case "earring": return `<circle cx="55" cy="114" r="3" fill="#fbbf24"/><circle cx="55" cy="119.5" r="1.8" fill="#fde68a"/>`;
      case "glasses": return `<g stroke="#1f2430" stroke-width="3" fill="rgba(255,255,255,.07)"><rect x="65" y="92" width="29" height="21" rx="8"/><rect x="106" y="92" width="29" height="21" rx="8"/><path d="M94,101 L106,101" fill="none"/></g>`;
      case "headphones": return `<path d="M53,90 C53,50 147,50 147,90" stroke="#111827" stroke-width="7" fill="none"/><rect x="45" y="86" width="14" height="27" rx="7" fill="#0ea5e9"/><rect x="141" y="86" width="14" height="27" rx="7" fill="#0ea5e9"/>`;
      case "flower": return `<g transform="translate(135,62)"><circle r="5" fill="#fbbf24"/><g fill="#f472b6"><circle cx="0" cy="-8" r="4.6"/><circle cx="7.6" cy="-2.4" r="4.6"/><circle cx="4.7" cy="6.5" r="4.6"/><circle cx="-4.7" cy="6.5" r="4.6"/><circle cx="-7.6" cy="-2.4" r="4.6"/></g></g>`;
      case "choker": return `<path d="M85,164 Q100,171 115,164" stroke="#111" stroke-width="5.5" fill="none"/><circle cx="100" cy="169" r="2.6" fill="#e4e4e7"/>`;
      default: return "";
    }
  }

  /* 캐릭터 SVG — 망가풍 근육질 남성 (애니메이션 클래스는 app.css) */
  function charSVG(c, opts) {
    const skin = SKIN[c.skin], skinD = shade(skin, 0.8);
    const o = opts || {};
    const idSuf = c.id + (o.uid || "");
    return `<svg viewBox="0 0 200 270" xmlns="http://www.w3.org/2000/svg" class="cv ${o.animate ? "cv-anim" : ""}" role="img" aria-label="${c.name} — ${c.job}">
      <defs>
        <radialGradient id="aura-${idSuf}" cx="50%" cy="38%" r="68%">
          <stop offset="0%" stop-color="${c.aura[0]}" stop-opacity=".85"/>
          <stop offset="100%" stop-color="${c.aura[1]}" stop-opacity=".25"/>
        </radialGradient>
      </defs>
      <rect width="200" height="270" fill="url(#aura-${idSuf})"/>
      <g class="cv-sparks" fill="#fff" opacity=".7">
        <circle cx="26" cy="50" r="2"/><circle cx="174" cy="80" r="1.6"/><circle cx="160" cy="32" r="2.2"/><circle cx="36" cy="148" r="1.5"/>
      </g>
      <g class="cv-body">
        ${outfitSVG(c.outfit[0], c.outfit[1], c.outfit[2] || c.outfit[1], skin, skinD)}
        <path d="M84,138 L84,174 C84,188 116,188 116,174 L116,138Z" fill="${skinD}"/>
        <path d="M87,152 Q100,158 113,152" stroke="${shade(skin, 0.68)}" stroke-width="2" fill="none" opacity=".6"/>
        <path d="M58,98 C58,56 76,42 100,42 C124,42 142,56 142,98 C142,124 133,142 118,149 C112,152.5 106,154 100,154 C94,154 88,152.5 82,149 C67,142 58,124 58,98Z" fill="${skin}"/>
        <path d="M72,126 C78,144 122,144 128,126 C124,142 112,150 100,150 C88,150 76,142 72,126Z" fill="${shade(skin, 0.75)}" opacity=".3"/>
        ${c.stubble ? `<path d="M73,122 C76,144 124,144 127,122 C126,147 111,153 100,153 C89,153 74,147 73,122Z" fill="${c.hair[1]}" opacity=".16"/>` : ""}
        <ellipse cx="56.5" cy="104" rx="7" ry="10.5" fill="${skin}"/><ellipse cx="143.5" cy="104" rx="7" ry="10.5" fill="${skin}"/>
        ${hairSVG(c.hair[0], c.hair[1])}
        ${browsSVG(c.hair[1])}
        ${eyesSVG(c.eye, c.hair[1])}
        <path d="M99,100 L98,116 M95,119 Q100,122 105,119" stroke="${shade(skin, 0.72)}" stroke-width="2.7" fill="none" stroke-linecap="round"/>
        ${mouthSVG(c.mouth)}
        ${c.rarity !== "N" && !c.stubble ? `<ellipse cx="73" cy="117" rx="6" ry="3.2" fill="#f87171" opacity=".16"/><ellipse cx="127" cy="117" rx="6" ry="3.2" fill="#f87171" opacity=".16"/>` : ""}
        ${accSVG(c.acc)}
      </g>
      <g class="cv-shine"><rect x="-70" y="0" width="46" height="270" fill="#fff" opacity=".14" transform="skewX(-18)"/></g>
    </svg>`;
  }

  window.PRISM_CARDS = { CHARS, RARITY, charSVG };
})();
