export interface Preset {
  name: string;
  params: Record<string, number>;
}

/** 항목별 프리셋 3개 (안정/전이/극단 성격) */
export const presets: Record<string, Preset[]> = {
  "simple-pendulum": [
    { name: "소각 진동", params: { theta0: 15, damping: 0, count: 1 } },
    { name: "대각 비선형", params: { theta0: 160, damping: 0, count: 1 } },
    { name: "진자 파도", params: { theta0: 40, count: 15, length: 1 } },
  ],
  "driven-oscillator": [
    { name: "공명", params: { omega0: 2, zeta: 0.05, driveFreq: 2, driveAmp: 1 } },
    { name: "과감쇠", params: { omega0: 2, zeta: 1, driveAmp: 0 } },
    { name: "이탈 구동", params: { omega0: 2, driveFreq: 4, zeta: 0.1 } },
  ],
  "coupled-oscillators": [
    { name: "맥놀이", params: { couplingK: 0.5, initMode: 0 } },
    { name: "대칭 모드", params: { initMode: 1, couplingK: 2 } },
    { name: "반대칭 모드", params: { initMode: 2, couplingK: 2 } },
  ],
  "elastic-pendulum": [
    { name: "2:1 공명", params: { springK: 40, restLength: 1, theta0: 30, stretch0: 0.2 } },
    { name: "격한 카오스", params: { springK: 25, theta0: 70, stretch0: 0.4 } },
    { name: "약한 흔들림", params: { theta0: 10, stretch0: 0.05, springK: 60 } },
  ],
  "parametric-pendulum": [
    { name: "그네 펌핑", params: { driveFreq: 12, driveAmp: 0.05, theta0: 20 } },
    { name: "카피차 역진자", params: { driveFreq: 70, driveAmp: 0.03, theta0: 175, length: 0.4 } },
    { name: "파라메트릭 공명", params: { driveFreq: 8, driveAmp: 0.1, theta0: 5 } },
  ],
  "foucault-pendulum": [
    { name: "파리(48.9°)", params: { latitude: 49, timeScale: 500 } },
    { name: "적도(세차 없음)", params: { latitude: 2, timeScale: 800 } },
    { name: "고위도", params: { latitude: 75, timeScale: 400 } },
  ],
  "stick-slip": [
    { name: "느린 벨트", params: { beltSpeed: 0.3, muStatic: 0.6, muKinetic: 0.3 } },
    { name: "큰 마찰차", params: { muStatic: 0.9, muKinetic: 0.2, springK: 10 } },
    { name: "매끄러운 활주", params: { muStatic: 0.4, muKinetic: 0.35, beltSpeed: 3 } },
  ],
  "fput-chain": [
    { name: "회귀 관찰", params: { particles: 64, alpha: 0.25, initMode: 1 } },
    { name: "강한 비선형", params: { alpha: 0.8, initMode: 1, amplitude: 1 } },
    { name: "선형 극한", params: { alpha: 0, initMode: 3 } },
  ],
  "double-pendulum": [
    { name: "격한 카오스", params: { theta1: 120, theta2: -10, massRatio: 1 } },
    { name: "무거운 하단", params: { massRatio: 3, theta1: 90, lengthRatio: 1 } },
    { name: "작은 진동", params: { theta1: 20, theta2: 10 } },
  ],
  "driven-damped-pendulum": [
    { name: "주기배증", params: { driveAmp: 1.07, damping: 0.5, driveFreq: 0.667 } },
    { name: "카오스", params: { driveAmp: 1.15, damping: 0.5, driveFreq: 0.667 } },
    { name: "단순 주기", params: { driveAmp: 0.9, damping: 0.5 } },
  ],
  duffing: [
    { name: "이중우물 카오스", params: { gamma: 0.3, delta: 0.2, omega: 1.2 } },
    { name: "우물 갇힘", params: { gamma: 0.1, delta: 0.3, omega: 1.2 } },
    { name: "강한 구동", params: { gamma: 0.5, delta: 0.15, omega: 1.4 } },
  ],
  "magnetic-pendulum": [
    { name: "3자석 프랙탈", params: { magnets: 3, magStrength: 2, damping: 0.2 } },
    { name: "낮은 감쇠", params: { magnets: 3, damping: 0.06, magStrength: 2.5 } },
    { name: "4자석", params: { magnets: 4, damping: 0.15 } },
  ],
  "standard-map": [
    { name: "마지막 KAM", params: { K: 0.97, orbits: 60 } },
    { name: "규칙 곡선", params: { K: 0.3, orbits: 80 } },
    { name: "전역 카오스", params: { K: 3, orbits: 100 } },
  ],
  billiards: [
    { name: "스타디움 카오스", params: { shape: 2, aspect: 1.5, launchAngle: 40 } },
    { name: "원(가적분)", params: { shape: 0, launchAngle: 30 } },
    { name: "타원 초점", params: { shape: 1, aspect: 2, launchAngle: 20 } },
  ],
  "henon-heiles": [
    { name: "카오스 바다", params: { energy: 0.16, viewMode: 1, y0: 0.1 } },
    { name: "규칙 원환면", params: { energy: 0.08, viewMode: 1, y0: 0.1 } },
    { name: "실공간 궤적", params: { energy: 0.125, viewMode: 0 } },
  ],
  "chaotic-waterwheel": [
    { name: "혼돈 반전", params: { inflow: 2, leak: 0.3, friction: 0.5 } },
    { name: "정지", params: { inflow: 0.5, friction: 1.5 } },
    { name: "정상 회전", params: { inflow: 1, friction: 0.3, leak: 0.5 } },
  ],
  "inverse-square-orbit": [
    { name: "타원 궤도", params: { v0: 0.9, r0: 1, forceSign: 0 } },
    { name: "탈출(쌍곡선)", params: { v0: 1.5, r0: 1, forceSign: 0 } },
    { name: "러더퍼드 산란", params: { forceSign: 1, v0: 1, impactParam: 0.5 } },
  ],
  "three-body": [
    { name: "피겨8", params: { preset: 0 } },
    { name: "쌍성+행성", params: { preset: 2 } },
    { name: "슬링샷", params: { preset: 3 } },
  ],
  "n-body-cluster": [
    { name: "회전 원반", params: { bodies: 300, initialSpin: 0.5, virialRatio: 1 } },
    { name: "급수축", params: { bodies: 300, initialSpin: 0.05, virialRatio: 0.3 } },
    { name: "큰 성단", params: { bodies: 600, initialSpin: 0.3 } },
  ],
  "relativistic-precession": [
    { name: "수성형 세차", params: { periRadius: 10, eccentricity: 0.4, relFactor: 1 } },
    { name: "뉴턴(닫힘)", params: { relFactor: 0, eccentricity: 0.4 } },
    { name: "강한 세차", params: { periRadius: 5, eccentricity: 0.5, relFactor: 1 } },
  ],
  "swinging-atwood": [
    { name: "가적분(μ=3)", params: { massRatio: 3, theta0: 60 } },
    { name: "카오스", params: { massRatio: 4.5, theta0: 60 } },
    { name: "무거운 추", params: { massRatio: 8, theta0: 40 } },
  ],
  "projectile-drag": [
    { name: "진공 비교", params: { v0: 30, angle: 45, dragCoef: 0 } },
    { name: "강한 항력", params: { v0: 50, angle: 40, dragCoef: 0.03 } },
    { name: "커브볼(마그누스)", params: { v0: 30, angle: 20, spin: 30 } },
  ],
  "rocket-equation": [
    { name: "단단 로켓", params: { massRatio: 8, exhaustV: 3, stages: 1 } },
    { name: "3단 로켓", params: { massRatio: 12, exhaustV: 3, stages: 3 } },
    { name: "고비추력", params: { massRatio: 8, exhaustV: 4.5 } },
  ],
  "elastic-collisions-1d": [
    { name: "π=3.1 (100:1)", params: { massRatio: 100, wall: 1 } },
    { name: "π=3.14 (10000:1)", params: { massRatio: 10000, wall: 1 } },
    { name: "비탄성", params: { restitution: 0.8, massRatio: 100 } },
  ],
  "bouncing-ball": [
    { name: "단순 감쇠", params: { restitution: 0.85, floorAmp: 0, h0: 1 } },
    { name: "진동 바닥 카오스", params: { restitution: 0.8, floorAmp: 3, floorFreq: 20 } },
    { name: "높은 반발", params: { restitution: 0.95, floorAmp: 0 } },
  ],
  "galton-board": [
    { name: "정규분포", params: { rows: 12, balls: 600 } },
    { name: "좁은 분포", params: { rows: 6, balls: 800 } },
    { name: "넓은 분포", params: { rows: 16, balls: 1200 } },
  ],
  "brachistochrone-race": [
    { name: "최속강하 경주", params: { drop: 1.5, tracks: 3, tautochrone: 0 } },
    { name: "등시성", params: { tautochrone: 1, tracks: 4, drop: 2 } },
    { name: "가파른 낙차", params: { drop: 3, tracks: 3 } },
  ],
  "rotating-frame": [
    { name: "코리올리 편향", params: { omega: 1, v0: 2, showBoth: 1 } },
    { name: "빠른 회전", params: { omega: 2.5, v0: 2, showBoth: 1 } },
    { name: "회전계만", params: { omega: 1, showBoth: 0 } },
  ],
  "spinning-top": [
    { name: "빠른 세차", params: { spinRate: 100, tilt: 30, nutationKick: 0 } },
    { name: "장동 흔들림", params: { spinRate: 40, tilt: 30, nutationKick: 1 } },
    { name: "큰 기울기", params: { spinRate: 60, tilt: 55 } },
  ],
  "wave-on-string": [
    { name: "고정단 반사", params: { endType: 0, sourceType: 0, waveSpeed: 1.5 } },
    { name: "정상파 공명", params: { sourceType: 1, endType: 0, driveFreq: 3 } },
    { name: "자유단 반사", params: { endType: 1, sourceType: 0 } },
  ],
  "ripple-tank": [
    { name: "이중 슬릿", params: { sources: 1, barrier: 2, frequency: 1.5, slitWidth: 6 } },
    { name: "두 파원 간섭", params: { sources: 2, barrier: 0, frequency: 1.5 } },
    { name: "회절", params: { sources: 1, barrier: 1, slitWidth: 3 } },
  ],
  "doppler-effect": [
    { name: "아음속 통과", params: { sourceSpeed: 0.7, path: 0 } },
    { name: "마하 원뿔", params: { sourceSpeed: 1.3, path: 0 } },
    { name: "회전 사이렌", params: { sourceSpeed: 0.5, path: 1 } },
  ],
  "diffusion-heat": [
    { name: "점 주입 병렬", params: { initCondition: 0, viewMode: 2, diffusivity: 1 } },
    { name: "온도 계단", params: { initCondition: 1, viewMode: 1, diffusivity: 1.5 } },
    { name: "랜덤워크", params: { viewMode: 0, particles: 3000 } },
  ],
  "hanging-chain": [
    { name: "현수선", params: { scenario: 0, links: 30, stiffness: 500 } },
    { name: "슬링키 낙하", params: { scenario: 1, stiffness: 200 } },
    { name: "파동 전파", params: { scenario: 2, links: 40 } },
  ],
  "gas-in-box": [
    { name: "맥스웰 분포", params: { particles: 300, temperature: 1, mode: 0 } },
    { name: "브라운 운동", params: { mode: 1, particles: 400 } },
    { name: "칸막이 혼합", params: { mode: 2, particles: 400 } },
  ],
  "point-vortices": [
    { name: "4개 카오스", params: { vortices: 4, tracers: 200 } },
    { name: "쌍극자", params: { vortices: 2, circulationRatio: -1, tracers: 300 } },
    { name: "3개 가적분", params: { vortices: 3, tracers: 200 } },
  ],
  "radioactive-decay": [
    { name: "요동 관찰", params: { atoms: 100, halfLife: 8, chain: 0 } },
    { name: "붕괴 사슬", params: { atoms: 400, halfLife: 8, chain: 1 } },
    { name: "긴 반감기", params: { atoms: 800, halfLife: 25 } },
  ],
  "charged-particle-fields": [
    { name: "사이클로트론", params: { Bz: 1, Ex: 0, chargeSign: 0 } },
    { name: "E×B 드리프트", params: { Bz: 1, Ex: 0.8, chargeSign: 0 } },
    { name: "자기 거울", params: { Bz: 1, gradientB: 0.6, chargeSign: 0 } },
  ],
  "electric-field-lines": [
    { name: "쌍극자", params: { charges: 2, chargeRatio: -1, lineDensity: 24 } },
    { name: "같은 부호", params: { charges: 2, chargeRatio: 1, lineDensity: 24 } },
    { name: "사중극자", params: { charges: 4, lineDensity: 16 } },
  ],
  "quantum-tunneling": [
    { name: "부분 투과", params: { packetEnergy: 0.8, barrierHeight: 1, barrierWidth: 0.3 } },
    { name: "얇은 장벽", params: { barrierWidth: 0.1, packetEnergy: 0.8 } },
    { name: "고에너지 통과", params: { packetEnergy: 1.5, barrierHeight: 1 } },
  ],
};
