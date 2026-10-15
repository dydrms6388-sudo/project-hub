// 플랫폼별 렌더/게시 스펙. 대상 플랫폼: TikTok, Facebook, Instagram, Threads, X.
// 렌더러는 여기 dims 로 카드/릴 변형을 생성하고, 게시(Phase 3)는 caption/hashtag 한도를 적용.

import type { Format, Platform } from '../lib/types.js';

export type PlatformSpec = {
  id: Platform;
  label: string;
  /** 이 플랫폼이 실제로 지원하는 포맷 */
  supports: Format[];
  /** 피드 카드(정지 이미지) 크기 */
  card: { w: number; h: number };
  /** 릴/숏폼 비디오 크기 + 권장 최대 길이(초) */
  reel: { w: number; h: number; maxSec: number };
  captionLimit: number;
  hashtagLimit: number;
  /** 캡션 톤 재작성 지시(같은 소재를 플랫폼별로 다르게) */
  captionStyle: string;
};

export const PLATFORMS: Record<Platform, PlatformSpec> = {
  ig: {
    id: 'ig',
    label: 'Instagram',
    supports: ['card', 'reel'],
    card: { w: 1080, h: 1350 },
    reel: { w: 1080, h: 1920, maxSec: 90 },
    captionLimit: 2200,
    hashtagLimit: 30,
    captionStyle: '감성적이고 저장 유도. 해시태그 풀 사용.',
  },
  fb: {
    id: 'fb',
    label: 'Facebook',
    supports: ['card', 'reel'],
    card: { w: 1080, h: 1350 },
    reel: { w: 1080, h: 1920, maxSec: 90 },
    captionLimit: 2000,
    hashtagLimit: 10,
    captionStyle: '설명형·링크 친화. 해시태그 절제.',
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    supports: ['reel', 'card'], // card = 포토모드(세로)
    card: { w: 1080, h: 1920 },
    reel: { w: 1080, h: 1920, maxSec: 180 },
    captionLimit: 2200,
    hashtagLimit: 8,
    captionStyle: '구어체·트렌디. 첫 3초 후킹 강조. 니치 해시태그.',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    supports: ['card', 'reel'],
    card: { w: 1080, h: 1350 },
    reel: { w: 1080, h: 1920, maxSec: 90 },
    captionLimit: 500,
    hashtagLimit: 1, // Threads 는 태그 1개 관례
    captionStyle: '대화체·짧게. 태그 최소.',
  },
  x: {
    id: 'x',
    label: 'X',
    supports: ['card', 'reel'],
    card: { w: 1600, h: 900 }, // 가로형 이미지
    reel: { w: 1080, h: 1920, maxSec: 140 }, // 세로 영상 재사용(X 는 세로 영상 허용)
    captionLimit: 280,
    hashtagLimit: 3,
    captionStyle: '핵심만·280자. 해시태그 2~3개.',
  },
};

/** 사용자가 지정한 기본 대상 플랫폼 집합 (TikTok/FB/IG/Threads/X). */
export const DEFAULT_TARGET_PLATFORMS: Platform[] = ['tiktok', 'fb', 'ig', 'threads', 'x'];

/** 포맷을 지원하는 대상 플랫폼만 필터. card 는 정지이미지, reel 은 비디오. */
export function platformsForFormat(format: Format, targets = DEFAULT_TARGET_PLATFORMS): PlatformSpec[] {
  const wanted: Format = format === 'mixed' ? 'card' : format;
  return targets.map((p) => PLATFORMS[p]).filter((s) => s.supports.includes(wanted));
}
