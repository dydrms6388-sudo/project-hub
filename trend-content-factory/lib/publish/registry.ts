import type { Platform } from '../types.js';
import type { PlatformPublisher } from './types.js';
import { IgPublisher, FbPublisher } from './adapters/meta.js';
import { TikTokPublisher } from './adapters/tiktok.js';
import { ThreadsPublisher } from './adapters/threads.js';
import { XPublisher } from './adapters/x.js';
import { SimPublisher } from './adapters/sim.js';

export type PublisherMode = 'real' | 'sim';

const REAL: Record<Platform, () => PlatformPublisher> = {
  ig: () => new IgPublisher(),
  fb: () => new FbPublisher(),
  tiktok: () => new TikTokPublisher(),
  threads: () => new ThreadsPublisher(),
  x: () => new XPublisher(),
};

export function publisherFor(platform: Platform, mode: PublisherMode): PlatformPublisher {
  if (mode === 'sim') return new SimPublisher(platform);
  return REAL[platform]();
}
