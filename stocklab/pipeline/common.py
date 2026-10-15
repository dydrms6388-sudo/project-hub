"""파이프라인 공용 유틸 — env 로딩, Supabase(service role) 클라이언트, 재시도, 배치 upsert, 로깅.

환경변수 (pipeline/README.md):
  SUPABASE_URL (또는 NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
  DART_API_KEY, KIS_APP_KEY, KIS_APP_SECRET, SITE_URL (또는 NEXT_PUBLIC_SITE_URL), CRON_SECRET
  DRY_RUN=1 → DB 쓰기 없이 로그만
"""
from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, Iterable

from dotenv import load_dotenv
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from transforms import chunked, kst_date_string, kst_now, kst_today  # noqa: F401  (re-export)

PIPELINE_DIR = Path(__file__).resolve().parent
STOCKLAB_DIR = PIPELINE_DIR.parent
CACHE_DIR = PIPELINE_DIR / ".cache"  # .gitignore 에 등록됨

# ─────────────────────────── env ───────────────────────────
def load_env() -> None:
    """pipeline/.env → stocklab/.env.local → stocklab/.env 순서로 로드 (기존 값 우선)."""
    for p in (PIPELINE_DIR / ".env", STOCKLAB_DIR / ".env.local", STOCKLAB_DIR / ".env"):
        if p.exists():
            load_dotenv(p, override=False)


load_env()


def env(name: str, *aliases: str, default: str | None = None) -> str | None:
    for n in (name, *aliases):
        v = os.environ.get(n)
        if v:
            return v.strip()
    return default


def require_env(name: str, *aliases: str) -> str:
    v = env(name, *aliases)
    if not v:
        raise SystemExit(f"[env] {name} 가 설정되지 않았습니다 (pipeline/README.md 참고)")
    return v


def is_dry_run() -> bool:
    return env("DRY_RUN", default="0") in ("1", "true", "TRUE", "yes")


# ─────────────────────────── 로깅 ───────────────────────────
def get_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=os.environ.get("LOG_LEVEL", "INFO"),
            format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
            stream=sys.stdout,
        )
    return log


log = get_logger("common")


# ─────────────────────────── 재시도 ───────────────────────────
def _log_retry(state: RetryCallState) -> None:
    exc = state.outcome.exception() if state.outcome else None
    log.warning("재시도 %d/%d: %s", state.attempt_number, 4, repr(exc)[:200])


def with_retry(fn: Callable[..., Any] | None = None, *, attempts: int = 4, min_wait: float = 1, max_wait: float = 20):
    """일시적 예외(네트워크·5xx 등)에 지수 백오프 재시도 데코레이터. 예: @with_retry 또는 @with_retry(attempts=3)"""
    deco = retry(
        reraise=True,
        stop=stop_after_attempt(attempts),
        wait=wait_exponential(multiplier=min_wait, min=min_wait, max=max_wait),
        retry=retry_if_exception_type(Exception),
        before_sleep=_log_retry,
    )
    return deco(fn) if fn is not None else deco


def polite_sleep(seconds: float) -> None:
    """외부 API 예의상 대기 (0 이하면 무시)."""
    if seconds > 0:
        time.sleep(seconds)


# ─────────────────────────── Supabase ───────────────────────────
_client = None


def get_supabase():
    """service role 클라이언트 (RLS 우회 — 서버/CI 전용). DRY_RUN 이면 None."""
    global _client
    if is_dry_run():
        return None
    if _client is None:
        from supabase import create_client  # 지연 import (테스트 시 불필요)

        url = require_env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
        key = require_env("SUPABASE_SERVICE_ROLE_KEY")
        _client = create_client(url, key)
    return _client


@with_retry(attempts=3)
def _upsert_chunk(table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
    sb = get_supabase()
    sb.table(table).upsert(rows, on_conflict=on_conflict).execute()


def upsert_rows(table: str, rows: Iterable[dict[str, Any]], on_conflict: str, chunk_size: int = 500) -> int:
    """500 행씩 나누어 upsert. 반환: 처리 행 수. DRY_RUN 이면 로그만."""
    total = 0
    for batch in chunked(list(rows), chunk_size):
        total += len(batch)
        if is_dry_run():
            log.info("[dry-run] %s upsert %d행 (예: %s)", table, len(batch), {k: batch[0][k] for k in list(batch[0])[:4]})
            continue
        _upsert_chunk(table, batch, on_conflict)
        log.info("%s upsert %d행 (누적 %d)", table, len(batch), total)
    return total


@with_retry(attempts=3)
def select_all(table: str, columns: str = "*", page_size: int = 1000, **eq_filters: Any) -> list[dict[str, Any]]:
    """PostgREST 기본 1,000행 제한을 넘는 조회를 페이지네이션으로 수행."""
    sb = get_supabase()
    if sb is None:
        return []
    out: list[dict[str, Any]] = []
    start = 0
    while True:
        q = sb.table(table).select(columns).range(start, start + page_size - 1)
        for k, v in eq_filters.items():
            q = q.eq(k, v)
        res = q.execute()
        data = res.data or []
        out.extend(data)
        if len(data) < page_size:
            break
        start += page_size
    return out


def fetch_latest_prices() -> dict[str, dict[str, Any]]:
    """종목별 최신 daily_prices 행 {code: {trade_date, close, market_cap, listed_shares}}.

    최근 10일 구간만 조회해 per-code 최신값을 고른다 (전체 스캔 회피).
    """
    sb = get_supabase()
    if sb is None:
        return {}
    from datetime import timedelta

    since = (kst_today() - timedelta(days=10)).isoformat()
    out: dict[str, dict[str, Any]] = {}
    start, page = 0, 1000
    while True:
        res = (
            sb.table("daily_prices")
            .select("code,trade_date,close,market_cap,listed_shares")
            .gte("trade_date", since)
            .order("trade_date", desc=True)
            .range(start, start + page - 1)
            .execute()
        )
        data = res.data or []
        for r in data:
            out.setdefault(r["code"], r)  # 최신순 정렬이므로 첫 등장이 최신
        if len(data) < page:
            break
        start += page
    return out


@with_retry(attempts=3)
def update_where_in(table: str, patch: dict[str, Any], column: str, values: list[str], chunk_size: int = 500) -> int:
    """UPDATE table SET patch WHERE column IN (values) — 500 개씩. DRY_RUN 이면 로그만."""
    total = 0
    for batch in chunked(values, chunk_size):
        total += len(batch)
        if is_dry_run():
            log.info("[dry-run] %s update %s where %s in (%d개)", table, patch, column, len(batch))
            continue
        get_supabase().table(table).update(patch).in_(column, batch).execute()
    return total


def active_codes() -> list[str]:
    rows = select_all("stocks", "code", is_active=True)
    return [r["code"] for r in rows]


def ensure_cache_dir() -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR
