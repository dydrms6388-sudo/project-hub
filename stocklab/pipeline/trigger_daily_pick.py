"""오늘의 종목 선정 트리거 — Next.js 크론 라우트 호출 (Vercel Cron 대체/보조).

POST $SITE_URL/api/cron/daily-pick  (Authorization: Bearer $CRON_SECRET)
405 면 GET 으로 재시도 (Vercel Cron 은 GET 으로 호출하므로 라우트가 GET 만 받을 수 있음).

사용: python trigger_daily_pick.py [--url https://...] [--timeout 60]
종료코드: 0 성공(2xx), 1 실패
"""
from __future__ import annotations

import argparse
import sys

import requests

from common import env, get_logger, kst_date_string

log = get_logger("trigger_daily_pick")


def trigger(site_url: str, secret: str, timeout: int = 60) -> tuple[bool, int, str]:
    url = site_url.rstrip("/") + "/api/cron/daily-pick"
    headers = {"Authorization": f"Bearer {secret}", "User-Agent": "stocklab-pipeline/1.0"}
    for method in ("POST", "GET"):
        try:
            r = requests.request(method, url, headers=headers, timeout=timeout)
        except requests.RequestException as e:
            return False, 0, repr(e)[:300]
        if r.status_code == 405 and method == "POST":
            log.info("POST 405 → GET 재시도")
            continue
        return 200 <= r.status_code < 300, r.status_code, r.text[:500]
    return False, 405, "POST/GET 모두 405"


def run(site_url: str | None = None, secret: str | None = None, timeout: int = 60) -> dict:
    site_url = site_url or env("SITE_URL", "NEXT_PUBLIC_SITE_URL")
    secret = secret or env("CRON_SECRET")
    if not site_url or not secret:
        log.warning("SITE_URL 또는 CRON_SECRET 미설정 — 트리거 스킵")
        return {"skipped": True, "reason": "missing SITE_URL/CRON_SECRET"}
    ok, status, body = trigger(site_url, secret, timeout)
    log.log(20 if ok else 40, "daily-pick %s status=%s body=%s", kst_date_string(), status, body[:200])
    return {"ok": ok, "status": status, "body": body}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", help="SITE_URL 대신 사용")
    ap.add_argument("--timeout", type=int, default=60)
    a = ap.parse_args(argv)
    res = run(a.url, timeout=a.timeout)
    return 0 if (res.get("ok") or res.get("skipped")) else 1


if __name__ == "__main__":
    sys.exit(main())
