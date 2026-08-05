export interface Preset {
  name: string;
  params: Record<string, number>;
}

/** 항목별 프리셋 3개 — 클릭 시 파라미터 점프 */
export const presets: Record<string, Preset[]> = {
  lissajous: [
    { name: "3:2 매듭", params: { freqA: 3, freqB: 2, phase: 90 } },
    { name: "5:4 격자", params: { freqA: 5, freqB: 4, phase: 90 } },
    { name: "위상 0 사선", params: { freqA: 1, freqB: 1, phase: 0 } },
  ],
  "rose-curve": [
    { name: "5잎 장미", params: { n: 5, d: 1, maurerStep: 0 } },
    { name: "마우러 341°", params: { n: 6, d: 1, maurerStep: 341 % 180 } },
    { name: "무리비 근사", params: { n: 7, d: 3, maurerStep: 0 } },
  ],
  trochoid: [
    { name: "스피로 고전", params: { R: 125, r: 75, d: 110, mode: 0 } },
    { name: "별 모양", params: { R: 120, r: 24, d: 96, mode: 0 } },
    { name: "에피 꽃", params: { R: 90, r: 30, d: 60, mode: 1 } },
  ],
  harmonograph: [
    { name: "2:3 공명", params: { f1: 2, f2: 3.01, damping: 0.004, phase: 90 } },
    { name: "황금비 감김", params: { f1: 1.618, f2: 1, damping: 0.002, phase: 0 } },
    { name: "빠른 감쇠", params: { f1: 5, f2: 4.03, damping: 0.012, phase: 45 } },
  ],
  superformula: [
    { name: "불가사리", params: { m: 5, n1: 0.5, n2: 1.7, n3: 1.7 } },
    { name: "초타원", params: { m: 4, n1: 2.5, n2: 2.5, n3: 2.5 } },
    { name: "꽃잎 12", params: { m: 12, n1: 4, n2: 15, n3: 15 } },
  ],
  phyllotaxis: [
    { name: "황금각 137.5°", params: { angle: 137.51, count: 1200 } },
    { name: "137.3° 붕괴", params: { angle: 137.3, count: 1200 } },
    { name: "루카스각 99.5°", params: { angle: 99.5, count: 1500 } },
  ],
  "classic-spirals": [
    { name: "앵무조개(로그)", params: { type: 1, growth: 0.18, turns: 6, strands: 1 } },
    { name: "아르키메데스 3선", params: { type: 0, turns: 10, strands: 3 } },
    { name: "페르마 쌍가닥", params: { type: 2, turns: 14, strands: 2 } },
  ],
  "ulam-spiral": [
    { name: "고전 울람", params: { layout: 0, size: 301, start: 1 } },
    { name: "색스 나선", params: { layout: 1, size: 301, start: 1 } },
    { name: "41 대각선", params: { layout: 0, size: 201, start: 41 } },
  ],
  mandelbrot: [
    { name: "전체 보기", params: { centerX: -0.6, centerY: 0, zoom: 0, maxIter: 300, variant: 0 } },
    { name: "해마 계곡", params: { centerX: -0.745, centerY: 0.11, zoom: 7, maxIter: 600, variant: 0 } },
    { name: "버닝쉽 선체", params: { centerX: -1.75, centerY: -0.03, zoom: 4, maxIter: 400, variant: 2 } },
  ],
  julia: [
    { name: "토끼 (c=-0.123+0.745i)", params: { cRe: -0.123, cIm: 0.745, zoom: 0, maxIter: 300 } },
    { name: "번개 (c=-0.745+0.186i)", params: { cRe: -0.745, cIm: 0.186, zoom: 0, maxIter: 400 } },
    { name: "먼지 (c=0.3+0.55i)", params: { cRe: 0.3, cIm: 0.55, zoom: 0, maxIter: 300 } },
  ],
  "newton-fractal": [
    { name: "z³−1 고전", params: { degree: 3, relax: 1, maxIter: 60, zoom: 0 } },
    { name: "5차 꽃", params: { degree: 5, relax: 1, maxIter: 80, zoom: 0 } },
    { name: "과완화 소용돌이", params: { degree: 3, relax: 1.6, maxIter: 120, zoom: 0 } },
  ],
  "koch-curve": [
    { name: "표준 눈송이", params: { depth: 5, angle: 60, closed: 1 } },
    { name: "체사로 85°", params: { depth: 5, angle: 85, closed: 0 } },
    { name: "완만 30°", params: { depth: 6, angle: 30, closed: 1 } },
  ],
  "sierpinski-chaos": [
    { name: "고전 삼각형", params: { vertices: 3, ratio: 0.5, noRepeat: 0 } },
    { name: "5각 눈꽃", params: { vertices: 5, ratio: 0.38, noRepeat: 0 } },
    { name: "제한 규칙 4각", params: { vertices: 4, ratio: 0.5, noRepeat: 1 } },
  ],
  "barnsley-fern": [
    { name: "표준 고사리", params: { bend: 0, leafSpread: 85, hue: 120 } },
    { name: "바람 맞은 잎", params: { bend: 9, leafSpread: 90, hue: 95 } },
    { name: "가을 단풍", params: { bend: -4, leafSpread: 100, hue: 25 } },
  ],
  "dragon-curve": [
    { name: "14회 접기", params: { iterations: 14, angle: 90, copies: 1 } },
    { name: "4방 채움", params: { iterations: 13, angle: 90, copies: 4 } },
    { name: "느슨한 100°", params: { iterations: 13, angle: 100, copies: 1 } },
  ],
  "l-system-plant": [
    { name: "고전 잡초", params: { iterations: 5, branchAngle: 25, lengthDecay: 65, jitter: 0 } },
    { name: "버드나무", params: { iterations: 6, branchAngle: 18, lengthDecay: 72, jitter: 2 } },
    { name: "산호", params: { iterations: 5, branchAngle: 38, lengthDecay: 60, jitter: 4 } },
  ],
  "pythagoras-tree": [
    { name: "대칭 45°", params: { depth: 11, angle: 45, hueShift: 8 } },
    { name: "바람 30°", params: { depth: 12, angle: 30, hueShift: 10 } },
    { name: "브로콜리 55°", params: { depth: 10, angle: 55, hueShift: 20 } },
  ],
  "apollonian-gasket": [
    { name: "대칭 3원", params: { depth: 6, config: 0, minRadius: 1 } },
    { name: "비대칭", params: { depth: 6, config: 1, minRadius: 1 } },
    { name: "쌍둥이 원", params: { depth: 5, config: 2, minRadius: 1.5 } },
  ],
  "penrose-tiling": [
    { name: "5세대 표준", params: { subdivisions: 5, hueThin: 210, hueThick: 40 } },
    { name: "고밀도 7세대", params: { subdivisions: 7, edgeWidth: 0.3 } },
    { name: "단색 윤곽", params: { subdivisions: 6, hueThin: 220, hueThick: 220, edgeWidth: 1.2 } },
  ],
  "truchet-tiles": [
    { name: "스미스 호", params: { grid: 24, tileType: 1, seed: 42, bias: 50 } },
    { name: "대각 원조", params: { grid: 20, tileType: 0, seed: 7, bias: 50 } },
    { name: "편향 흐름", params: { grid: 32, tileType: 1, seed: 99, bias: 78 } },
  ],
  voronoi: [
    { name: "셀 채색", params: { seeds: 32, metric: 0, mode: 0, relax: 0 } },
    { name: "로이드 균질화", params: { seeds: 32, metric: 0, mode: 0, relax: 5 } },
    { name: "월리 거리장", params: { seeds: 48, metric: 0, mode: 2, relax: 0 } },
  ],
  "hilbert-curve": [
    { name: "6차 그라데이션", params: { order: 6, strokeMode: 2, thickness: 2 } },
    { name: "3차 학습용", params: { order: 3, strokeMode: 0, thickness: 5 } },
    { name: "8차 극한", params: { order: 8, strokeMode: 2, thickness: 1 } },
  ],
  "wallpaper-symmetry": [
    { name: "p4m 만화경", params: { group: 2, motifComplexity: 5, cellSize: 70, seed: 11 } },
    { name: "p2 벽돌", params: { group: 0, motifComplexity: 7, cellSize: 90, seed: 3 } },
    { name: "cm 물결", params: { group: 6, motifComplexity: 4, cellSize: 55, seed: 21 } },
  ],
  "chladni-figures": [
    { name: "(5,8) 고전", params: { n: 5, m: 8, mix: 1 } },
    { name: "대각 모드", params: { n: 7, m: 7, mix: -1 } },
    { name: "고차 (11,4)", params: { n: 11, m: 4, mix: 1 } },
  ],
  "wave-interference": [
    { name: "이중 슬릿", params: { sources: 2, wavelength: 28, arrangement: 0 } },
    { name: "원형 배열 6", params: { sources: 6, wavelength: 22, arrangement: 1 } },
    { name: "짧은 파장", params: { sources: 3, wavelength: 12, arrangement: 0 } },
  ],
  moire: [
    { name: "3° 평행선", params: { gratingType: 0, rotation: 3, spacing: 6, scaleDiff: 0 } },
    { name: "동심원 맥놀이", params: { gratingType: 1, rotation: 0.5, spacing: 8, scaleDiff: 4 } },
    { name: "방사선 회오리", params: { gratingType: 2, rotation: 2, spacing: 6 } },
  ],
  "perlin-flow": [
    { name: "바람결", params: { noiseScale: 2.5, octaves: 3, lineCount: 900, stepLength: 2.5 } },
    { name: "대리석", params: { noiseScale: 6, octaves: 4, lineCount: 1600, stepLength: 1.5 } },
    { name: "굵은 해류", params: { noiseScale: 1, octaves: 2, lineCount: 400, stepLength: 4 } },
  ],
  "gyroid-slice": [
    { name: "표준 단면", params: { sliceZ: 0, scale: 4, threshold: 0, bandCount: 1 } },
    { name: "등고선 지도", params: { sliceZ: 1.2, scale: 4, bandCount: 6 } },
    { name: "성긴 격자", params: { sliceZ: 3.14, scale: 2, threshold: 0.4, bandCount: 1 } },
  ],
  "lorenz-attractor": [
    { name: "고전 (σ10 ρ28)", params: { sigma: 10, rho: 28, beta: 2.667, projection: 0 } },
    { name: "주기 창 ρ=99.65", params: { rho: 60, sigma: 10, projection: 0 } },
    { name: "xy 평면", params: { sigma: 10, rho: 28, projection: 1 } },
  ],
  "sincos-attractor": [
    { name: "드 종 표준", params: { a: 1.641, b: 1.902, c: 0.316, d: 1.525, variant: 0 } },
    { name: "클리퍼드 산호", params: { a: -1.4, b: 1.6, c: 1.0, d: 0.7, variant: 1 } },
    { name: "호팔롱", params: { a: 2.0, b: 1.0, c: 0.0, d: 0, variant: 2 } },
  ],
  "gumowski-mira": [
    { name: "산호 (μ=-0.8)", params: { mu: -0.8, alpha: 0.009, startX: 12 } },
    { name: "나비 (μ=-0.19)", params: { mu: -0.19, alpha: 0.008, startX: 8 } },
    { name: "보존계 꽃", params: { mu: 0.31, alpha: 0, startX: 12 } },
  ],
  "logistic-bifurcation": [
    { name: "전체 분기도", params: { rMin: 2.8, rMax: 4.0 } },
    { name: "주기배증 확대", params: { rMin: 3.4, rMax: 3.6 } },
    { name: "3주기 창", params: { rMin: 3.82, rMax: 3.87 } },
  ],
  "langtons-ant": [
    { name: "고속도로 (RL)", params: { rule: 0, steps: 200000, ants: 1 } },
    { name: "대칭 성장 LLRR", params: { rule: 2, steps: 400000, ants: 1 } },
    { name: "개미 4마리", params: { rule: 0, steps: 150000, ants: 4 } },
  ],
  "elementary-ca": [
    { name: "규칙 30 난수", params: { rule: 30, seedMode: 0 } },
    { name: "규칙 110", params: { rule: 110, seedMode: 1, density: 30 } },
    { name: "규칙 90 시에르핀스키", params: { rule: 90, seedMode: 0 } },
  ],
  "reaction-diffusion": [
    { name: "산호 반점", params: { feed: 0.037, kill: 0.06, iterations: 6000 } },
    { name: "미로", params: { feed: 0.029, kill: 0.057, iterations: 8000 } },
    { name: "분열 세포", params: { feed: 0.026, kill: 0.051, iterations: 6000, seedPattern: 1 } },
  ],
  dla: [
    { name: "번개 가지", params: { particles: 8000, stickiness: 100, seedShape: 0 } },
    { name: "이끼 (부착 5%)", params: { particles: 12000, stickiness: 5, seedShape: 0 } },
    { name: "바닥 성장", params: { particles: 10000, stickiness: 100, seedShape: 1 } },
  ],
  sandpile: [
    { name: "20만 알 원판", params: { grains: 200000, dropMode: 0, palette: 0 } },
    { name: "두 점 간섭", params: { grains: 300000, dropMode: 1, palette: 0 } },
    { name: "선분 투하", params: { grains: 400000, dropMode: 2, palette: 2 } },
  ],
  "pascal-mod": [
    { name: "mod 2 시에르핀스키", params: { rows: 256, modulus: 2, colorMode: 0 } },
    { name: "mod 3 삼진", params: { rows: 243, modulus: 3, colorMode: 1 } },
    { name: "mod 6 합성수", params: { rows: 216, modulus: 6, colorMode: 1 } },
  ],
  "times-table-cardioid": [
    { name: "×2 카디오이드", params: { multiplier: 2, modulus: 200 } },
    { name: "×3 네프로이드", params: { multiplier: 3, modulus: 300 } },
    { name: "×51 별", params: { multiplier: 51, modulus: 250 } },
  ],
  "collatz-tree": [
    { name: "산호", params: { sequences: 600, evenAngle: 8, oddAngle: -9 } },
    { name: "부채", params: { sequences: 900, evenAngle: 3, oddAngle: -5.5, segmentLength: 5 } },
    { name: "해초", params: { sequences: 400, evenAngle: 13, oddAngle: -14, segmentLength: 7 } },
  ],
};
