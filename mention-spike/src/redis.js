import Redis from "ioredis";
import { config } from "./config.js";

export function createRedis(url = config.redisUrl) {
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
}

// Redis 키 레이아웃. 한 곳에서만 정의한다.
const p = () => config.keyPrefix;
export const K = {
  mentions: coin => `${p()}m:${coin}`,               // ZSET score=createdAt(ms) member=json
  seen: (src, id) => `${p()}seen:${src}:${id}`,      // 원천 이벤트 id 중복
  dupContent: (coin, h) => `${p()}dup:${coin}:${h}`, // 동일 본문 복붙
  authorRate: (coin, author, bucket) => `${p()}ar:${coin}:${author}:${bucket}`,
  botAuthors: () => `${p()}bots`,                    // SET 수동 차단 작성자
  source: name => `${p()}src:${name}`,               // HASH 소스 상태/신선도
  sources: () => `${p()}srcs`,                       // SET 소스 이름
  snapshot: () => `${p()}snapshot`,                  // STRING 최신 탐지 결과(json)
  updates: () => `${p()}updates`,                    // PUB/SUB 채널 (실시간 UI)
  tickLock: tick => `${p()}lock:tick:${tick}`,       // 엔진 다중 인스턴스 시 1회만 실행
  users: () => `${p()}users`,                        // SET 사용자 id
  user: id => `${p()}user:${id}`,                    // STRING 사용자 설정(json)
  alertState: (user, coin) => `${p()}as:${user}:${coin}`, // STRING 이벤트/쿨다운 상태(json)
  alertQueue: () => `${p()}q:alerts`,                // STREAM 알림 작업 큐
  alertDlq: () => `${p()}q:alerts:dead`,             // STREAM 실패 작업
  delivered: (jobKey, ch) => `${p()}sent:${jobKey}:${ch}`, // 채널별 발송 완료 (멱등)
  audit: () => `${p()}audit`,                        // STREAM 감사 로그
};
export const ALERT_GROUP = "notifiers";
