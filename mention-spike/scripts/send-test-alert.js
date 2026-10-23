// 실제 알림 발송 테스트 (Redis 불필요). 운영 자격증명으로 진짜 메시지를 보낸다.
//   TELEGRAM_BOT_TOKEN=... SMTP_URL=... SMTP_FROM=... \
//   node scripts/send-test-alert.js --telegram 123456789 --email me@example.com
// 하나라도 실패하면 exit 1.
import { formatAlert, sendTelegram, sendEmail } from "../src/notify/channels.js";

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const chat = opt("telegram"), email = opt("email");
if (!chat && !email) {
  console.error("사용법: node scripts/send-test-alert.js [--telegram <chat_id>] [--email <addr>]");
  process.exit(2);
}

const msg = formatAlert({ test: true, user: "cli", at: Date.now() });
let failed = false;
for (const [ch, to, fn] of [["telegram", chat, () => sendTelegram(chat, msg.text)], ["email", email, () => sendEmail(email, msg.title, msg.text)]]) {
  if (!to) continue;
  try {
    const r = await fn();
    console.log(`✔ ${ch} → ${to} 발송 성공 (messageId=${r.messageId})`);
  } catch (e) {
    failed = true;
    console.error(`✘ ${ch} → ${to} 실패: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
