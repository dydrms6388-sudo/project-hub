// ffmpeg 래퍼. 우선순위: @ffmpeg-installer(풀빌드, H.264/AAC) → FFMPEG_PATH →
// Playwright 번들(VP8/webm only). 능력을 실측해 코덱을 결정한다.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { makeLogger } from '../logger.js';

const log = makeLogger('ffmpeg');
const require = createRequire(import.meta.url);

export type FfmpegCaps = {
  path: string;
  /** H.264(libx264) + mp4 muxer 가능 → 스펙 준수 MP4 */
  h264: boolean;
  aac: boolean;
};

let cached: FfmpegCaps | null = null;

function resolvePath(): string {
  if (process.env['FFMPEG_PATH'] && existsSync(process.env['FFMPEG_PATH'])) {
    return process.env['FFMPEG_PATH'] as string;
  }
  try {
    const inst = require('@ffmpeg-installer/ffmpeg') as { path: string };
    if (inst?.path && existsSync(inst.path)) return inst.path;
  } catch {
    /* not installed */
  }
  // Playwright 번들 폴백 (webm 전용).
  const pw = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
  if (existsSync(pw)) return pw;
  return 'ffmpeg'; // PATH 에 있길 기대
}

function run(bin: string, args: string[], timeoutMs = 120_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg 타임아웃 ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stderr.on('data', (d) => (stderr += String(d)));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

export async function ffmpegCaps(): Promise<FfmpegCaps> {
  if (cached) return cached;
  const path = resolvePath();
  let h264 = false;
  let aac = false;
  try {
    const { stderr } = await run(path, ['-hide_banner', '-encoders'], 15_000);
    // -encoders 는 stdout 이지만 일부 빌드는 stderr 로 섞임 → 둘 다 못 받으면 별도 처리.
    const probe = stderr;
    h264 = /libx264/.test(probe);
    aac = /\baac\b/.test(probe);
  } catch (e) {
    log.warn(`ffmpeg 능력 탐지 실패: ${String(e)}`);
  }
  // stderr 로 못 받았을 수 있어 stdout 로 재시도.
  if (!h264) {
    try {
      const out = await runCapture(path, ['-hide_banner', '-encoders']);
      h264 = /libx264/.test(out);
      aac = /\baac\b/.test(out);
    } catch {
      /* ignore */
    }
  }
  cached = { path, h264, aac };
  log.info(`ffmpeg=${path} h264=${h264} aac=${aac}`);
  return cached;
}

function runCapture(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += String(d)));
    proc.on('error', reject);
    proc.on('close', () => resolve(out));
  });
}

export type EncodeReelInput = {
  /** 소스 영상(webm, Playwright 녹화) */
  videoPath: string;
  /** 나레이션 오디오(있으면 mux). 없으면 무음 AAC 트랙 생성 */
  audioPath: string | null;
  outPath: string; // .mp4 (h264 가능 시) 또는 .webm (폴백)
  fps: number;
  durationSec: number;
};

export type EncodeResult = { path: string; codec: 'h264' | 'vp8'; hasAudio: boolean };

/** webm 소스 → 스펙 MP4(H.264/yuv420p/AAC) 인코딩. 풀빌드 없으면 webm 그대로 둠. */
export async function encodeReel(input: EncodeReelInput): Promise<EncodeResult> {
  const caps = await ffmpegCaps();
  if (!caps.h264) {
    // 폴백: webm 소스를 그대로 산출물로 사용 (VP8, 오디오 없음).
    log.warn('H.264 미지원 ffmpeg → webm 폴백 (프로덕션은 풀빌드 ffmpeg 필요)');
    const webmOut = input.outPath.replace(/\.mp4$/, '.webm');
    await run(caps.path, ['-hide_banner', '-y', '-i', input.videoPath, '-c', 'copy', webmOut]);
    return { path: webmOut, codec: 'vp8', hasAudio: false };
  }

  const args = ['-hide_banner', '-y'];
  args.push('-i', input.videoPath);
  const hasAudio = Boolean(input.audioPath);
  if (input.audioPath) {
    args.push('-i', input.audioPath);
  } else {
    // 무음 스테레오 소스.
    args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  }
  args.push(
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', String(input.fps),
    '-crf', '23',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-t', String(input.durationSec),
    '-movflags', '+faststart',
    input.outPath,
  );
  const { code, stderr } = await run(caps.path, args);
  if (code !== 0) throw new Error(`ffmpeg 인코딩 실패(code ${code}): ${stderr.slice(-400)}`);
  return { path: input.outPath, codec: 'h264', hasAudio };
}
