// 알림 작업 1건을 사용자 채널들로 발송. 채널별 발송 완료 키로 멱등 처리 →
// 한 채널만 실패해 재시도돼도 성공한 채널로 중복 발송하지 않는다.
import { K } from "../redis.js";
import { audit, maskContact } from "../audit.js";
import { getUser } from "../settings.js";
import { formatAlert, sendTelegram, sendEmail } from "./channels.js";

const SENT_TTL = 7 * 86400;

export async function deliverJob(redis, job, { channels } = {}) {
  const user = await getUser(redis, job.user);
  if (!user) {
    await audit(redis, "alert.dropped", { jobKey: job.jobKey, user: job.user, reason: "user_not_found" });
    return { done: true, results: {} };
  }
  const want = channels || Object.entries(user.channels).filter(([, on]) => on).map(([ch]) => ch);
  const msg = formatAlert(job);
  const results = {};
  let retry = false;

  for (const ch of want) {
    const sentKey = K.delivered(job.jobKey, ch);
    if (!job.test && (await redis.exists(sentKey))) { results[ch] = { ok: true, skipped: "already_sent" }; continue; }
    const to = ch === "telegram" ? user.telegramChatId : user.email;
    try {
      const r = ch === "telegram" ? await sendTelegram(to, msg.text) : await sendEmail(to, msg.title, msg.text);
      if (!job.test) await redis.set(sentKey, "1", "EX", SENT_TTL);
      results[ch] = { ok: true, ...r };
      await audit(redis, job.test ? "alert.test_sent" : "alert.sent", {
        jobKey: job.jobKey, user: job.user, coin: job.coin, channel: ch, to: maskContact(to), messageId: r.messageId,
      });
    } catch (e) {
      results[ch] = { ok: false, error: e.message, retryable: !!e.retryable };
      if (e.retryable) retry = true;
      await audit(redis, job.test ? "alert.test_failed" : "alert.failed", {
        jobKey: job.jobKey, user: job.user, coin: job.coin, channel: ch, to: maskContact(to), error: e.message, retryable: !!e.retryable,
      });
    }
  }
  return { done: !retry, results };
}
