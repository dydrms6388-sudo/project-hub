// 릴 렌더: 애니메이션 HTML → Playwright 녹화(webm) → ffmpeg MP4(H.264/AAC).
// TTS 나레이션 있으면 mux, 없으면 무음 AAC.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Browser } from 'playwright';
import type { PlatformSpec } from '../../config/platforms.js';
import type { ReelBeat, Vertical } from '../../lib/types.js';
import { buildReelHtml } from '../../lib/render/reelTemplate.js';
import { encodeReel } from '../../lib/media/ffmpeg.js';
import { makeTts, type TtsProvider } from '../../lib/media/tts.js';
import { makeLogger } from '../../lib/logger.js';

const log = makeLogger('reel');
const FPS = 30;

export type ReelRenderResult = {
  file: string;
  ms: number;
  width: number;
  height: number;
  durationMs: number;
  codec: 'h264' | 'vp8';
  hasAudio: boolean;
};

/** 릴 스크립트 → 재생시간(초). 마지막 비트 + 꼬리, [8, min(maxSec,30)] 로 클램프. */
export function reelDuration(beats: ReelBeat[], spec: PlatformSpec): number {
  const last = beats.length ? Math.max(...beats.map((b) => b.t)) : 0;
  const raw = last + 5;
  return Math.max(8, Math.min(Math.min(spec.reel.maxSec, 30), raw));
}

export async function renderReel(
  browser: Browser,
  opts: {
    vertical: Vertical;
    spec: PlatformSpec;
    beats: ReelBeat[];
    hook: string;
    seed: number;
    outPath: string; // .mp4
    workDir: string;
    tts?: TtsProvider;
  },
): Promise<ReelRenderResult> {
  const { vertical, spec, beats, hook, seed, outPath, workDir } = opts;
  const tts = opts.tts ?? makeTts();
  const { w, h } = spec.reel;
  const durationSec = reelDuration(beats, spec);
  const html = buildReelHtml({ vertical, spec, beats, hook, seed, durationSec });
  const t0 = Date.now();

  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  // 1) 애니메이션 녹화 → webm
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    recordVideo: { dir: workDir, size: { width: w, height: h } },
  });
  const page = await context.newPage();
  let webmPath: string;
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
    await page.waitForTimeout(durationSec * 1000 + 300);
    const video = page.video();
    if (!video) throw new Error('recordVideo 미동작 — video 핸들 없음');
    await context.close(); // close 후 파일 flush
    webmPath = await video.path();
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }

  // 2) TTS 나레이션 (있으면)
  let audioPath: string | null = null;
  const narration = beats.map((b) => b.narration).filter(Boolean).join(' ');
  if (narration) {
    audioPath = await tts.synth(narration, path.join(workDir, `narration-${seed}.mp3`));
  }

  // 3) ffmpeg 인코딩 → MP4(H.264/AAC) 또는 webm 폴백
  const enc = await encodeReel({ videoPath: webmPath, audioPath, outPath, fps: FPS, durationSec });
  await fs.rm(webmPath, { force: true }).catch(() => {});

  log.debug(`릴 렌더 완료 ${vertical.slug} ${enc.codec} ${durationSec}s`);
  return {
    file: enc.path,
    ms: Date.now() - t0,
    width: w,
    height: h,
    durationMs: Math.round(durationSec * 1000),
    codec: enc.codec,
    hasAudio: enc.hasAudio,
  };
}
