// 환경변수 로딩 + 검증. 시크릿은 코드/커밋에 하드코딩하지 않는다.
// dry-run 에서는 대부분의 시크릿이 없어도 동작하도록 optional 처리한다.

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const env = {
  supabaseUrl: str('SUPABASE_URL'),
  supabaseServiceKey: str('SUPABASE_SERVICE_ROLE_KEY'),

  anthropicApiKey: str('ANTHROPIC_API_KEY'),
  composeModel: str('COMPOSE_MODEL', 'claude-sonnet-5'),
  reviewModel: str('REVIEW_MODEL', 'claude-sonnet-5'),

  youtubeApiKey: str('YOUTUBE_API_KEY'),
  naverClientId: str('NAVER_CLIENT_ID'),
  naverClientSecret: str('NAVER_CLIENT_SECRET'),

  telegramBotToken: str('TELEGRAM_BOT_TOKEN'),
  telegramChatId: str('TELEGRAM_CHAT_ID'),

  ingestPerSourceLimit: num('INGEST_PER_SOURCE_LIMIT', 25),
  composeOversample: num('COMPOSE_OVERSAMPLE', 2.5),
  httpTimeoutMs: num('HTTP_TIMEOUT_MS', 15000),
  logLevel: str('LOG_LEVEL', 'info') as LogLevel,
} as const;

export function hasSupabase(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}

export function hasClaude(): boolean {
  return Boolean(env.anthropicApiKey);
}
