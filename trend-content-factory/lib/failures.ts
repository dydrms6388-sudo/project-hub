// 실패 기록 — 절대 조용히 넘어가지 않는다 (HARD CONSTRAINT #6).
// Supabase 있으면 job_failures 적재 + 텔레그램. 없으면(dry-run) 로그 + 텔레그램 폴백.

import { hasSupabase } from './env.js';
import { supabase } from './supabase.js';
import { notify } from './telegram.js';
import { makeLogger } from './logger.js';

const log = makeLogger('failures');

export type WorkerName = 'ingest' | 'compose' | 'review' | 'render' | 'publish' | 'insights';

export async function recordFailure(
  worker: WorkerName,
  error: unknown,
  opts: { vertical?: string; context?: Record<string, unknown> } = {},
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const line = `[${worker}]${opts.vertical ? ` (${opts.vertical})` : ''} ${msg}`;
  log.error(line, opts.context ?? {});

  if (hasSupabase()) {
    try {
      await supabase().from('job_failures').insert({
        worker,
        vertical: opts.vertical ?? null,
        context: opts.context ?? {},
        error: msg,
        notified: true,
      });
    } catch (e) {
      log.error(`job_failures 적재 실패: ${String(e)}`);
    }
  }
  await notify(`❌ ${line}`);
}
