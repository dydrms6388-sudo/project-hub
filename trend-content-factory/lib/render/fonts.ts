// 폰트 로더: 번들된 woff2 → data URI @font-face CSS. Chromium 에 한글 폰트가 없어
// 반드시 임베드해야 한다. 버티컬 typeface → 실제 폰트 매핑.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets', 'fonts');

type FontFile = { family: string; weight: number; file: string };

const FONTS: FontFile[] = [
  { family: 'Pretendard', weight: 400, file: 'Pretendard-Regular.woff2' },
  { family: 'Pretendard', weight: 700, file: 'Pretendard-Bold.woff2' },
  { family: 'Pretendard', weight: 800, file: 'Pretendard-ExtraBold.woff2' },
  { family: 'NanumMyeongjo', weight: 400, file: 'NanumMyeongjo-Regular.woff2' },
  { family: 'NanumMyeongjo', weight: 700, file: 'NanumMyeongjo-Bold.woff2' },
  { family: 'JetBrainsMono', weight: 400, file: 'JetBrainsMono-Regular.woff2' },
  { family: 'JetBrainsMono', weight: 700, file: 'JetBrainsMono-Bold.woff2' },
];

let cachedCss: string | null = null;

/** 모든 번들 폰트를 data URI @font-face 로. 한 번 읽고 캐시. */
export function fontFaceCss(): string {
  if (cachedCss) return cachedCss;
  const blocks: string[] = [];
  for (const f of FONTS) {
    const b64 = readFileSync(path.join(FONT_DIR, f.file)).toString('base64');
    blocks.push(
      `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;` +
        `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`,
    );
  }
  cachedCss = blocks.join('\n');
  return cachedCss;
}

/** 버티컬 typeface 지시자 → CSS font-family 스택 (항상 Pretendard 한글 폴백 포함). */
export function fontStackFor(typeface: string): string {
  const t = typeface.toLowerCase();
  if (t.includes('gowun') || t.includes('myeongjo') || t.includes('batang') || t.includes('serif')) {
    return `'NanumMyeongjo','Pretendard',serif`;
  }
  if (t.includes('jetbrains') || t.includes('mono')) {
    return `'JetBrainsMono','Pretendard',monospace`;
  }
  return `'Pretendard',sans-serif`;
}
