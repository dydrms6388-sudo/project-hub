import type { Builder, SoundHandle } from "./types";
import { builders } from "./builders";

/** AudioWorklet 프로세서가 필요한 slug */
const WORKLET_SLUGS = new Set(["karplus-strong", "digital-artifacts"]);

/**
 * 마스터 체인: 빌더 → bus(0.5) → 리미터(컴프레서) → master(0.85) → analyser → 출력
 * 어떤 파라미터 조합에서도 최종 출력이 기준 레벨을 넘지 않도록 리미터가 상한을 잡는다.
 */
export class SoundEngine {
  private ac: AudioContext | null = null;
  private bus: GainNode | null = null;
  private handle: SoundHandle | null = null;
  analyser: AnalyserNode | null = null;
  private workletReady = false;
  private timeData: Uint8Array | null = null;
  private freqData: Uint8Array | null = null;

  get running(): boolean {
    return this.handle !== null;
  }

  async start(slug: string, params: Record<string, number>): Promise<void> {
    const builder: Builder | undefined = builders[slug];
    if (!builder) throw new Error(`빌더 없음: ${slug}`);
    await this.ensureContext(slug);
    const ac = this.ac!;
    if (ac.state === "suspended") await ac.resume();
    this.stopSound();
    this.handle = builder({ ac, out: this.bus! }, params);
  }

  update(params: Record<string, number>): void {
    this.handle?.update(params);
  }

  /** 소리만 정지 (컨텍스트 유지 — 재시작 빠름) */
  stopSound(): void {
    if (this.handle) {
      try {
        this.handle.stop();
      } catch {
        /* 노드가 이미 정리된 경우 무시 */
      }
      this.handle = null;
    }
  }

  /** 페이지 이탈 시 완전 정리 — 소리 잔류 금지 */
  async dispose(): Promise<void> {
    this.stopSound();
    if (this.ac) {
      const ac = this.ac;
      this.ac = null;
      this.bus = null;
      this.analyser = null;
      this.workletReady = false;
      try {
        await ac.close();
      } catch {
        /* 이미 닫힘 */
      }
    }
  }

  /** 시각화용: [-1,1] 시간 파형 */
  getWaveform(): Uint8Array | null {
    if (!this.analyser) return null;
    if (!this.timeData || this.timeData.length !== this.analyser.fftSize)
      this.timeData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>);
    return this.timeData;
  }

  getSpectrum(): Uint8Array | null {
    if (!this.analyser) return null;
    if (!this.freqData || this.freqData.length !== this.analyser.frequencyBinCount)
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);
    return this.freqData;
  }

  /** 현재 출력 피크(0..1) — 레벨 실측용 */
  getPeak(): number {
    const w = this.getWaveform();
    if (!w) return 0;
    let peak = 0;
    for (let i = 0; i < w.length; i++) {
      const v = Math.abs(w[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }

  get sampleRate(): number {
    return this.ac?.sampleRate ?? 48000;
  }

  private async ensureContext(slug: string): Promise<void> {
    if (!this.ac) {
      const ac = new AudioContext();
      const bus = ac.createGain();
      bus.gain.value = 0.5;
      const limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.1;
      const master = ac.createGain();
      master.gain.value = 0.85;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      bus.connect(limiter).connect(master).connect(analyser).connect(ac.destination);
      this.ac = ac;
      this.bus = bus;
      this.analyser = analyser;
    }
    if (WORKLET_SLUGS.has(slug) && !this.workletReady) {
      await this.ac.audioWorklet.addModule("/worklets/sound-worklets.js");
      this.workletReady = true;
    }
  }
}
