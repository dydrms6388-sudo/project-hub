// 실패 알림 채널. 토큰 없으면 콘솔로 폴백(조용히 삼키지 않는다 — HARD CONSTRAINT #6).

import { env } from './env.js';
import { makeLogger } from './logger.js';

const log = makeLogger('telegram');

export async function notify(text: string): Promise<void> {
  if (!env.telegramBotToken || !env.telegramChatId) {
    log.warn(`[telegram 미설정] ${text}`);
    return;
  }
  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.telegramChatId, text, disable_web_page_preview: true }),
      signal: controller.signal,
    });
    if (!res.ok) log.error(`텔레그램 응답 ${res.status}`);
  } catch (err) {
    log.error(`텔레그램 전송 실패: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}
