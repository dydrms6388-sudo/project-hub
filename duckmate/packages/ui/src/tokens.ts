/**
 * @duckmate/ui 토큰 (TS 상수) — 출처 docs/agents/10_brand.md §2.2·§2.3·§2.4·§6.2·§7.1
 * CSS 변수(styles.css)가 렌더 기준이고, 이 파일은 canvas·SVG·인라인 스타일·시드 검증처럼
 * JS에서 값이 필요한 곳(아바타, OG, 게이지 색 계산) 전용이다. 값 변경은 10_brand.md 먼저.
 */

// ---------- 2.2 스케일 (HEX) ----------
export const VIOLET = {
  50: "#F4F1FE", 100: "#E9E3FD", 200: "#D4CAFB", 300: "#B5A4F5", 400: "#9078EB",
  500: "#6F52DE", 600: "#5B3BCF", 700: "#4B2FB0", 800: "#3D278C", 900: "#2E1E69", 950: "#1B1140",
} as const;
export const LILAC = {
  50: "#F7F5FB", 100: "#EEEAF6", 200: "#DDD6EC", 300: "#C4B9DC", 400: "#A493C4",
  500: "#8672AB", 600: "#6E5A91", 700: "#594874", 800: "#463A5B", 900: "#352C45", 950: "#1F1A29",
} as const;
export const CORAL = {
  50: "#FFF3F0", 100: "#FFE3DD", 200: "#FFC7BC", 300: "#FFA08F", 400: "#FF7A63",
  500: "#F4573C", 600: "#D9412A", 700: "#B5321F", 800: "#93291C", 900: "#79261D", 950: "#42100A",
} as const;
export const SAND = {
  0: "#FFFFFF", 50: "#FAF8F5", 100: "#F3F0EB", 200: "#E6E1DA", 300: "#D2CCC4", 400: "#A8A19A",
  500: "#7D766F", 600: "#5C5650", 700: "#443F3A", 800: "#2C2925", 900: "#1C1A17", 950: "#121110",
} as const;

/** 기조 컬러 3종 (결정사항 3) */
export const BRAND = {
  primary: VIOLET[600],   // #5B3BCF
  accent: CORAL[500],     // #F4573C
  background: SAND[50],   // #FAF8F5
  /** 코랄 위 텍스트는 흰색이 아니라 neutral-900 (결정사항 4) */
  onAccent: SAND[900],    // #1C1A17
  /** 코랄을 텍스트로 쓸 때 최소 진하기 (accent-700) */
  accentText: CORAL[700], // #B5321F
} as const;

// ---------- 2.3 시맨틱 ----------
export const SEMANTIC = {
  success: { fill: "#177A4C", onFill: "#FFFFFF", text: "#177A4C", soft: "#E6F6EE" },
  warning: { fill: "#F0B33B", onFill: "#1C1A17", text: "#8A5A08", soft: "#FFF4DD" },
  danger: { fill: "#D23B3B", onFill: "#FFFFFF", text: "#B02E2E", soft: "#FDECEC" },
  info: { fill: "#2F6FD6", onFill: "#FFFFFF", text: "#1F4F9E", soft: "#E8F0FD" },
} as const;

// ---------- 2.4 라이트/다크 매핑 (HEX; CSS 변수와 동일 값) ----------
export const THEME = {
  light: {
    background: "#FAF8F5", card: "#FFFFFF", foreground: "#1C1A17", mutedForeground: "#5C5650",
    primary: "#5B3BCF", primaryForeground: "#FFFFFF",
    secondary: "#EEEAF6", secondaryForeground: "#463A5B",
    accent: "#F4573C", accentForeground: "#1C1A17",
    destructive: "#D23B3B", destructiveForeground: "#FFFFFF",
    success: "#177A4C", warning: "#8A5A08", info: "#1F4F9E",
    border: "#E6E1DA", input: "#D2CCC4", ring: "#5B3BCF",
  },
  dark: {
    background: "#15121F", card: "#1E1A2B", foreground: "#F3F0EB", mutedForeground: "#A8A19A",
    primary: "#9F8BF0", primaryForeground: "#1B1140",
    secondary: "#352C45", secondaryForeground: "#DDD6EC",
    accent: "#FF8A73", accentForeground: "#1B1140",
    destructive: "#FF6B6B", destructiveForeground: "#15121F",
    success: "#4DBE86", warning: "#F0B33B", info: "#6EA3F0",
    border: "#2C2536", input: "#3A3247", ring: "#9F8BF0",
  },
} as const;

// ---------- 결정사항 7: radius ----------
export const RADIUS = {
  base: 12,   // --radius 0.75rem
  input: 12,
  button: 12,
  card: 16,
  modal: 20,
  sheet: 20,
  chip: 9999, // 칩·배지만 완전 원형. 버튼은 완전 원형 금지
} as const;

// ---------- §7.1 모션 ----------
export const MOTION = {
  durationFast: 120,   // 마이크로(체크·토글·칩)
  durationBase: 200,   // 기본 진입
  durationExit: 150,   // 퇴장
  durationSheet: 260,  // 시트·모달
  durationFlip: 320,   // 카드 뒤집기
  matchRevealMax: 1200, // 매칭 리빌 총 ≤ 1.2s
  easeEnter: "cubic-bezier(0.2, 0, 0, 1)",
  easeExit: "cubic-bezier(0.4, 0, 1, 1)",
  skeletonLoop: 1200,
} as const;

// ---------- §3.3 타입 스케일 (px) ----------
export const TYPE_SCALE = {
  display: { size: 32, line: 40, weight: 800, tracking: "-0.02em" },
  h1: { size: 26, line: 34, weight: 700, tracking: "-0.015em" },
  h2: { size: 22, line: 30, weight: 700, tracking: "-0.01em" },
  h3: { size: 18, line: 26, weight: 600, tracking: "0" },
  body: { size: 16, line: 24, weight: 400, tracking: "0" },
  bodySm: { size: 14, line: 20, weight: 400, tracking: "0" },
  label: { size: 14, line: 20, weight: 500, tracking: "0" },
  caption: { size: 12, line: 16, weight: 500, tracking: "0.01em" },
  button: { size: 16, line: 24, weight: 600, tracking: "0" },
  buttonSm: { size: 14, line: 20, weight: 600, tracking: "0" },
} as const;

export const FONT_FAMILY =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

/** Phase 1 폰트 로딩(앱 layout <link>): 10_brand §3.2 */
export const PRETENDARD_CDN_HREF =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

// ---------- §6.1 아이콘 규격 ----------
export const ICON = {
  size: 24, stroke: 1.75,
  chipSize: 16, chipStroke: 2,
  emptySize: 48, emptyStroke: 1.25, emptyColor: LILAC[400], // #A493C4
} as const;

// ---------- §6.2 취미 대분류 12 ----------
export type HobbyCategorySlug =
  | "fandom" | "boardgame" | "fitness" | "anime" | "game" | "cafe"
  | "book" | "photo" | "code" | "travel" | "pet" | "music";

export interface HobbyCategory {
  slug: HobbyCategorySlug;
  label: string;
  /** lucide 아이콘 이름(kebab, DB `hobbies.icon` 시드 값과 동일) */
  icon: string;
  /** lucide-react export 이름(PascalCase) */
  iconExport: string;
  emoji: string;
  /** 아바타 색 페어 (bg / fg), 전부 AA 본문 통과 */
  avatarBg: string;
  avatarFg: string;
  /** 초기 8(true) / 더보기(false) */
  initial: boolean;
}

export const HOBBY_CATEGORIES: readonly HobbyCategory[] = [
  { slug: "fandom", label: "공연·페스티벌·아이돌", icon: "mic-vocal", iconExport: "MicVocal", emoji: "🎤", avatarBg: "#E9E3FD", avatarFg: "#4B2FB0", initial: true },
  { slug: "boardgame", label: "보드게임·TRPG", icon: "dices", iconExport: "Dices", emoji: "🎲", avatarBg: "#FFE3DD", avatarFg: "#93291C", initial: true },
  { slug: "fitness", label: "러닝·클라이밍·헬스", icon: "footprints", iconExport: "Footprints", emoji: "🏃", avatarBg: "#E6F6EE", avatarFg: "#146A42", initial: true },
  { slug: "anime", label: "애니·웹툰·서브컬처", icon: "tv", iconExport: "Tv", emoji: "📺", avatarBg: "#DDD6EC", avatarFg: "#463A5B", initial: true },
  { slug: "game", label: "게임(PC·콘솔·모바일)", icon: "gamepad-2", iconExport: "Gamepad2", emoji: "🎮", avatarBg: "#E8F0FD", avatarFg: "#1F4F9E", initial: true },
  { slug: "cafe", label: "카페투어·디저트·베이킹", icon: "coffee", iconExport: "Coffee", emoji: "☕", avatarBg: "#FFF4DD", avatarFg: "#7A4E05", initial: true },
  { slug: "book", label: "독서·북클럽·글쓰기", icon: "book-open", iconExport: "BookOpen", emoji: "📚", avatarBg: "#F3F0EB", avatarFg: "#443F3A", initial: true },
  { slug: "photo", label: "사진·전시·영화", icon: "camera", iconExport: "Camera", emoji: "📷", avatarBg: "#D4CAFB", avatarFg: "#2E1E69", initial: true },
  { slug: "code", label: "코딩·개발", icon: "code", iconExport: "Code", emoji: "💻", avatarBg: "#EEEAF6", avatarFg: "#352C45", initial: false },
  { slug: "travel", label: "여행", icon: "plane", iconExport: "Plane", emoji: "✈️", avatarBg: "#F7F5FB", avatarFg: "#594874", initial: false },
  { slug: "pet", label: "반려동물", icon: "paw-print", iconExport: "PawPrint", emoji: "🐾", avatarBg: "#FFF3F0", avatarFg: "#B5321F", initial: false },
  { slug: "music", label: "음악·악기·플레이리스트", icon: "music", iconExport: "Music", emoji: "🎵", avatarBg: "#F4F1FE", avatarFg: "#5B3BCF", initial: false },
] as const;

export const HOBBY_BY_SLUG: Readonly<Record<HobbyCategorySlug, HobbyCategory>> = Object.fromEntries(
  HOBBY_CATEGORIES.map((c) => [c.slug, c]),
) as Record<HobbyCategorySlug, HobbyCategory>;

export function isHobbyCategorySlug(v: string): v is HobbyCategorySlug {
  return v in HOBBY_BY_SLUG;
}

// ---------- 몰입도 1~5 라벨 (10_brand §4.5 #8) ----------
export type Intensity = 1 | 2 | 3 | 4 | 5;
export const INTENSITY_LABELS: Readonly<Record<Intensity, string>> = {
  1: "관심 있음", 2: "가끔", 3: "주 1회", 4: "거의 매일", 5: "이게 인생",
};
/** "입문 환영" 자동 표시 조건: Top3 중 intensity ≤ 2 (PRD §0-30) */
export const BEGINNER_WELCOME_MAX_INTENSITY: Intensity = 2;

// ---------- 인증 레벨 라벨 (PRD §0-29, 10_brand §6.1) ----------
export type VerifyLevel = 0 | 1 | 2 | 3;
export const VERIFY_LABELS: Readonly<Record<VerifyLevel, string>> = {
  0: "가입", 1: "휴대폰", 2: "본인인증", 3: "사진인증",
};

// ---------- §6.3 아바타 결정론적 생성 ----------
export type AvatarDecor = "tl" | "br" | "none";
export interface AvatarSpec {
  bg: string;
  fg: string;
  emoji: string;
  /** lucide export 이름 */
  iconExport: string;
  /** secondary-200 원형 데코 위치: hash % 3 */
  decor: AvatarDecor;
  decorColor: string;
  category: HobbyCategorySlug;
}

/** FNV-1a 32bit — 서버/클라이언트 동일 결과 */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const DECORS: readonly AvatarDecor[] = ["tl", "br", "none"];

/**
 * 사진 없는 프로필 아바타 스펙 (10_brand §6.3 규칙 4).
 * 색은 카테고리 고정, 변주는 데코 위치만. 사람 실루엣·이니셜·성별 기본 아바타 금지.
 */
export function avatarFor(profileId: string, categorySlug: HobbyCategorySlug | string): AvatarSpec {
  const cat = isHobbyCategorySlug(categorySlug) ? HOBBY_BY_SLUG[categorySlug] : HOBBY_BY_SLUG.fandom;
  const decor = DECORS[hashString(profileId) % 3] ?? "none";
  return {
    bg: cat.avatarBg,
    fg: cat.avatarFg,
    emoji: cat.emoji,
    iconExport: cat.iconExport,
    decor,
    decorColor: LILAC[200],
    category: cat.slug,
  };
}

// ---------- 궁합 게이지 색 규칙 (C2 확정) ----------
/** 0~39 muted / 40~79 primary / 80~100 accent(코랄 = "감정이 움직이는 순간"만) */
export function compatTone(score: number): "muted" | "primary" | "accent" {
  if (score >= 80) return "accent";
  if (score >= 40) return "primary";
  return "muted";
}

// ---------- 법적 플레이스홀더 (07_legal §1, 13_company 결정 5) ----------
export const LEGAL_TODO = "[TODO_사업자정보]";
export function isLegalPlaceholder(v: string | null | undefined): boolean {
  if (!v) return true;
  const t = v.trim();
  return t.length === 0 || /^\{\{[A-Z0-9_]+\}\}$/.test(t) || t === LEGAL_TODO;
}
export function displayLegal(v: string | null | undefined): string {
  return isLegalPlaceholder(v) ? LEGAL_TODO : (v as string);
}
