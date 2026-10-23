// 개발/데모용 합성 데이터. UI 에서 "simulator" 소스로 명확히 표시된다. 운영에서는 끈다.
import { config } from "../../config.js";

export function createSimulatorAdapter({ rng = Math.random } = {}) {
  let seq = 0;
  let burst = null; // { coin, until }
  const syms = config.coins.map(c => c.symbol);
  const pick = a => a[Math.floor(rng() * a.length)];
  // 복붙 필터(숫자·구두점 무시)에 걸리지 않도록 게시물마다 다른 문자열
  const word = () => Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(rng() * 26))).join("");
  const phrases = ["to the moon", "떡상 가나", "차트 보는 중", "매수 고민", "거래량 터짐", "뉴스 나왔네", "지지선 테스트", "hodl"];

  return {
    name: "simulator",
    pollIntervalSec: 5,
    policy: "합성 데이터 (실제 플랫폼 아님)",
    async fetch() {
      const now = Date.now();
      if (!burst && rng() < 0.03) burst = { coin: pick(syms), until: now + 90000 };
      if (burst && now > burst.until) burst = null;
      const events = [];
      const n = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) events.push(mk(pick(syms)));
      if (burst) for (let i = 0; i < 6 + Math.floor(rng() * 6); i++) events.push(mk(burst.coin));
      return { events };

      function mk(coin) {
        seq++;
        return { id: `sim-${now}-${seq}`, author: `user${Math.floor(rng() * 500)}`, text: `$${coin} ${pick(phrases)} ${word()}`, createdAt: now - Math.floor(rng() * 4000) };
      }
    },
  };
}
