// 런타임 설정. 모든 값은 env 로 덮어쓸 수 있다 (.env.example 참고).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const num = (k, d) => (env[k] !== undefined && env[k] !== "" ? Number(env[k]) : d);

export const config = {
  redisUrl: env.REDIS_URL || "redis://127.0.0.1:6379",
  keyPrefix: env.REDIS_PREFIX || "ms:",

  // 탐지 엔진: 10초마다 실행, 최근 60초 vs 직전 60초
  tickSec: num("DETECT_TICK_SEC", 10),
  windowSec: num("DETECT_WINDOW_SEC", 60),

  // 시스템 기본 임계치 (사용자별 설정이 없으면 이 값)
  defaults: {
    minGrowthPct: num("DEFAULT_MIN_GROWTH_PCT", 200),
    minCount: num("DEFAULT_MIN_COUNT", 20),
    minUniqueAuthors: num("DEFAULT_MIN_UNIQUE_AUTHORS", 8),
    // 기준 구간 0건 → "신규 급증" 별도 분류. 이 분류도 최소 건수/작성자 조건은 동일 적용.
    alertOnNewSurge: true,
    cooldownSec: num("DEFAULT_COOLDOWN_SEC", 900),
    // 같은 이벤트 진행 중 재알림 조건: 쿨다운 경과 AND (언급량이 마지막 알림 대비 x배 이상)
    realertMultiplier: num("DEFAULT_REALERT_MULTIPLIER", 2),
    // 조건 미충족이 이 시간 지속되면 이벤트 종료 → 다음 충족 시 새 이벤트
    eventResetSec: num("DEFAULT_EVENT_RESET_SEC", 300),
    channels: { telegram: true, email: true },
    coins: [], // 빈 배열 = 전체 코인
  },

  // 필터
  filter: {
    maxPerAuthorPerWindow: num("FILTER_MAX_PER_AUTHOR_PER_WINDOW", 2),
    dupContentTtlSec: num("FILTER_DUP_CONTENT_TTL_SEC", 600),
    maxEventAgeSec: num("FILTER_MAX_EVENT_AGE_SEC", 300),
    botNamePattern: env.FILTER_BOT_NAME_PATTERN || "(bot|_bot|-bot|automoderator)$",
    minContentChars: num("FILTER_MIN_CONTENT_CHARS", 3),
  },

  // 데이터 신선도: 마지막 수집 성공이 이보다 오래된 소스는 "stale" → 그 소스만으로는 판정하지 않음
  freshnessMaxLagSec: num("FRESHNESS_MAX_LAG_SEC", 90),
  retentionSec: num("RETENTION_SEC", 900),

  // 수집 소스
  reddit: {
    enabled: env.REDDIT_ENABLED === "1",
    clientId: env.REDDIT_CLIENT_ID || "",
    clientSecret: env.REDDIT_CLIENT_SECRET || "",
    userAgent: env.REDDIT_USER_AGENT || "mention-spike/0.1 (by tomatoeggcat.com)",
    subreddits: (env.REDDIT_SUBREDDITS || "CryptoCurrency,CryptoMarkets,Bitcoin").split(",").map(s => s.trim()).filter(Boolean),
    // Reddit Data API 무료 한도: OAuth 클라이언트당 100 QPM. 기본은 여유를 두고 계산.
    maxQpm: num("REDDIT_MAX_QPM", 60),
  },
  simulator: { enabled: env.SIMULATOR_ENABLED === "1" },

  // 알림
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN || "",
    apiBase: env.TELEGRAM_API_BASE || "https://api.telegram.org",
  },
  smtp: {
    url: env.SMTP_URL || "", // 예: smtps://user:pass@smtp.gmail.com:465
    from: env.SMTP_FROM || "",
  },
  notifier: {
    maxAttempts: num("NOTIFY_MAX_ATTEMPTS", 5),
    claimIdleMs: num("NOTIFY_CLAIM_IDLE_MS", 30000),
  },

  api: {
    port: num("PORT", 8787),
    token: env.API_TOKEN || "",
    ingestToken: env.INGEST_TOKEN || "",
  },

  coins: JSON.parse(readFileSync(env.COINS_FILE || join(root, "config/coins.json"), "utf8")),
  publicDir: join(root, "public"),
};
