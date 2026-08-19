#!/usr/bin/env bash
# 10개 사이트를 정적 export 해서 허브 리포의 preview/<project>/ 로 복사한다.
# 허브 Vercel 프로젝트(outputDirectory ".")가 그대로 서빙하므로
# 브랜치 프리뷰 배포 URL 에서 /preview/<project>/ 로 바로 열어볼 수 있다.
#
#   사용: bash sites/build-preview.sh [project ...]   (인자 없으면 전체)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITES="$ROOT/sites"
OUT="$ROOT/preview"

if [ "$#" -gt 0 ]; then
  PROJECTS=("$@")
else
  mapfile -t PROJECTS < <(find "$SITES" -maxdepth 1 -mindepth 1 -type d \
    -not -name '_template' -printf '%f\n' | sort)
fi

mkdir -p "$OUT"
ok=(); fail=()

for p in "${PROJECTS[@]}"; do
  dir="$SITES/$p"
  [ -f "$dir/package.json" ] || { echo "skip $p (no package.json)"; continue; }
  echo "=============== $p ==============="

  if [ ! -d "$dir/node_modules" ]; then
    ( cd "$dir" && npm install --no-audit --no-fund >/dev/null 2>&1 ) \
      || { echo "  ✗ install 실패"; fail+=("$p(install)"); continue; }
  fi

  if ( cd "$dir" && STATIC_EXPORT=1 STATIC_BASE_PATH="/preview/$p" \
        npx next build >/tmp/build-$p.log 2>&1 ); then
    rm -rf "${OUT:?}/$p"
    mkdir -p "$OUT/$p"
    cp -r "$dir/out/." "$OUT/$p/"
    echo "  ✓ export → preview/$p/"
    ok+=("$p")
  else
    echo "  ✗ export 실패 — /tmp/build-$p.log 참고"
    tail -20 "/tmp/build-$p.log"
    fail+=("$p(build)")
  fi
done

echo
echo "성공(${#ok[@]}): ${ok[*]:-없음}"
echo "실패(${#fail[@]}): ${fail[*]:-없음}"
[ "${#fail[@]}" -eq 0 ]
