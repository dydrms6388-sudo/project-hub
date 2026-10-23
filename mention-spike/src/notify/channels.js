// 알림 채널: Telegram Bot API + SMTP 이메일. 둘 다 실제 발송한다 (자격증명은 env).
import nodemailer from "nodemailer";
import { config } from "../config.js";

export class ChannelError extends Error {
  constructor(msg, { retryable = true, retryAfterSec } = {}) {
    super(msg);
    this.retryable = retryable;
    this.retryAfterSec = retryAfterSec;
  }
}

const KIND_LABEL = { SPIKE: "언급 급상승", NEW_SURGE: "신규 급증 (직전 구간 0건)" };

export function formatAlert(job) {
  const title = job.test ? "[테스트] 언급 급상승 알림 발송 확인" : `[${job.coin}] ${KIND_LABEL[job.kind] || job.kind}`;
  const growth = job.kind === "NEW_SURGE" ? "기준 구간 0건 → 신규 급증" : `증가율 +${job.growthPct}%`;
  const lines = job.test
    ? ["이 메시지가 보이면 이 채널로 실제 알림이 도착합니다.", `사용자: ${job.user}`]
    : [
        `최근 ${job.windowSec}초 언급 ${job.cur}건 (직전 ${job.windowSec}초 ${job.base}건)`,
        growth,
        `고유 작성자 ${job.curAuthors}명`,
        job.reason === "realert" ? `재알림 #${job.seq} — 마지막 알림 이후 언급량 추가 급증` : "",
        `탐지 시각 ${new Date(job.at).toISOString()}`,
      ].filter(Boolean);
  const footer = "※ 공개 게시물 언급량 통계이며 투자 조언이 아닙니다. 수집 주기는 소스별 API 제약을 따릅니다.";
  return { title, text: [title, "", ...lines, "", footer].join("\n") };
}

export async function sendTelegram(chatId, text, { fetchImpl = fetch } = {}) {
  const { botToken, apiBase } = config.telegram;
  if (!botToken) throw new ChannelError("TELEGRAM_BOT_TOKEN 미설정", { retryable: false });
  if (!chatId) throw new ChannelError("사용자 telegramChatId 미설정", { retryable: false });
  let res;
  try {
    res = await fetchImpl(`${apiBase}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new ChannelError(`telegram 네트워크 오류: ${e.message}`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.ok) return { messageId: body.result?.message_id };
  const retryAfterSec = body.parameters?.retry_after;
  // 4xx(429 제외)는 chat id/토큰 문제 → 재시도해도 실패
  const retryable = res.status === 429 || res.status >= 500;
  throw new ChannelError(`telegram ${res.status}: ${body.description || "error"}`, { retryable, retryAfterSec });
}

let transport;
function getTransport() {
  if (!config.smtp.url) throw new ChannelError("SMTP_URL 미설정", { retryable: false });
  transport ||= nodemailer.createTransport(config.smtp.url);
  return transport;
}
export function resetTransport() { transport = undefined; }

export async function sendEmail(to, subject, text) {
  if (!to) throw new ChannelError("사용자 email 미설정", { retryable: false });
  if (!config.smtp.from) throw new ChannelError("SMTP_FROM 미설정", { retryable: false });
  try {
    const info = await getTransport().sendMail({ from: config.smtp.from, to, subject, text });
    if (info.rejected?.length) throw new ChannelError(`email 거부: ${info.rejected.join(",")}`, { retryable: false });
    return { messageId: info.messageId };
  } catch (e) {
    if (e instanceof ChannelError) throw e;
    const code = Number(e.responseCode);
    throw new ChannelError(`email 오류: ${e.message}`, { retryable: !(code >= 500 && code < 600) });
  }
}
