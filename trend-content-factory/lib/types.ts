// 파이프라인 전역 도메인 타입.

export type Platform = 'ig' | 'fb' | 'tiktok' | 'threads' | 'x';
export type Format = 'card' | 'reel' | 'mixed';
export type RiskFlag = 'medical' | 'legal' | 'financial' | 'none';

export const ALL_PLATFORMS: Platform[] = ['ig', 'fb', 'tiktok', 'threads', 'x'];

export type TrendSourceType =
  | 'google_trends_rss'
  | 'rss_news'
  | 'reddit_json'
  | 'hackernews'
  | 'youtube_popular'
  | 'naver_datalab'
  | 'coingecko';

export type TrendSource = {
  type: TrendSourceType;
  /** 사람이 읽는 라벨 (로그/디버그용) */
  label: string;
  /** RSS/JSON 엔드포인트 (어댑터별 의미 상이). 일부 어댑터는 params만 사용 */
  url?: string;
  params?: Record<string, string | number | string[]>;
};

export type Vertical = {
  slug: string;
  handle: { ig: string; fb: string };
  topic: string;
  sources: TrendSource[];
  format: Format;
  /** 렌더 템플릿 ID (버티컬마다 고유; Phase 2 렌더러가 소비) */
  cardTemplate: string;
  palette: [string, string, string];
  typeface: string;
  /** 캡션 문체 지시문 */
  tone: string;
  /** 후킹 공식 */
  hookPattern: string;
  ctaPattern: string;
  postsPerDay: number;
  /** KST 게시 시각 후보 */
  bestHours: number[];
};

export type TrendItem = {
  vertical: string;
  title: string;
  summary: string;
  source_url: string;
  raw: Record<string, unknown>;
  /** 최근 급상승 정도 0~1 (어댑터 신호 정규화) */
  velocity_score: number;
  /** 신선도 0~1 (최근 이력과의 임베딩 유사도 역수) */
  novelty_score: number;
  collected_at: string; // ISO8601
};

export type ComposeSlide = { headline: string; body: string; visual_query: string };
export type ReelBeat = { t: number; narration: string; onscreen: string; b_roll: string };

/** Claude 가 반환하는 소재 초안 (스키마 강제) */
export type Draft = {
  hook: string;
  slides: ComposeSlide[];
  caption: string;
  hashtags: string[];
  cta: string;
  reel_script: ReelBeat[];
  risk_flags: RiskFlag[];
  fact_confidence: number;
  source_url: string;
};

export type DraftStatus = 'draft' | 'rejected' | 'approved';

/** DB/스토어에 적재되는 초안 레코드 */
export type DraftRecord = Draft & {
  id: string;
  vertical: string;
  trend_title: string;
  format: Format;
  created_at: string;
  status: DraftStatus;
  /** 목업 생성기로 만든 초안이면 true (실제 Claude 아님) */
  mock: boolean;
};

// ── M3 품질 게이트 ──

export type PersonaKey = 'scroller' | 'expert' | 'editor' | 'designer' | 'algo' | 'risk';

export type PersonaVerdict = {
  persona: PersonaKey;
  score: number; // 0~100 (persona별 배점 합이 100 되도록 정규화 전 원점수)
  follow: boolean; // "이 계정을 팔로우할 것인가?" YES=true
  note: string;
};

export type ReviewRecord = {
  id: string;
  draft_id: string;
  vertical: string;
  total_score: number; // 0~100
  persona_scores: Record<PersonaKey, number>;
  follow_no_count: number;
  passed: boolean;
  reasons: string[];
  mock: boolean;
  created_at: string;
};

// ── M4 렌더러 ──

export type AssetKind = 'card_png' | 'reel_mp4';

export type AssetRecord = {
  id: string;
  draft_id: string;
  vertical: string;
  platform: Platform;
  kind: AssetKind;
  storage_path: string;
  width: number;
  height: number;
  duration_ms: number;
  meta: Record<string, unknown>;
  created_at: string;
};
