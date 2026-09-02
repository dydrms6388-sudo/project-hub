"""일배치 오케스트레이터 — GitHub Actions(05:30 KST 평일) 또는 로컬에서 실행.

순서: stocks → prices → financials(월요일 또는 --with-financials) → dividends → daily-pick 트리거
각 단계는 try/except 로 격리되어 하나가 실패해도 다음 단계로 진행하고, 마지막에 요약을 출력한다.
종료코드: 필수 단계(stocks/prices) 실패 시 1, 그 외 0.

DART 쿼터 분산 (기본, 키 있을 때):
  월(isoweekday 1) financials DART (~5,400건)
  화(isoweekday 2) dividends  DART (~5,400건, years=6)
  그 외 요일        dividends  pykrx (DIV/DPS, 쿼터 무관)
  financials 는 월요일 외에는 건너뜀 (--with-financials 로 강제). DART 키 없으면 매일 pykrx 로 채움.

사용: python run_daily.py [--with-financials] [--with-dividends-dart] [--full] [--skip-trigger] [--dry-run]
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import traceback
from typing import Any, Callable

from common import env, get_logger, kst_now

log = get_logger("run_daily")


def step(name: str, fn: Callable[[], Any], results: list[dict[str, Any]], required: bool = False) -> None:
    t0 = time.time()
    log.info("━━━━━━━━━━ %s 시작", name)
    try:
        out = fn()
        results.append({"step": name, "ok": True, "sec": round(time.time() - t0, 1), "result": out})
        log.info("━━━━━━━━━━ %s 완료 (%.1fs)", name, time.time() - t0)
    except SystemExit as e:  # require_env 등
        results.append({"step": name, "ok": False, "sec": round(time.time() - t0, 1), "error": str(e), "required": required})
        log.error("%s 중단: %s", name, e)
    except Exception as e:  # noqa: BLE001
        results.append({"step": name, "ok": False, "sec": round(time.time() - t0, 1), "error": repr(e)[:300], "required": required})
        log.error("%s 실패: %s\n%s", name, e, traceback.format_exc(limit=3))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--with-financials", action="store_true", help="요일 무관 financials 실행")
    ap.add_argument("--with-dividends-dart", action="store_true", help="요일 무관 dividends 를 DART 로 실행")
    ap.add_argument("--full", action="store_true", help="prices 20년 백필 (최초 1회)")
    ap.add_argument("--skip-trigger", action="store_true", help="daily-pick 트리거 생략")
    ap.add_argument("--skip-stocks", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if a.dry_run:
        os.environ["DRY_RUN"] = "1"

    now = kst_now()
    weekday = now.isoweekday()  # 월=1 … 일=7
    has_dart = bool(env("DART_API_KEY"))
    run_fin = a.with_financials or weekday == 1 or not has_dart
    div_source = "dart" if (has_dart and (a.with_dividends_dart or weekday == 2)) else "pykrx"
    log.info("KST %s (isoweekday=%d) dart=%s financials=%s dividends=%s full=%s", now.strftime("%F %T"), weekday, has_dart, run_fin, div_source, a.full)

    results: list[dict[str, Any]] = []

    if not a.skip_stocks:
        def _stocks():
            import load_stocks
            return load_stocks.run()
        step("stocks", _stocks, results, required=True)

    def _prices():
        from datetime import timedelta

        import load_prices
        from transforms import kst_today, weekdays_back

        end = kst_today() - timedelta(days=1)
        if a.full:
            return load_prices.run(end.replace(year=end.year - 20), end, sleep_sec=2.0)
        return load_prices.run(weekdays_back(end, 5)[-1], end)
    step("prices", _prices, results, required=True)

    if run_fin:
        def _fin():
            import load_financials
            return load_financials.run("auto" if has_dart else "pykrx", None, **({"with_quarter": True} if has_dart else {}))
        step("financials", _fin, results)
    else:
        results.append({"step": "financials", "ok": True, "skipped": True, "reason": "월요일/--with-financials 아님"})

    def _div():
        import load_dividends
        return load_dividends.run(div_source, None, **({"years": 6} if div_source == "dart" else {}))
    step(f"dividends({div_source})", _div, results)

    if not a.skip_trigger and not a.dry_run:
        def _trig():
            import trigger_daily_pick
            r = trigger_daily_pick.run()
            if not (r.get("ok") or r.get("skipped")):
                raise RuntimeError(f"trigger 실패 status={r.get('status')} {str(r.get('body'))[:120]}")
            return r
        step("daily-pick trigger", _trig, results)

    # ── 요약 ──
    print("\n" + "=" * 80)
    print(f"run_daily 요약 — KST {now.strftime('%F %T')}")
    print("-" * 80)
    failed_required = False
    for r in results:
        if r.get("skipped"):
            print(f"  SKIP  {r['step']:<24} {r.get('reason','')}")
        elif r["ok"]:
            res = r.get("result")
            print(f"  OK    {r['step']:<24} {r['sec']:>6}s  {str(res)[:90] if res is not None else ''}")
        else:
            print(f"  FAIL  {r['step']:<24} {r['sec']:>6}s  {r.get('error','')}")
            if r.get("required"):
                failed_required = True
    print("=" * 80)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(f"## 스톡랩 파이프라인 {now.strftime('%F')}\n\n| step | ok | detail |\n|---|---|---|\n")
            for r in results:
                d = r.get("reason") or r.get("error") or str(r.get("result", ""))[:120]
                f.write(f"| {r['step']} | {'skip' if r.get('skipped') else ('✅' if r['ok'] else '❌')} | {d.replace('|','/')} |\n")
    return 1 if failed_required else 0


if __name__ == "__main__":
    sys.exit(main())
