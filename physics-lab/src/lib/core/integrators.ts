/**
 * 고정 타임스텝 적분기 모음. 오일러법은 제공하지 않는다.
 * 상태는 숫자 배열, 도함수는 상태→도함수 배열 함수로 표현한다.
 */
export type State = number[];
export type Deriv = (s: State, t: number) => State;

/** 4차 룽게-쿠타 — 일반 1계 ODE 계에 사용 (감쇠·강제계 등 비보존 포함) */
export function rk4(s: State, t: number, dt: number, f: Deriv): State {
  const n = s.length;
  const k1 = f(s, t);
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = s[i] + (dt / 2) * k1[i];
  const k2 = f(a, t + dt / 2);
  for (let i = 0; i < n; i++) a[i] = s[i] + (dt / 2) * k2[i];
  const k3 = f(a, t + dt / 2);
  for (let i = 0; i < n; i++) a[i] = s[i] + dt * k3[i];
  const k4 = f(a, t + dt);
  const out = new Array(n);
  for (let i = 0; i < n; i++)
    out[i] = s[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return out;
}

/**
 * 속도 벨레(velocity Verlet) — 위치 q, 속도 v, 가속도 a(q,t)로 정의된 계.
 * 심플렉틱 계열이라 보존계의 에너지 드리프트가 작다.
 */
export function velocityVerlet(
  q: State,
  v: State,
  t: number,
  dt: number,
  accel: (q: State, v: State, t: number) => State
): { q: State; v: State } {
  const n = q.length;
  const a0 = accel(q, v, t);
  const qn = new Array(n);
  for (let i = 0; i < n; i++) qn[i] = q[i] + v[i] * dt + 0.5 * a0[i] * dt * dt;
  // 속도 의존 힘(예: 감쇠)이 있으면 반복 보정
  let vn = v.slice();
  for (let it = 0; it < 2; it++) {
    const a1 = accel(qn, vn, t + dt);
    for (let i = 0; i < n; i++) vn[i] = v[i] + 0.5 * (a0[i] + a1[i]) * dt;
  }
  return { q: qn, v: vn };
}

/**
 * 심플렉틱 오일러(반음적) — 분리형 해밀토니안 H=T(p)+V(q)에 적합.
 * 위상공간 부피를 보존해 장시간 궤도가 안정적이다.
 */
export function symplecticEuler(
  q: State,
  p: State,
  dt: number,
  dHdq: (q: State) => State, // = -dp/dt (힘의 음수)
  dHdp: (p: State) => State // = dq/dt
): { q: State; p: State } {
  const n = q.length;
  const pn = new Array(n);
  const force = dHdq(q);
  for (let i = 0; i < n; i++) pn[i] = p[i] - dt * force[i];
  const qdot = dHdp(pn);
  const qn = new Array(n);
  for (let i = 0; i < n; i++) qn[i] = q[i] + dt * qdot[i];
  return { q: qn, p: pn };
}

/** 발산 감지: 상태에 NaN/Inf 또는 임계값 초과가 있으면 true */
export function diverged(s: State, limit = 1e6): boolean {
  for (const x of s) if (!Number.isFinite(x) || Math.abs(x) > limit) return true;
  return false;
}

/** 상대 에너지 드리프트(%) = |E − E₀| / |E₀| × 100 */
export function energyDrift(E: number, E0: number): number {
  if (!Number.isFinite(E) || Math.abs(E0) < 1e-12) return 0;
  return (Math.abs(E - E0) / Math.abs(E0)) * 100;
}
