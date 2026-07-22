// TTS 추상화 레이어 (교체 가능). 제공자: ElevenLabs(구현) / Supertone·Google(스텁).
// 키 없으면 null 반환 → 렌더러가 무음 트랙으로 폴백.
// ⚠️ 비용 비교 후 실제 제공자 선택은 소유자 결정 (DECISIONS 참고). 인터페이스만 고정.

import { promises as fs } from 'node:fs';
import { makeLogger } from '../logger.js';

const log = makeLogger('tts');

export interface TtsProvider {
  readonly name: string;
  /** 나레이션 합성 → 오디오 파일 경로. 불가 시 null. */
  synth(text: string, outPath: string, voice?: string): Promise<string | null>;
}

class ElevenLabsTts implements TtsProvider {
  readonly name = 'elevenlabs';
  constructor(private apiKey: string) {}

  async synth(text: string, outPath: string, voice = '21m00Tcm4TlvDq8ikWAM'): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn(`ElevenLabs ${res.status} → 무음 폴백`);
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(outPath, buf);
      return outPath;
    } catch (err) {
      log.warn(`ElevenLabs 실패 → 무음 폴백: ${String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 무음(=null) 제공자. 키 없을 때 기본. */
class NullTts implements TtsProvider {
  readonly name = 'silent';
  async synth(): Promise<string | null> {
    return null;
  }
}

export function makeTts(): TtsProvider {
  const key = process.env['ELEVENLABS_API_KEY'];
  if (key) {
    log.info('TTS: ElevenLabs');
    return new ElevenLabsTts(key);
  }
  // Supertone/Google 은 키 규약만 문서화하고 스텁 → 무음.
  log.warn('TTS 키 없음 → 무음 트랙(silent). 프로덕션은 ELEVENLABS_API_KEY 등 필요.');
  return new NullTts();
}
