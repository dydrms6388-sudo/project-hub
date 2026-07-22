/**
 * 승격 잡 (수동 실행용 래퍼). 로직은 lib/promote-run.ts 공용 함수.
 * 실행: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx supabase/promote.ts
 */
import { runPromotion } from "../lib/promote-run";

runPromotion()
  .then((s) => {
    if (s.offline) {
      console.error("Supabase 환경변수 미설정");
      process.exit(1);
    }
    console.log(`승격 ${s.promoted} / 해제 ${s.demoted} / 미승격 사유:`, s.blocked);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
