#!/usr/bin/env bash
# =============================================================================
# scripts/db-test.sh — DB 레벨 Phase 1 통합 테스트 러너 (G1)
#   로컬 PostgreSQL 16(Docker/Supabase CLI 없음)에 검증용 셰임(supabase/tests/shim/*.sql) → 마이그레이션 전부
#   → seed.sql → supabase/tests/*.sql 순으로 적용한다. 테스트 SQL 은 기대값을 `do $$ … raise exception` 으로 단정한다.
#   셰임은 검증 전용이며 프로덕션/실 Supabase 에는 적용하지 않는다.
#
#   사용:  bash scripts/db-test.sh [DB이름]            (기본 duckmate_test)
#   env :  PGSUPER=<psql 접속 명령 접두어>             기본 "su postgres -c" (root) / 일반 사용자는 PGSUPER="psql" 등
#          DB_TEST_KEEP=1                                끝나도 DB 를 남긴다(디버깅)
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SB="$ROOT/supabase"
DB="${1:-duckmate_test}"

# psql 실행기: root 면 su postgres, 아니면 현재 사용자의 psql (PGSUPER 로 덮어쓰기 가능)
if [ -n "${PGSUPER:-}" ]; then
  psql_admin() { $PGSUPER "$@"; }
elif [ "$(id -u)" = "0" ]; then
  psql_admin() { su postgres -c "psql -q -v ON_ERROR_STOP=1 $*"; }
else
  psql_admin() { eval psql -q -v ON_ERROR_STOP=1 "$*"; }
fi

run_file() { # run_file <db> <file> — 파일을 stdin 으로 넘겨 su 경계를 넘긴다. NOTICE 는 필터, 에러는 그대로 노출
  local db="$1" f="$2" out rc
  out=$(cat "$f" | psql_admin "-d $db" 2>&1); rc=$?
  printf '%s\n' "$out" | grep -v -E 'NOTICE' | grep -v '^$' || true
  return $rc
}

echo "== create database $DB"
psql_admin "-c 'drop database if exists $DB'" >/dev/null
psql_admin "-c 'create database $DB'" >/dev/null

fail=0
step() { echo "== $1"; }

step "shim (검증 전용)"
# 순서 고정: supabase_shim(롤·auth/storage 스키마) → realtime_shim(realtime 스키마, 롤에 grant). 글롭 알파벳 순은 역순이라 CI(빈 클러스터)에서 "role anon does not exist"로 실패한다.
for f in "$SB"/tests/shim/supabase_shim.sql "$SB"/tests/shim/realtime_shim.sql; do run_file "$DB" "$f" || { echo "FAILED: $f"; exit 1; }; done

count=0
for f in "$SB"/migrations/*.sql; do
  step "migration $(basename "$f")"
  run_file "$DB" "$f" || { echo "FAILED: $f"; exit 1; }
  count=$((count+1))
done
echo "== migrations applied: $count"

step "seed.sql"
run_file "$DB" "$SB/seed.sql" || { echo "FAILED: seed.sql"; exit 1; }

for f in "$SB"/tests/*.sql; do
  step "test $(basename "$f")"
  if run_file "$DB" "$f"; then echo "PASS $(basename "$f")"; else echo "FAIL $(basename "$f")"; fail=1; fi
done

if [ "${DB_TEST_KEEP:-0}" != "1" ]; then psql_admin "-c 'drop database if exists $DB'" >/dev/null; fi
if [ "$fail" = "0" ]; then echo "DB TESTS PASSED (migrations=$count)"; else echo "DB TESTS FAILED"; exit 1; fi
