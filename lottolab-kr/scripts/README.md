# 로또 회차 데이터 수집

`data/draws.json` 은 `fetch-draws.mjs` 로만 채운다. 손으로 번호를 적어 넣지 말 것
(당첨번호는 틀리면 안 되는 데이터다).

## 실행

```bash
node lottolab-kr/scripts/fetch-draws.mjs
```

- `draws.json` 의 마지막 회차 다음부터 순차 요청한다. 처음 실행하면 1회차부터 전부 받으므로
  회차 수 × 0.4초(기본 딜레이) 만큼 걸린다 (1,100회차 기준 약 8분).
- 50회마다 중간 저장하므로 중단돼도 다음 실행이 이어받는다.
- 아직 추첨 전 회차에 도달하면 정상 종료한다.
- 실패하면 그때까지 받은 것만 저장하고 종료 코드 1로 끝난다. **가짜 데이터를 만들지 않는다.**

환경 변수: `FETCH_DELAY_MS`(기본 400), `MAX_DRAWS_PER_RUN`(기본 1300).

## 국내 IP에서 실행해야 한다

동행복권은 해외 IP 요청에 JSON 대신 HTML 안내 페이지를 돌려준다. 확인된 사례:

| 실행 환경 | 결과 |
|---|---|
| GitHub Actions (ubuntu-latest) | `content-type: text/html` — 차단. 브라우저와 동일한 UA/Accept/Referer 로도 동일 |
| 국내 네트워크 | 정상 동작 (JSON) |

그래서 `.github/workflows/lotto-draws.yml` 의 주간 cron 은 비활성화되어 있고
`workflow_dispatch` 만 남아 있다. 갱신 방법은 둘 중 하나다.

1. **로컬에서 실행 후 커밋** (국내 네트워크)
   ```bash
   node lottolab-kr/scripts/fetch-draws.mjs
   git add lottolab-kr/data/draws.json
   git commit -m "chore(lottolab-kr): 회차 데이터 갱신"
   git push
   ```
2. **국내에 셀프호스티드 러너를 붙인 뒤** 워크플로의 `runs-on` 을 그 러너로 바꾸고
   위 주석의 `schedule` 을 되살린다.

데이터가 비어 있는 동안 조회·당첨확인·통계·조합분석 페이지는 "회차 데이터 수집 준비 중"
안내를 표시하고, 번호 생성기·확률 체험·연금복권·재미 뽑기는 데이터 없이도 정상 동작한다.
