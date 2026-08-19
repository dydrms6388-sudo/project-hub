/**
 * 순수 신호처리 유틸 — DOM/Web Audio 의존성 없음.
 * Node 에서 그대로 실행해 검산할 수 있도록 브라우저 API 를 쓰지 않는다.
 */

/** Whisper 입력 규격: 16kHz mono */
export const TARGET_SAMPLE_RATE = 16000;

/**
 * 여러 채널을 하나로 합친다(단순 평균).
 * 스테레오 → 모노 변환 시 채널 간 위상차로 상쇄가 생길 수 있으나,
 * 음성 녹음은 두 채널이 거의 동일하므로 평균이 표준적인 처리다.
 */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const len = Math.max(...channels.map((c) => c.length));
  const out = new Float32Array(len);
  for (const ch of channels) {
    const n = ch.length;
    for (let i = 0; i < n; i++) out[i] += ch[i];
  }
  const inv = 1 / channels.length;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

/* ------------------------------------------------------------------ */
/* 리샘플러 — windowed-sinc (Blackman 창)                              */
/* ------------------------------------------------------------------ */

/** Blackman 창. r = |t| / halfWidth, 0..1 */
function blackman(r: number): number {
  const x = Math.PI * r;
  return 0.42 + 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
}

/** 필터 테이블 밀도(입력 샘플 1칸당 테이블 항목 수). 클수록 정확·메모리 증가. */
const TABLE_DENSITY = 256;

/**
 * 창 씌운 sinc 필터 테이블을 만든다. t(입력 샘플 단위) ≥ 0 구간만 저장하고
 * 대칭성을 이용해 음수 쪽은 그대로 재사용한다.
 * cutoff 는 입력 샘플레이트 기준 정규화 주파수(0.5 = 나이퀴스트).
 */
function sincTable(cutoff: number, halfWidth: number): Float32Array {
  const n = Math.ceil(halfWidth * TABLE_DENSITY) + 2;
  const tbl = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / TABLE_DENSITY;
    if (t > halfWidth) {
      tbl[i] = 0;
      continue;
    }
    const x = 2 * cutoff * t;
    const s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    tbl[i] = s * blackman(t / halfWidth);
  }
  return tbl;
}

/**
 * 샘플레이트 변환 (16kHz mono 만들기의 핵심).
 *
 * 단순히 3칸마다 하나씩 뽑는 솎아내기(decimation)를 하면 8kHz 를 넘는 성분이
 * 음성 대역 안으로 되접혀(에일리어싱) 인식률을 떨어뜨린다. 그래서 다운샘플 시
 * 출력 나이퀴스트(=outRate/2)에 맞춘 저역통과 sinc 필터를 창(Blackman)으로
 * 잘라 적용한 뒤 뽑는다. 업샘플 시에는 입력 나이퀴스트를 컷오프로 쓴다.
 *
 * 탭 계수는 실제로 쓰인 것들의 합으로 나눠 정규화하므로 DC 이득이 정확히 1이고
 * 파일 경계에서도 진폭이 튀지 않는다.
 */
export function resampleTo(
  input: Float32Array,
  inRate: number,
  outRate: number,
  opts: { zeros?: number } = {},
): Float32Array {
  if (!Number.isFinite(inRate) || !Number.isFinite(outRate) || inRate <= 0 || outRate <= 0) {
    throw new RangeError("샘플레이트는 0보다 큰 유한한 값이어야 합니다.");
  }
  if (inRate === outRate) return input;
  if (input.length === 0) return new Float32Array(0);

  const ratio = inRate / outRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);

  // 다운샘플이면 컷오프를 출력 나이퀴스트에 맞춘다(입력 기준 정규화).
  const cutoff = ratio > 1 ? 0.5 / ratio : 0.5;
  const zeros = opts.zeros ?? 8; // sinc 로브 개수 — 크면 정확, 느림
  const halfWidth = zeros * Math.max(1, ratio);
  const tbl = sincTable(cutoff, halfWidth);
  const lastIdx = tbl.length - 1;

  const N = input.length;

  for (let i = 0; i < outLen; i++) {
    const center = i * ratio; // 입력 샘플 좌표
    const lo = Math.ceil(center - halfWidth);
    const hi = Math.floor(center + halfWidth);
    let acc = 0;
    let wsum = 0;
    for (let j = lo; j <= hi; j++) {
      const d = Math.abs(j - center) * TABLE_DENSITY;
      const k = d | 0;
      if (k >= lastIdx) continue;
      const w = tbl[k] + (tbl[k + 1] - tbl[k]) * (d - k); // 테이블 선형 보간
      if (w === 0) continue;
      // 파일 밖은 무음(0)으로 본다. wsum 은 창 전체로 누적해야 DC 이득이 1 이 되고,
      // 실제로 존재하는 탭만으로 정규화하면 파일 맨 앞/뒤 진폭이 부풀어 오른다.
      wsum += w;
      if (j >= 0 && j < N) acc += input[j] * w;
    }
    out[i] = wsum !== 0 ? acc / wsum : 0;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 에너지 · 무음 탐지                                                   */
/* ------------------------------------------------------------------ */

/** 프레임 단위 RMS(에너지). frameMs 기본 20ms */
export function rmsFrames(pcm: Float32Array, sampleRate: number, frameMs = 20): Float32Array {
  const frameLen = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const count = Math.max(0, Math.floor(pcm.length / frameLen));
  const out = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    const base = f * frameLen;
    for (let i = 0; i < frameLen; i++) {
      const v = pcm[base + i];
      sum += v * v;
    }
    out[f] = Math.sqrt(sum / frameLen);
  }
  return out;
}

/** dBFS. 완전 무음(0)에서 -Infinity 가 되지 않도록 -100dB 에서 바닥을 친다. */
const toDb = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-5));

function percentile(sortedAsc: Float32Array, p: number): number {
  if (sortedAsc.length === 0) return 0;
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((sortedAsc.length - 1) * p)));
  return sortedAsc[i];
}

/**
 * 무음 판정 임계값(RMS)을 프레임 에너지 분포에서 추정한다.
 *
 * 절대 임계(예: RMS 0.01)는 녹음 레벨에 따라 전부 무음/전부 발화로 무너진다.
 * 그래서 두 기준의 작은 쪽을 쓴다.
 *   (1) 잡음 바닥(하위 10% 백분위) + 8dB — 조용한 녹음 대응
 *   (2) 발화 레벨(상위 95% 백분위) − 25dB — 시끄러운 녹음 대응
 */
export function silenceThreshold(frames: Float32Array): number {
  if (frames.length === 0) return 0;
  const sorted = Float32Array.from(frames).sort();
  const noiseDb = toDb(percentile(sorted, 0.1));
  const speechDb = toDb(percentile(sorted, 0.95));
  const thDb = Math.min(noiseDb + 8, speechDb - 25);
  return Math.pow(10, thDb / 20);
}

export type SilenceRange = { start: number; end: number };

/** 무음 구간 탐지. minSilenceSec 이상 이어진 조용한 구간만 반환한다. */
export function findSilences(
  pcm: Float32Array,
  sampleRate: number,
  opts: { frameMs?: number; minSilenceSec?: number } = {},
): SilenceRange[] {
  const frameMs = opts.frameMs ?? 20;
  const minSilenceSec = opts.minSilenceSec ?? 0.5;
  const frames = rmsFrames(pcm, sampleRate, frameMs);
  if (frames.length === 0) return [];

  const threshold = silenceThreshold(frames);
  const frameSec = frameMs / 1000;
  const minFrames = Math.max(1, Math.round(minSilenceSec / frameSec));
  const out: SilenceRange[] = [];
  let runStart = -1;

  for (let i = 0; i <= frames.length; i++) {
    const quiet = i < frames.length && frames[i] < threshold;
    if (quiet) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if (i - runStart >= minFrames) {
        out.push({ start: runStart * frameSec, end: i * frameSec });
      }
      runStart = -1;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 30초 청크 분할                                                       */
/* ------------------------------------------------------------------ */

export type AudioSegment = { start: number; end: number; startSample: number; endSample: number };

/**
 * 긴 오디오를 최대 maxSec(Whisper 수용 한계인 30초) 단위로 자른다.
 *
 * 30초에서 기계적으로 끊으면 단어 중간이 잘려 그 부분 인식이 무너진다.
 * 목표 지점 앞 searchSec 안에서 임계값 아래로 내려간 가장 조용한 프레임을 찾아
 * 거기서 자르고, 그런 지점이 없으면 목표 지점 그대로 자른다.
 */
export function planSegments(
  pcm: Float32Array,
  sampleRate: number,
  opts: { maxSec?: number; searchSec?: number; frameMs?: number } = {},
): AudioSegment[] {
  const maxSec = opts.maxSec ?? 30;
  const searchSec = opts.searchSec ?? 2.5;
  const frameMs = opts.frameMs ?? 20;
  if (pcm.length === 0) return [];

  const totalSec = pcm.length / sampleRate;
  if (totalSec <= maxSec) {
    return [{ start: 0, end: totalSec, startSample: 0, endSample: pcm.length }];
  }

  const frames = rmsFrames(pcm, sampleRate, frameMs);
  const threshold = silenceThreshold(frames);
  const frameSec = frameMs / 1000;
  const minSamples = Math.round(Math.min(5, maxSec) * sampleRate);

  const segments: AudioSegment[] = [];
  let cursor = 0;

  while (cursor < pcm.length) {
    const remain = pcm.length - cursor;
    if (remain <= maxSec * sampleRate) {
      segments.push({
        start: cursor / sampleRate,
        end: pcm.length / sampleRate,
        startSample: cursor,
        endSample: pcm.length,
      });
      break;
    }

    const targetSample = cursor + Math.round(maxSec * sampleRate);
    const hiFrame = Math.min(frames.length - 1, Math.floor(targetSample / sampleRate / frameSec));
    const loFrame = Math.max(0, Math.floor((targetSample / sampleRate - searchSec) / frameSec));

    let bestFrame = -1;
    let bestVal = Number.POSITIVE_INFINITY;
    for (let f = loFrame; f <= hiFrame; f++) {
      if (frames[f] < threshold && frames[f] < bestVal) {
        bestVal = frames[f];
        bestFrame = f;
      }
    }

    let cut = bestFrame >= 0 ? Math.round(bestFrame * frameSec * sampleRate) : targetSample;
    if (cut - cursor < minSamples || cut > pcm.length) cut = Math.min(targetSample, pcm.length);

    segments.push({
      start: cursor / sampleRate,
      end: cut / sampleRate,
      startSample: cursor,
      endSample: cut,
    });
    cursor = cut;
  }
  return segments;
}

/** 최대 절대 진폭이 target(기본 0.95)이 되도록 스케일. 무음이면 그대로 둔다. */
export function normalizePeak(pcm: Float32Array, target = 0.95): Float32Array {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  if (peak < 1e-4 || peak >= target) return pcm;
  const g = target / peak;
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] * g;
  return out;
}
