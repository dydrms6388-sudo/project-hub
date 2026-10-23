// Reddit Data API (공식, OAuth client_credentials).
// 제약: OAuth 클라이언트당 분당 100회(QPM). 응답 헤더 X-Ratelimit-* 를 따라 속도를 낮춘다.
// 한 사이클 = /new + /comments 2회 요청 → 폴링 간격 = max(REDDIT_POLL_SEC, 60 / (maxQpm/2)).
// ※ 탐지 엔진은 10초마다 돌지만, 이 소스의 데이터는 폴링 간격 단위로만 갱신된다.
import { config } from "../../config.js";

const NAME = "reddit";

export function redditPollIntervalSec() {
  const byQuota = Math.ceil(60 / (config.reddit.maxQpm / 2));
  return Math.max(Number(process.env.REDDIT_POLL_SEC || 15), byQuota);
}

export function createRedditAdapter({ fetchImpl = fetch } = {}) {
  const c = config.reddit;
  let token = null, tokenExp = 0, pauseUntil = 0;

  async function auth() {
    if (token && Date.now() < tokenExp - 60000) return token;
    const res = await fetchImpl("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        authorization: "Basic " + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64"),
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": c.userAgent,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`reddit auth ${res.status}`);
    const j = await res.json();
    token = j.access_token;
    tokenExp = Date.now() + j.expires_in * 1000;
    return token;
  }

  async function get(path) {
    const t = await auth();
    const res = await fetchImpl(`https://oauth.reddit.com${path}`, { headers: { authorization: `bearer ${t}`, "user-agent": c.userAgent } });
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(remaining) && remaining < 4 && Number.isFinite(reset)) pauseUntil = Date.now() + reset * 1000;
    if (res.status === 429) { pauseUntil = Date.now() + (reset || 60) * 1000; throw new Error("reddit 429 rate limited"); }
    if (!res.ok) throw new Error(`reddit ${res.status} ${path}`);
    return res.json();
  }

  return {
    name: NAME,
    pollIntervalSec: redditPollIntervalSec(),
    policy: `Reddit Data API(OAuth) · 한도 ≤${c.maxQpm}QPM 사용 · ${redditPollIntervalSec()}초 폴링`,
    async fetch() {
      if (Date.now() < pauseUntil) return { events: [], paused: Math.ceil((pauseUntil - Date.now()) / 1000) };
      const subs = c.subreddits.join("+");
      const [posts, comments] = await Promise.all([
        get(`/r/${subs}/new?limit=100&raw_json=1`),
        get(`/r/${subs}/comments?limit=100&raw_json=1`),
      ]);
      const events = [];
      for (const ch of posts.data?.children || []) {
        const d = ch.data;
        events.push({ id: d.name, author: d.author, text: `${d.title || ""}\n${d.selftext || ""}`, createdAt: d.created_utc * 1000 });
      }
      for (const ch of comments.data?.children || []) {
        const d = ch.data;
        events.push({ id: d.name, author: d.author, text: d.body || "", createdAt: d.created_utc * 1000 });
      }
      return { events: events.filter(e => e.author && e.author !== "[deleted]") };
    },
  };
}
