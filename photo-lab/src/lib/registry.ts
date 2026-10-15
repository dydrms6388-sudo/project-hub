// 계산기 레지스트리 — 계산기마다 컴포넌트를 복제하지 않고,
// 공통 셸(CalcShell)이 이 설정(입력 정의 + 계산 함수 + 시각화 스펙)을 소비한다.

import { getSensor, SENSORS, Sensor } from "@/lib/data";
import * as O from "@/lib/engine/optics";
import * as S from "@/lib/engine/stops";
import {
  altitudeCurve,
  CITY_PRESETS,
  dayEvents,
  fmtHour,
  julianDay,
  sunParams,
} from "@/lib/engine/sun";

export type CalcState = Record<string, string | number>;

export type FieldDef = (
  | {
      kind: "slider";
      min: number;
      max: number;
      step: number;
      log?: boolean;
      fmt: (v: number) => string;
    }
  | { kind: "click"; list: "f" | "t" | "iso" }
  | { kind: "select"; options: Array<{ value: string; label: string }> }
  | { kind: "segment"; options: Array<{ value: string; label: string }> }
  | { kind: "number"; min: number; max: number; step: number; unit?: string }
  | { kind: "sensor" }
  | { kind: "resolution" }
  | { kind: "date" }
  | { kind: "city" }
) & {
  key: string;
  label: string;
  showIf?: (s: CalcState) => boolean;
};

export interface ResultRow {
  label: string;
  value: string;
  sub?: string;
  emph?: boolean;
  warn?: boolean;
}

export type VisualSpec =
  | {
      type: "dof";
      nearM: number;
      farM: number;
      subjectM: number;
      hyperM: number;
    }
  | {
      type: "bars";
      items: Array<{
        label: string;
        value: number;
        display: string;
        tone?: "a" | "b" | "warn";
      }>;
      unit?: string;
    }
  | { type: "sun"; pts: Array<{ hour: number; alt: number }> }
  | {
      type: "equiv";
      rows: S.EquivRow[];
      fix: "aperture" | "shutter" | "iso";
    }
  | { type: "wedge"; deg: number; label: string }
  | {
      type: "pano";
      shots: number;
      stepDeg: number;
      fovDeg: number;
      totalDeg: number;
    }
  | null;

export interface CalcOutput {
  results: ResultRow[];
  visual: VisualSpec;
  notes?: string[];
}

export interface Preset {
  name: string;
  desc: string;
  values: CalcState;
}

export interface CalcDef {
  fields: FieldDef[];
  defaults: CalcState;
  presets: Preset[];
  compute: (s: CalcState) => CalcOutput;
}

// ---------- 공용 헬퍼 ----------

const num = (s: CalcState, k: string) => Number(s[k]);
const str = (s: CalcState, k: string) => String(s[k]);

function sensorOf(s: CalcState): Sensor {
  return getSensor(str(s, "sensor"));
}

function pitchOf(s: CalcState): number {
  const sen = sensorOf(s);
  const i = Math.min(sen.commonResolutions.length - 1, Math.max(0, num(s, "res")));
  return sen.commonResolutions[i].pitchUm;
}

function resOf(s: CalcState) {
  const sen = sensorOf(s);
  const i = Math.min(sen.commonResolutions.length - 1, Math.max(0, num(s, "res")));
  return sen.commonResolutions[i];
}

/** CoC: 표준(d=1500) 또는 감상 조건 */
function cocOf(s: CalcState): number {
  const sen = sensorOf(s);
  if (str(s, "cocMode") === "view") {
    return O.cocFromViewing(sen.diagonalMm, num(s, "printDiag"), num(s, "viewDist"));
  }
  return O.cocFromD(sen.diagonalMm, 1500);
}

const lenUnit = (s: CalcState): "m" | "ft" => (str(s, "unit") === "ft" ? "ft" : "m");

const sensorField: FieldDef = { kind: "sensor", key: "sensor", label: "센서" };
const resField: FieldDef = { kind: "resolution", key: "res", label: "해상도(화소 피치 자동)" };
const unitField: FieldDef = {
  kind: "segment",
  key: "unit",
  label: "표시 단위",
  options: [
    { value: "m", label: "m" },
    { value: "ft", label: "ft" },
  ],
};

const cocFields: FieldDef[] = [
  {
    kind: "segment",
    key: "cocMode",
    label: "착란원 기준",
    options: [
      { value: "std", label: "표준 (대각선/1500)" },
      { value: "view", label: "출력·감상 조건" },
    ],
  },
  {
    kind: "slider",
    key: "printDiag",
    label: "인화(화면) 대각선",
    min: 150,
    max: 2000,
    step: 5,
    log: true,
    fmt: (v) => `${Math.round(v)} mm`,
    showIf: (s) => s.cocMode === "view",
  },
  {
    kind: "slider",
    key: "viewDist",
    label: "감상 거리",
    min: 250,
    max: 4000,
    step: 10,
    log: true,
    fmt: (v) => `${(v / 10).toFixed(0)} cm`,
    showIf: (s) => s.cocMode === "view",
  },
];

const focalField = (min = 8, max = 800, def?: number): FieldDef => ({
  kind: "slider",
  key: "f",
  label: "초점거리",
  min,
  max,
  step: 1,
  log: true,
  fmt: (v) => `${Math.round(v)} mm`,
});

const apertureField: FieldDef = { kind: "click", key: "N", label: "조리개", list: "f" };
const shutterField: FieldDef = { kind: "click", key: "t", label: "셔터속도", list: "t" };
const isoField: FieldDef = { kind: "click", key: "iso", label: "ISO", list: "iso" };

function fmtCocSub(c: number, mode: string): string {
  return mode === "view"
    ? `감상 조건 기반 CoC ${c.toFixed(4)} mm`
    : `CoC ${c.toFixed(4)} mm (대각선/1500)`;
}

// ---------- 레지스트리 ----------

export const REGISTRY: Record<string, CalcDef> = {
  "depth-of-field": {
    fields: [
      sensorField,
      focalField(8, 800),
      apertureField,
      {
        kind: "slider",
        key: "s",
        label: "피사체 거리",
        min: 0.2,
        max: 300,
        step: 0.1,
        log: true,
        fmt: (v) => (v < 1 ? `${(v * 100).toFixed(0)} cm` : `${v.toFixed(1)} m`),
      },
      ...cocFields,
      unitField,
    ],
    defaults: {
      sensor: "full-frame",
      f: 50,
      N: 8,
      s: 10,
      cocMode: "std",
      printDiag: 325,
      viewDist: 250,
      unit: "m",
    },
    presets: [
      {
        name: "실내 인물",
        desc: "85mm f/1.8, 3m — 눈에 맞추면 코와 귀가 빠지는 이유를 확인",
        values: { f: 85, N: 1.8, s: 3 },
      },
      {
        name: "풍경 팬포커스",
        desc: "24mm f/8, 5m — 과초점 초과로 원점이 무한대가 되는 상황",
        values: { f: 24, N: 8, s: 5 },
      },
      {
        name: "테이블 위 제품",
        desc: "50mm f/2.8, 0.6m — 근접에서 심도가 cm 단위로 줄어드는 상황",
        values: { f: 50, N: 2.8, s: 0.6 },
      },
    ],
    compute: (s) => {
      const c = cocOf(s);
      const u = lenUnit(s);
      const r = O.dof(num(s, "f"), num(s, "N"), c, num(s, "s") * 1000);
      const rows: ResultRow[] = [
        {
          label: "근점",
          value: O.fmtLen(r.nearMm, u),
          emph: true,
        },
        {
          label: "원점",
          value: O.fmtLen(r.farMm, u),
          emph: true,
          warn: r.beyondHyperfocal,
          sub: r.beyondHyperfocal
            ? "피사체가 과초점거리보다 멀어 원점이 무한대입니다"
            : undefined,
        },
        {
          label: "심도 총량",
          value: O.fmtLen(r.totalMm, u),
        },
        {
          label: "과초점거리",
          value: O.fmtLen(r.hyperfocalMm, u),
          sub: fmtCocSub(c, str(s, "cocMode")),
        },
      ];
      return {
        results: rows,
        visual: {
          type: "dof",
          nearM: r.nearMm / 1000,
          farM: r.farMm === Infinity ? Infinity : r.farMm / 1000,
          subjectM: num(s, "s"),
          hyperM: r.hyperfocalMm / 1000,
        },
      };
    },
  },

  hyperfocal: {
    fields: [sensorField, focalField(8, 400), apertureField, ...cocFields, unitField],
    defaults: {
      sensor: "full-frame",
      f: 24,
      N: 8,
      cocMode: "std",
      printDiag: 325,
      viewDist: 250,
      unit: "m",
    },
    presets: [
      {
        name: "야경 팬포커스",
        desc: "16mm f/2.8 — 어두워 조리개를 못 조일 때의 과초점",
        values: { f: 16, N: 2.8 },
      },
      {
        name: "주간 풍경",
        desc: "24mm f/8 — 가장 흔한 팬포커스 조합",
        values: { f: 24, N: 8 },
      },
      {
        name: "표준렌즈 스냅",
        desc: "50mm f/8 — 존포커싱 거리 확인",
        values: { f: 50, N: 8 },
      },
    ],
    compute: (s) => {
      const c = cocOf(s);
      const u = lenUnit(s);
      const H = O.hyperfocalMm(num(s, "f"), num(s, "N"), c);
      return {
        results: [
          { label: "과초점거리 H", value: O.fmtLen(H, u), emph: true, sub: fmtCocSub(c, str(s, "cocMode")) },
          { label: "H에 맞추면", value: `${O.fmtLen(H / 2, u)} ~ ∞`, sub: "허용 선명 범위 (H/2부터 무한대)" },
        ],
        visual: {
          type: "dof",
          nearM: H / 2000,
          farM: Infinity,
          subjectM: H / 1000,
          hyperM: H / 1000,
        },
      };
    },
  },

  "circle-of-confusion": {
    fields: [
      sensorField,
      {
        kind: "segment",
        key: "cocMode",
        label: "기준",
        options: [
          { value: "std", label: "d 분할 (관례)" },
          { value: "view", label: "출력·감상 조건" },
        ],
      },
      {
        kind: "slider",
        key: "d",
        label: "분할값 d",
        min: 1000,
        max: 2000,
        step: 10,
        fmt: (v) => `${Math.round(v)}`,
        showIf: (s) => s.cocMode === "std",
      },
      {
        kind: "slider",
        key: "printDiag",
        label: "인화(화면) 대각선",
        min: 150,
        max: 2000,
        step: 5,
        log: true,
        fmt: (v) => `${Math.round(v)} mm`,
        showIf: (s) => s.cocMode === "view",
      },
      {
        kind: "slider",
        key: "viewDist",
        label: "감상 거리",
        min: 250,
        max: 4000,
        step: 10,
        log: true,
        fmt: (v) => `${(v / 10).toFixed(0)} cm`,
        showIf: (s) => s.cocMode === "view",
      },
    ],
    defaults: {
      sensor: "full-frame",
      cocMode: "view",
      d: 1500,
      printDiag: 325,
      viewDist: 250,
    },
    presets: [
      {
        name: "8×10 인화 근접 감상",
        desc: "203×254mm 인화를 25cm에서 — 통용값 0.030의 출발점",
        values: { cocMode: "view", printDiag: 325, viewDist: 250 },
      },
      {
        name: "A2 전시",
        desc: "A2를 50cm에서 — 확대율이 커져 CoC가 오히려 엄격해짐",
        values: { cocMode: "view", printDiag: 727, viewDist: 500 },
      },
      {
        name: "Zeiss 관례",
        desc: "d=1730 — 더 엄격한 기준을 쓰는 제조사 관례",
        values: { cocMode: "std", d: 1730 },
      },
    ],
    compute: (s) => {
      const sen = sensorOf(s);
      const c =
        str(s, "cocMode") === "std"
          ? O.cocFromD(sen.diagonalMm, num(s, "d"))
          : O.cocFromViewing(sen.diagonalMm, num(s, "printDiag"), num(s, "viewDist"));
      const enlarge = num(s, "printDiag") / sen.diagonalMm;
      const items = SENSORS.filter((x) =>
        ["full-frame", "aps-c", "mft", "one-inch"].includes(x.id)
      ).map((x) => {
        const cx =
          str(s, "cocMode") === "std"
            ? O.cocFromD(x.diagonalMm, num(s, "d"))
            : O.cocFromViewing(x.diagonalMm, num(s, "printDiag"), num(s, "viewDist"));
        return {
          label: x.name.replace(/ \(.*\)/, ""),
          value: cx,
          display: `${cx.toFixed(4)} mm`,
          tone: x.id === str(s, "sensor") ? ("b" as const) : ("a" as const),
        };
      });
      return {
        results: [
          { label: "허용 착란원", value: `${c.toFixed(4)} mm`, emph: true },
          str(s, "cocMode") === "view"
            ? { label: "확대율", value: `${enlarge.toFixed(1)}×`, sub: "인화 대각선 ÷ 센서 대각선" }
            : { label: "적용식", value: `대각선 ÷ ${Math.round(num(s, "d"))}` },
        ],
        visual: { type: "bars", items, unit: "mm" },
        notes: [
          "여기서 구한 CoC를 심도·과초점거리 계산기의 '출력·감상 조건' 모드가 그대로 사용합니다.",
        ],
      };
    },
  },

  "npf-rule": {
    fields: [
      sensorField,
      resField,
      focalField(8, 200),
      apertureField,
      {
        kind: "slider",
        key: "decl",
        label: "적위 (촬영 영역)",
        min: 0,
        max: 80,
        step: 1,
        fmt: (v) => `${Math.round(v)}°`,
      },
    ],
    defaults: { sensor: "full-frame", res: 0, f: 20, N: 2.8, decl: 0 },
    presets: [
      {
        name: "은하수 중심부",
        desc: "20mm f/2.8, 적위 약 -29°(궁수자리) → 절댓값 29° 입력",
        values: { f: 20, N: 2.8, decl: 29 },
      },
      {
        name: "고화소 광각",
        desc: "61MP 바디 14mm f/1.8 — 500법칙과의 격차가 최대가 되는 조합",
        values: { sensor: "full-frame", res: 3, f: 14, N: 1.8, decl: 0 },
      },
      {
        name: "북두칠성 방향",
        desc: "35mm, 적위 약 55° — 북쪽 하늘은 더 오래 열 수 있다",
        values: { f: 35, N: 2.0, decl: 55 },
      },
    ],
    compute: (s) => {
      const sen = sensorOf(s);
      const p = pitchOf(s);
      const f = num(s, "f");
      const npf = O.npfSeconds(num(s, "N"), p, f, num(s, "decl"));
      const r500 = O.rule500Seconds(f * sen.cropFactor);
      const trailAtNpf = O.starTrailUm(f, npf, num(s, "decl")) / p;
      const trailAt500 = O.starTrailUm(f, r500, num(s, "decl")) / p;
      return {
        results: [
          { label: "NPF 권장 셔터", value: `${npf.toFixed(1)}초`, emph: true, sub: `화소 피치 ${p.toFixed(2)}μm (${resOf(s).label}) 자동 산출` },
          { label: "500법칙", value: `${r500.toFixed(1)}초`, warn: r500 > npf * 1.3, sub: r500 > npf * 1.3 ? "이 바디에서는 500법칙이 과대 — 별이 흐릅니다" : undefined },
          { label: "NPF 시 궤적", value: `약 ${trailAtNpf.toFixed(1)}px` },
          { label: "500법칙 시 궤적", value: `약 ${trailAt500.toFixed(1)}px` },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "NPF", value: npf, display: `${npf.toFixed(1)}초`, tone: "a" },
            { label: "500법칙", value: r500, display: `${r500.toFixed(1)}초`, tone: r500 > npf * 1.3 ? "warn" : "b" },
          ],
          unit: "초",
        },
        notes: [
          "500법칙은 화소 피치를 무시하는 필름 시대 경험칙이라 고화소 바디에서 틀립니다. 두 값의 차이가 그 오차입니다.",
        ],
      };
    },
  },

  "star-trail-length": {
    fields: [
      sensorField,
      resField,
      focalField(8, 800),
      {
        kind: "slider",
        key: "t",
        label: "노출 시간",
        min: 0.5,
        max: 3600,
        step: 0.5,
        log: true,
        fmt: (v) => (v >= 60 ? `${(v / 60).toFixed(1)}분` : `${v.toFixed(1)}초`),
      },
      {
        kind: "slider",
        key: "decl",
        label: "적위",
        min: 0,
        max: 89,
        step: 1,
        fmt: (v) => `${Math.round(v)}°`,
      },
    ],
    defaults: { sensor: "full-frame", res: 0, f: 50, t: 30, decl: 0 },
    presets: [
      {
        name: "점상 한계 확인",
        desc: "20mm 25초(500법칙값) — 그래도 6px 흐른다",
        values: { f: 20, t: 25, decl: 0 },
      },
      {
        name: "궤적 사진 30분",
        desc: "24mm 1800초 — 호가 몇 도 도는지",
        values: { f: 24, t: 1800, decl: 45 },
      },
      {
        name: "망원 성야의 벽",
        desc: "200mm 2초 — 적도의 없이는 불가능함을 수치로",
        values: { f: 200, t: 2, decl: 0 },
      },
    ],
    compute: (s) => {
      const p = pitchOf(s);
      const um = O.starTrailUm(num(s, "f"), num(s, "t"), num(s, "decl"));
      const px = um / p;
      const arcDeg = (O.SIDEREAL_ARCSEC_PER_SEC * num(s, "t") * Math.cos((num(s, "decl") * Math.PI) / 180)) / 3600;
      return {
        results: [
          { label: "센서상 궤적", value: um >= 1000 ? `${(um / 1000).toFixed(2)} mm` : `${um.toFixed(1)} μm`, emph: true },
          { label: "픽셀 환산", value: `${px.toFixed(1)} px`, emph: true, warn: px > 5, sub: px > 5 ? "일반적으로 3~5px를 넘으면 확대 시 흐름이 보입니다" : undefined },
          { label: "하늘에서 움직인 각도", value: arcDeg >= 1 ? `${arcDeg.toFixed(2)}°` : `${(arcDeg * 60).toFixed(1)}′` },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "궤적", value: Math.min(px, 60), display: `${px.toFixed(1)} px`, tone: px > 5 ? "warn" : "a" },
            { label: "점상 기준", value: 4, display: "3~5 px", tone: "b" },
          ],
          unit: "px",
        },
      };
    },
  },

  "sun-altitude": {
    fields: [
      { kind: "city", key: "city", label: "도시 프리셋" },
      { kind: "number", key: "lat", label: "위도", min: -66, max: 66, step: 0.1, unit: "°" },
      { kind: "number", key: "lon", label: "경도", min: -180, max: 180, step: 0.1, unit: "°" },
      { kind: "date", key: "date", label: "날짜" },
      { kind: "number", key: "tz", label: "UTC 오프셋", min: -12, max: 14, step: 0.5, unit: "h" },
    ],
    defaults: { city: "서울", lat: 37.5665, lon: 126.978, date: "2026-06-21", tz: 9 },
    presets: [
      {
        name: "서울 오늘",
        desc: "서울 좌표로 골든아워·박명 시각",
        values: { city: "서울", lat: 37.5665, lon: 126.978, tz: 9, date: "__today__" },
      },
      {
        name: "제주 은하수",
        desc: "천문박명 종료 후가 은하수 촬영 가능 시간대",
        values: { city: "제주", lat: 33.4996, lon: 126.5312, tz: 9, date: "__today__" },
      },
      {
        name: "트롬쇠 동지",
        desc: "극야 — 태양이 뜨지 않는 날의 표시 확인",
        values: { city: "트롬쇠", lat: 69.6492, lon: 18.9553, tz: 1, date: "2026-12-21" },
      },
    ],
    compute: (s) => {
      const [y, m, d] = str(s, "date").split("-").map(Number);
      const lat = num(s, "lat");
      const lon = num(s, "lon");
      const tz = num(s, "tz");
      if (!y || !m || !d) return { results: [{ label: "날짜", value: "날짜를 입력하세요" }], visual: null };
      const ev = dayEvents(y, m, d, lat, lon, tz);
      const pts = altitudeCurve(y, m, d, lat, lon, tz, 0.1);
      const { declDeg, eqTimeMin } = sunParams(julianDay(y, m, d) + 0.5);
      const rows: ResultRow[] = [];
      if (ev.polar === "night") {
        rows.push({ label: "일출·일몰", value: "없음 (극야)", warn: true, sub: "이날 태양이 지평선(-0.833°) 위로 올라오지 않습니다" });
      } else if (ev.polar === "day") {
        rows.push({ label: "일출·일몰", value: "없음 (백야)", warn: true, sub: "이날 태양이 지평선 아래로 내려가지 않습니다" });
      } else {
        rows.push({ label: "일출 / 일몰", value: `${fmtHour(ev.sunrise)} / ${fmtHour(ev.sunset)}`, emph: true });
      }
      rows.push(
        { label: "아침 골든아워", value: `${fmtHour(ev.goldenAmStart)} ~ ${fmtHour(ev.goldenAmEnd)}`, sub: "고도 −4° → +6°" },
        { label: "저녁 골든아워", value: `${fmtHour(ev.goldenPmStart)} ~ ${fmtHour(ev.goldenPmEnd)}`, emph: true, sub: "고도 +6° → −4°" },
        { label: "저녁 블루아워", value: `${fmtHour(ev.bluePmStart)} ~ ${fmtHour(ev.bluePmEnd)}`, sub: "고도 −4° → −6°" },
        { label: "박명 종료(저녁)", value: `시민 ${fmtHour(ev.civilDusk)} · 항해 ${fmtHour(ev.nauticalDusk)} · 천문 ${fmtHour(ev.astroDusk)}`, sub: "천문박명 종료 후가 완전한 밤" },
        { label: "태양 적위 / 균시차", value: `${declDeg.toFixed(2)}° / ${eqTimeMin.toFixed(1)}분` }
      );
      return {
        results: rows,
        visual: { type: "sun", pts },
        notes: [
          "계산은 이 페이지 안에서만 수행되며 위치 정보를 어디에도 보내지 않습니다. 오차는 ±1~2분(대기 굴절 변동) 수준입니다.",
        ],
      };
    },
  },

  "exposure-equivalent": {
    fields: [
      apertureField,
      shutterField,
      isoField,
      {
        kind: "segment",
        key: "fix",
        label: "고정할 축",
        options: [
          { value: "iso", label: "ISO 고정" },
          { value: "aperture", label: "조리개 고정" },
          { value: "shutter", label: "셔터 고정" },
        ],
      },
      {
        kind: "segment",
        key: "step",
        label: "스톱 간격",
        options: [
          { value: "3", label: "1/3" },
          { value: "2", label: "1/2" },
          { value: "1", label: "1" },
        ],
      },
    ],
    defaults: { N: 8, t: "1/125", iso: 100, fix: "iso", step: "3" },
    presets: [
      {
        name: "실내 인물",
        desc: "f/2.8 · 1/60 · ISO 1600 — 셔터를 지키면서 조리개·ISO 트레이드오프",
        values: { N: 2.8, t: "1/60", iso: 1600, fix: "shutter" },
      },
      {
        name: "야경 장노출",
        desc: "f/8 · 8초 · ISO 100 — 삼각대 위에서 ISO를 고정하고 표 읽기",
        values: { N: 8, t: "8", iso: 100, fix: "iso" },
      },
      {
        name: "주간 스포츠",
        desc: "f/4 · 1/1000 · ISO 400 — 조리개 고정, 셔터·ISO 조합",
        values: { N: 4, t: "1/1000", iso: 400, fix: "aperture" },
      },
    ],
    compute: (s) => {
      const step = Number(str(s, "step")) as S.StopStep;
      const n0 = num(s, "N");
      const t0 = S.parseShutter(str(s, "t"));
      const iso0 = num(s, "iso");
      const fix = str(s, "fix") as "aperture" | "shutter" | "iso";
      const rows = S.equivalentTable(n0, t0, iso0, fix, step, step === 1 ? 4 : 6);
      const ev = O.ev100(n0, t0, iso0);
      return {
        results: [
          { label: "기준 노출", value: `f/${n0} · ${str(s, "t")}초 · ISO ${iso0}`, emph: true },
          { label: "EV (ISO100 환산)", value: ev.toFixed(1), sub: "명목 표기값 기준이라 정확값과 최대 ±0.1EV 차이가 날 수 있습니다" },
        ],
        visual: { type: "equiv", rows, fix },
        notes: ["표의 모든 값은 실제 카메라에 존재하는 클릭값입니다. 격자를 벗어나는 조합은 '불가'로 표시됩니다."],
      };
    },
  },

  "ev-calculator": {
    fields: [apertureField, shutterField, isoField],
    defaults: { N: 8, t: "1/125", iso: 100 },
    presets: [
      { name: "맑은 날 야외", desc: "Sunny 16 검증: f/16 · 1/125 · ISO100 → EV 15", values: { N: 16, t: "1/125", iso: 100 } },
      { name: "실내 조명", desc: "f/2.8 · 1/60 · ISO 800 — 실내가 몇 EV인지", values: { N: 2.8, t: "1/60", iso: 800 } },
      { name: "은하수", desc: "f/2.8 · 30초 · ISO 3200 → 약 EV −7", values: { N: 2.8, t: "30", iso: 3200 } },
    ],
    compute: (s) => {
      const t = S.parseShutter(str(s, "t"));
      const evIso = Math.log2((num(s, "N") ** 2) / t);
      const ev100v = O.ev100(num(s, "N"), t, num(s, "iso"));
      const scenes: Array<[number, string]> = [
        [16, "설원·해변 직사광"],
        [15, "맑은 날 야외 (Sunny 16)"],
        [13, "흐린 날"],
        [11, "일출·일몰 직전"],
        [8, "밝은 상점가 야경"],
        [5, "일반 실내"],
        [2, "촛불·야경 어두운 부분"],
        [-3, "달빛 풍경(보름)"],
        [-7, "은하수·별하늘"],
      ];
      const nearest = scenes.reduce((a, b) =>
        Math.abs(b[0] - ev100v) < Math.abs(a[0] - ev100v) ? b : a
      );
      return {
        results: [
          { label: "EV (ISO 100 환산)", value: ev100v.toFixed(2), emph: true },
          { label: "설정 ISO 기준 EV", value: evIso.toFixed(2), sub: `EV = log₂(N²/t)` },
          { label: "가까운 장면", value: nearest[1], sub: `표준 노출표 기준 EV ${nearest[0]} 부근 (ANSI PH2.7)` },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "이 설정", value: ev100v + 8, display: `EV ${ev100v.toFixed(1)}`, tone: "b" },
            ...scenes.filter((x) => Math.abs(x[0] - ev100v) <= 9).slice(0, 4).map(([v, name]) => ({
              label: name,
              value: v + 8,
              display: `EV ${v}`,
              tone: "a" as const,
            })),
          ],
        },
      };
    },
  },

  "nd-filter": {
    fields: [
      shutterField,
      {
        kind: "select",
        key: "nd1",
        label: "ND 필터",
        options: [
          { value: "0", label: "없음" },
          { value: "1", label: "ND2 (1스톱)" },
          { value: "2", label: "ND4 (2스톱)" },
          { value: "3", label: "ND8 (3스톱)" },
          { value: "4", label: "ND16 (4스톱)" },
          { value: "5", label: "ND32 (5스톱)" },
          { value: "6", label: "ND64 (6스톱)" },
          { value: "9.97", label: "ND1000 (OD 3.0 ≈ 10스톱)" },
          { value: "13.29", label: "ND10000 (OD 4.0 ≈ 13.3스톱)" },
        ],
      },
      {
        kind: "select",
        key: "nd2",
        label: "중첩 필터 (선택)",
        options: [
          { value: "0", label: "없음" },
          { value: "1", label: "ND2 (1스톱)" },
          { value: "2", label: "ND4 (2스톱)" },
          { value: "3", label: "ND8 (3스톱)" },
          { value: "6", label: "ND64 (6스톱)" },
          { value: "9.97", label: "ND1000 (≈10스톱)" },
        ],
      },
    ],
    defaults: { t: "1/60", nd1: "9.97", nd2: "0" },
    presets: [
      { name: "대낮 물흐름 장노출", desc: "1/60 + ND1000 → 약 17초", values: { t: "1/60", nd1: "9.97", nd2: "0" } },
      { name: "흐린 날 인파 지우기", desc: "1/15 + ND64 → 약 4초", values: { t: "1/15", nd1: "6", nd2: "0" } },
      { name: "스택 극단값", desc: "ND1000+ND64: 스톱은 합산 — 셔터가 분 단위로", values: { t: "1/125", nd1: "9.97", nd2: "6" } },
    ],
    compute: (s) => {
      const stops = Number(str(s, "nd1")) + Number(str(s, "nd2"));
      const t0 = S.parseShutter(str(s, "t"));
      const t1 = O.ndShutter(t0, stops);
      const over30 = t1 > 30;
      return {
        results: [
          { label: "필터 장착 후 셔터", value: t1 >= 1 ? `${t1 < 90 ? t1.toFixed(1) : (t1 / 60).toFixed(1) + "분"}${t1 < 90 ? "초" : ""}` : O.fmtShutter(t1), emph: true, warn: over30, sub: over30 ? "30초 초과 — 대부분의 바디에서 벌브(B) 모드가 필요합니다" : undefined },
          { label: "총 감광량", value: `${stops.toFixed(2)}스톱`, sub: "중첩 시 광학밀도(스톱) 합산" },
          { label: "배수", value: `×${Math.pow(2, stops) >= 1000 ? Math.round(Math.pow(2, stops)).toLocaleString() : Math.pow(2, stops).toFixed(0)}` },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "원래 셔터", value: Math.log2(t0 * 8000), display: O.fmtShutter(t0), tone: "a" },
            { label: "장착 후", value: Math.log2(t1 * 8000), display: t1 >= 1 ? `${t1.toFixed(1)}초` : O.fmtShutter(t1), tone: over30 ? "warn" : "b" },
          ],
          unit: "스톱 스케일",
        },
        notes: ["ND1000의 정확한 밀도는 OD 3.0(=9.97스톱)입니다. '10스톱'은 명목 표기로, 약 3% 차이가 납니다."],
      };
    },
  },

  "macro-exposure": {
    fields: [
      {
        kind: "segment",
        key: "mode",
        label: "입력 방식",
        options: [
          { value: "mag", label: "배율 직접 입력" },
          { value: "ext", label: "접사링 연장량" },
        ],
      },
      {
        kind: "slider",
        key: "m",
        label: "배율 (m:1)",
        min: 0.05,
        max: 5,
        step: 0.05,
        log: true,
        fmt: (v) => `${v.toFixed(2)}×`,
        showIf: (s) => s.mode === "mag",
      },
      {
        kind: "slider",
        key: "ext",
        label: "연장량",
        min: 0,
        max: 100,
        step: 1,
        fmt: (v) => `${Math.round(v)} mm`,
        showIf: (s) => s.mode === "ext",
      },
      {
        kind: "slider",
        key: "fl",
        label: "렌즈 초점거리",
        min: 20,
        max: 200,
        step: 1,
        log: true,
        fmt: (v) => `${Math.round(v)} mm`,
        showIf: (s) => s.mode === "ext",
      },
      apertureField,
    ],
    defaults: { mode: "mag", m: 1, ext: 25, fl: 50, N: 8 },
    presets: [
      { name: "등배 접사(1:1)", desc: "정석 매크로 — 2스톱이 사라진다", values: { mode: "mag", m: 1, N: 8 } },
      { name: "50mm + 25mm 접사링", desc: "일반 렌즈를 매크로로 — 배율과 감광 동시 계산", values: { mode: "ext", ext: 25, fl: 50, N: 5.6 } },
      { name: "2배 초접사", desc: "유효 조리개가 회절 영역으로 들어가는 상황", values: { mode: "mag", m: 2, N: 8 } },
    ],
    compute: (s) => {
      const m =
        str(s, "mode") === "ext"
          ? O.extensionMagnification(num(s, "ext"), num(s, "fl"))
          : num(s, "m");
      const r = O.macroExposure(m, num(s, "N"));
      const effWarn = r.effectiveN > 16;
      return {
        results: [
          ...(str(s, "mode") === "ext"
            ? [{ label: "배율", value: `${m.toFixed(2)}× (1:${(1 / m).toFixed(1)})`, emph: true, sub: "무한대 초점 기준 m = 연장량/f" }]
            : []),
          { label: "노출 배수", value: `×${r.factor.toFixed(2)}`, emph: true },
          { label: "보정 스톱", value: `+${r.stops.toFixed(2)}스톱`, sub: "TTL 측광은 자동 반영, 외장 노출계·수동 플래시는 직접 보정" },
          { label: "유효 조리개", value: `f/${r.effectiveN.toFixed(1)}`, warn: effWarn, sub: effWarn ? "회절로 선예도 저하가 체감되는 영역입니다 (회절 계산기 참고)" : undefined },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "표기 f수", value: num(s, "N"), display: `f/${num(s, "N")}`, tone: "a" },
            { label: "유효 f수", value: r.effectiveN, display: `f/${r.effectiveN.toFixed(1)}`, tone: effWarn ? "warn" : "b" },
          ],
        },
        notes: ["(1+m)² 식은 대칭 렌즈(동공비 1) 기준입니다. 비대칭 설계에서는 ±1/3스톱 수준의 편차가 날 수 있습니다."],
      };
    },
  },

  "motion-blur": {
    fields: [
      sensorField,
      resField,
      {
        kind: "slider",
        key: "v",
        label: "피사체 속도",
        min: 0.1,
        max: 60,
        step: 0.1,
        log: true,
        fmt: (v) => `${v.toFixed(1)} m/s (${(v * 3.6).toFixed(0)} km/h)`,
      },
      {
        kind: "slider",
        key: "d",
        label: "촬영 거리",
        min: 0.5,
        max: 200,
        step: 0.5,
        log: true,
        fmt: (v) => `${v.toFixed(1)} m`,
      },
      focalField(8, 800),
      shutterField,
      {
        kind: "slider",
        key: "angle",
        label: "이동 방향 기울기",
        min: 0,
        max: 80,
        step: 5,
        fmt: (v) => (v === 0 ? "0° (화면 가로질러)" : `${Math.round(v)}° (비스듬히)`),
      },
    ],
    defaults: { sensor: "full-frame", res: 0, v: 5, d: 10, f: 50, t: "1/500", angle: 0 },
    presets: [
      { name: "달리는 아이", desc: "3m/s · 5m · 50mm — 실내 행사장의 전형", values: { v: 3, d: 5, f: 50, t: "1/250" } },
      { name: "도로변 차량", desc: "60km/h · 15m · 70mm — 패닝 없이 세우려면", values: { v: 16.7, d: 15, f: 70, t: "1/1000" } },
      { name: "무대 위 배우", desc: "1.5m/s · 8m · 135mm — 조명 부족 상황의 하한", values: { v: 1.5, d: 8, f: 135, t: "1/125" } },
    ],
    compute: (s) => {
      const p = pitchOf(s);
      const t = S.parseShutter(str(s, "t"));
      const um = O.motionBlurUm(num(s, "v"), num(s, "d"), num(s, "f"), t, num(s, "angle"));
      const px = um / p;
      const bad = px > 8;
      // 역산: 3px 이하가 되는 셔터
      const target = (3 * p) / (um / t) / 1000000;
      return {
        results: [
          { label: "상면 흐림", value: `${px.toFixed(1)} px (${um.toFixed(0)} μm)`, emph: true, warn: bad, sub: bad ? "픽셀 등배 기준으로 뚜렷한 블러입니다" : "3px 이하면 일반 감상에서 정지로 보입니다" },
          { label: "3px 이하로 만들려면", value: `${O.fmtShutter(Math.min(t, target * 1e6))} 이하`, sub: "같은 거리·초점거리 기준" },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "이 설정", value: Math.min(px, 80), display: `${px.toFixed(1)} px`, tone: bad ? "warn" : "a" },
            { label: "정지로 보이는 기준", value: 3, display: "3 px", tone: "b" },
          ],
          unit: "px",
        },
        notes: ["센서면과 평행하게 이동하는 최악 조건 기준입니다. 비스듬한 이동은 각도만큼 흐림이 줄어듭니다."],
      };
    },
  },

  "angle-of-view": {
    fields: [sensorField, focalField(4, 1200)],
    defaults: { sensor: "full-frame", f: 50 },
    presets: [
      { name: "표준 화각", desc: "FF 50mm — 대각 47°의 기준점", values: { sensor: "full-frame", f: 50 } },
      { name: "초광각 풍경", desc: "FF 14mm — 수평 104°", values: { sensor: "full-frame", f: 14 } },
      { name: "MFT 등가 확인", desc: "MFT 25mm = FF 50mm과 같은 대각 화각", values: { sensor: "mft", f: 25 } },
    ],
    compute: (s) => {
      const sen = sensorOf(s);
      const f = num(s, "f");
      const dg = O.angleOfViewDeg(sen.diagonalMm, f);
      const h = O.angleOfViewDeg(sen.widthMm, f);
      const v = O.angleOfViewDeg(sen.heightMm, f);
      return {
        results: [
          { label: "대각 화각", value: `${dg.toFixed(1)}°`, emph: true, sub: "제조사 공표 화각은 보통 이 값" },
          { label: "수평 화각", value: `${h.toFixed(1)}°` },
          { label: "수직 화각", value: `${v.toFixed(1)}°` },
          { label: "환산 초점거리", value: `${(f * sen.cropFactor).toFixed(0)} mm` },
        ],
        visual: { type: "wedge", deg: h, label: `수평 ${h.toFixed(1)}°` },
        notes: ["무한대 초점 기준입니다. 가까이 초점을 맞추면 실효 화각은 이보다 좁아집니다."],
      };
    },
  },

  "equivalent-focal": {
    fields: [
      { kind: "sensor", key: "sensor", label: "사용 센서" },
      focalField(4, 800),
      apertureField,
    ],
    defaults: { sensor: "mft", f: 25, N: 1.8 },
    presets: [
      { name: "MFT 표준렌즈", desc: "25mm f/1.8 → FF 50mm f/3.6 상당 심도", values: { sensor: "mft", f: 25, N: 1.8 } },
      { name: "APS-C 인물", desc: "56mm f/1.4 → 약 85mm 상당", values: { sensor: "aps-c", f: 56, N: 1.4 } },
      { name: "폰 주카메라", desc: "6.9mm(1/1.56″) → 약 29mm 상당", values: { sensor: "phone-1-1.56", f: 6.9, N: 1.8 } },
    ],
    compute: (s) => {
      const sen = sensorOf(s);
      const { fEq, nEqDof } = O.equivalents(num(s, "f"), num(s, "N"), sen.cropFactor);
      return {
        results: [
          { label: "환산 초점거리 (화각 기준)", value: `${fEq.toFixed(1)} mm`, emph: true, sub: `크롭팩터 ${sen.cropFactor} = FF 대각선 ÷ 이 센서 대각선` },
          { label: "심도 등가 f수", value: `f/${nEqDof.toFixed(1)}`, sub: "동일 화각·동일 거리·동일 출력 크기에서 FF와 같은 심도가 되는 값" },
          { label: "노출(밝기)로서의 f수", value: `f/${num(s, "N")} 그대로`, sub: "단위면적당 조도는 센서 크기와 무관 — 심도 등가와 혼동 금지" },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "실 초점거리", value: num(s, "f"), display: `${num(s, "f")} mm`, tone: "a" },
            { label: "FF 환산", value: fEq, display: `${fEq.toFixed(0)} mm`, tone: "b" },
          ],
          unit: "mm",
        },
      };
    },
  },

  "panorama-shots": {
    fields: [
      sensorField,
      focalField(8, 300),
      {
        kind: "segment",
        key: "orient",
        label: "카메라 방향",
        options: [
          { value: "portrait", label: "세로" },
          { value: "landscape", label: "가로" },
        ],
      },
      {
        kind: "slider",
        key: "overlap",
        label: "겹침률",
        min: 15,
        max: 60,
        step: 5,
        fmt: (v) => `${Math.round(v)}%`,
      },
      {
        kind: "slider",
        key: "total",
        label: "목표 각도",
        min: 60,
        max: 360,
        step: 10,
        fmt: (v) => `${Math.round(v)}°`,
      },
    ],
    defaults: { sensor: "full-frame", f: 24, orient: "portrait", overlap: 30, total: 360 },
    presets: [
      { name: "360° 세로 파노", desc: "24mm 세로 · 30% — 표준 10컷", values: { f: 24, orient: "portrait", overlap: 30, total: 360 } },
      { name: "산 능선 180°", desc: "50mm 세로 · 25%", values: { f: 50, orient: "portrait", overlap: 25, total: 180 } },
      { name: "망원 기가픽셀", desc: "200mm · 90° — 컷 수가 급증하는 사례", values: { f: 200, orient: "portrait", overlap: 30, total: 90 } },
    ],
    compute: (s) => {
      const sen = sensorOf(s);
      const rotDim = str(s, "orient") === "portrait" ? sen.widthMm : sen.widthMm; // 회전 방향(수평)으로 놓이는 치수
      const dim = str(s, "orient") === "portrait" ? sen.heightMm : sen.widthMm;
      const r = O.panoramaShots(dim, num(s, "f"), num(s, "overlap") / 100, num(s, "total"));
      return {
        results: [
          { label: "필요 컷 수", value: `${r.shots}컷`, emph: true },
          { label: "컷당 화각", value: `${r.fovDeg.toFixed(1)}°`, sub: str(s, "orient") === "portrait" ? "세로 구도 → 수평 방향 치수는 센서 짧은 변" : "가로 구도 → 수평 방향 치수는 센서 긴 변" },
          { label: "회전 스텝", value: `${r.stepDeg.toFixed(1)}°씩`, sub: "삼각대 팬 눈금 기준" },
        ],
        visual: { type: "pano", shots: r.shots, stepDeg: r.stepDeg, fovDeg: r.fovDeg, totalDeg: num(s, "total") },
        notes: ["근경이 있는 파노라마는 입사동 중심 회전이 아니면 시차로 이어붙이기가 어긋납니다 — 해설 '입사동과 시차' 참고."],
      };
    },
  },

  "diffraction-limit": {
    fields: [
      sensorField,
      resField,
      apertureField,
      {
        kind: "slider",
        key: "lambda",
        label: "파장",
        min: 400,
        max: 700,
        step: 10,
        fmt: (v) => `${Math.round(v)} nm`,
      },
    ],
    defaults: { sensor: "full-frame", res: 2, N: 8, lambda: 550 },
    presets: [
      { name: "45MP 풍경", desc: "고화소 바디에서 f/8이 이미 한계 부근", values: { sensor: "full-frame", res: 2, N: 8 } },
      { name: "24MP 일반", desc: "같은 f/11이라도 체감이 다른 이유", values: { sensor: "full-frame", res: 0, N: 11 } },
      { name: "접사 f/22", desc: "심도를 위해 조인 대가를 수치로", values: { sensor: "full-frame", res: 2, N: 22 } },
    ],
    compute: (s) => {
      const p = pitchOf(s);
      const lam = num(s, "lambda") / 1000;
      const airy = O.airyDiameterUm(num(s, "N"), lam);
      const onset = O.diffractionOnsetN(p, lam);
      const over = airy > 2 * p;
      return {
        results: [
          { label: "에어리 원반 지름", value: `${airy.toFixed(1)} μm`, emph: true },
          { label: "화소 피치", value: `${p.toFixed(2)} μm (${resOf(s).label})` },
          { label: "회절 체감 시작", value: `f/${S.snapF(onset)}부터`, warn: over, sub: over ? "현재 조리개는 이 한계를 넘었습니다 — 선예도가 서서히 감소합니다" : "현재 조리개는 아직 한계 안입니다" },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "에어리 원반", value: airy, display: `${airy.toFixed(1)} μm`, tone: over ? "warn" : "a" },
            { label: "화소 2개 폭", value: 2 * p, display: `${(2 * p).toFixed(1)} μm`, tone: "b" },
          ],
          unit: "μm",
        },
        notes: ["'2×피치' 기준은 나이퀴스트 표본화에서 온 관례이며, 기준 정의에 따라 한계 f수는 ±1스톱까지 달라질 수 있습니다. 회절은 절벽이 아니라 점진적 저하입니다."],
      };
    },
  },

  "pixel-pitch": {
    fields: [
      sensorField,
      resField,
      {
        kind: "slider",
        key: "f",
        label: "초점거리 (플레이트 스케일용)",
        min: 8,
        max: 2000,
        step: 1,
        log: true,
        fmt: (v) => `${Math.round(v)} mm`,
      },
    ],
    defaults: { sensor: "full-frame", res: 0, f: 400 },
    presets: [
      { name: "24MP 풀프레임", desc: "피치 6.0μm — 기준점", values: { sensor: "full-frame", res: 0 } },
      { name: "61MP 풀프레임", desc: "3.79μm — 고화소의 대가와 이득", values: { sensor: "full-frame", res: 3 } },
      { name: "달 촬영 400mm", desc: "달(지름 약 1900″)이 몇 픽셀인지", values: { sensor: "full-frame", res: 0, f: 400 } },
    ],
    compute: (s) => {
      const sen = sensorOf(s);
      const r = resOf(s);
      const p = O.pixelPitchUm(sen.widthMm, r.width);
      const scale = O.plateScale(p, num(s, "f"));
      const moonPx = 1900 / scale;
      return {
        results: [
          { label: "화소 피치", value: `${p.toFixed(2)} μm`, emph: true, sub: `${sen.widthMm}mm ÷ ${r.width}px` },
          { label: "플레이트 스케일", value: `${scale.toFixed(2)}″/px`, sub: `${num(s, "f")}mm 기준 — 하늘 1픽셀이 담는 각도` },
          { label: "보름달 크기", value: `약 ${Math.round(moonPx)} px`, sub: "달 시직경 평균 약 1900″ 기준" },
        ],
        visual: {
          type: "bars",
          items: sen.commonResolutions.map((x) => ({
            label: x.label,
            value: x.pitchUm,
            display: `${x.pitchUm.toFixed(2)} μm`,
            tone: x.label === r.label ? ("b" as const) : ("a" as const),
          })),
          unit: "μm",
        },
      };
    },
  },

  "flash-guide-number": {
    fields: [
      {
        kind: "slider",
        key: "gn",
        label: "가이드넘버 (ISO100·m)",
        min: 5,
        max: 80,
        step: 1,
        fmt: (v) => `GN ${Math.round(v)}`,
      },
      {
        kind: "segment",
        key: "mode",
        label: "구할 값",
        options: [
          { value: "aperture", label: "조리개" },
          { value: "distance", label: "도달 거리" },
        ],
      },
      {
        kind: "slider",
        key: "d",
        label: "피사체 거리",
        min: 0.5,
        max: 30,
        step: 0.5,
        log: true,
        fmt: (v) => `${v.toFixed(1)} m`,
        showIf: (s) => s.mode === "aperture",
      },
      { ...apertureField, showIf: (s) => s.mode === "distance" },
      isoField,
      {
        kind: "select",
        key: "power",
        label: "발광량",
        options: [
          { value: "1", label: "1/1 (풀발광)" },
          { value: "0.5", label: "1/2" },
          { value: "0.25", label: "1/4" },
          { value: "0.125", label: "1/8" },
          { value: "0.0625", label: "1/16" },
          { value: "0.03125", label: "1/32" },
          { value: "0.015625", label: "1/64" },
        ],
      },
    ],
    defaults: { gn: 36, mode: "aperture", d: 3, N: 5.6, iso: 100, power: "1" },
    presets: [
      { name: "실내 직광 3m", desc: "GN36 풀발광 — 필요한 조리개", values: { gn: 36, mode: "aperture", d: 3, iso: 100, power: "1" } },
      { name: "ISO를 올려 거리 벌기", desc: "GN36 · f/8 · ISO400 — 도달 거리 2배", values: { gn: 36, mode: "distance", N: 8, iso: 400, power: "1" } },
      { name: "1/16 발광 근접", desc: "약광으로 1m 앞 — 과노출 피하기", values: { gn: 36, mode: "aperture", d: 1, iso: 100, power: "0.0625" } },
    ],
    compute: (s) => {
      const gn = O.effectiveGN(num(s, "gn"), num(s, "iso"), Number(str(s, "power")));
      const rows: ResultRow[] = [
        { label: "유효 GN", value: gn.toFixed(1), sub: "GN × √(ISO/100) × √(발광비)" },
      ];
      let vis: VisualSpec = null;
      if (str(s, "mode") === "aperture") {
        const needN = gn / num(s, "d");
        const snapped = S.snapF(Math.min(needN, 22));
        const out = needN < 0.95 || needN > 32;
        rows.unshift({
          label: "필요 조리개",
          value: out ? "클릭 범위 밖" : `f/${needN.toFixed(1)}`,
          emph: true,
          warn: out,
          sub: out
            ? needN < 0.95
              ? "빛이 부족합니다 — ISO를 올리거나 거리를 좁히세요"
              : "과노출 — 발광량을 낮추거나 거리를 벌리세요"
            : `가까운 클릭값 f/${snapped}`,
        });
        vis = {
          type: "bars",
          items: [1, 2, 3, 5, 8].map((d) => ({
            label: `${d}m`,
            value: Math.min(gn / d, 32),
            display: gn / d > 32 ? "과노출권" : `f/${(gn / d).toFixed(1)}`,
            tone: d === num(s, "d") ? ("b" as const) : ("a" as const),
          })),
        };
      } else {
        const dist = gn / num(s, "N");
        rows.unshift({
          label: "적정 노출 도달 거리",
          value: `${dist.toFixed(1)} m`,
          emph: true,
          sub: "직광·무반사 기준. 실내 반사가 있으면 조금 더 나갑니다",
        });
        vis = {
          type: "bars",
          items: [2.8, 4, 5.6, 8, 11].map((n) => ({
            label: `f/${n}`,
            value: gn / n,
            display: `${(gn / n).toFixed(1)} m`,
            tone: n === num(s, "N") ? ("b" as const) : ("a" as const),
          })),
          unit: "m",
        };
      }
      return { results: rows, visual: vis };
    },
  },

  timelapse: {
    fields: [
      {
        kind: "slider",
        key: "clip",
        label: "완성 영상 길이",
        min: 3,
        max: 120,
        step: 1,
        fmt: (v) => `${Math.round(v)}초`,
      },
      {
        kind: "segment",
        key: "fps",
        label: "재생 fps",
        options: [
          { value: "24", label: "24" },
          { value: "25", label: "25" },
          { value: "30", label: "30" },
          { value: "60", label: "60" },
        ],
      },
      {
        kind: "slider",
        key: "interval",
        label: "촬영 인터벌",
        min: 1,
        max: 600,
        step: 1,
        log: true,
        fmt: (v) => (v >= 60 ? `${(v / 60).toFixed(1)}분` : `${Math.round(v)}초`),
      },
      {
        kind: "slider",
        key: "mb",
        label: "장당 파일 크기",
        min: 2,
        max: 120,
        step: 1,
        fmt: (v) => `${Math.round(v)} MB`,
      },
    ],
    defaults: { clip: 10, fps: "24", interval: 5, mb: 30 },
    presets: [
      { name: "노을 타임랩스", desc: "10초 완성 · 5초 간격 — 20분 촬영", values: { clip: 10, fps: "24", interval: 5 } },
      { name: "별 일주", desc: "20초 완성 · 30초 간격 — 4시간 코스", values: { clip: 20, fps: "24", interval: 30 } },
      { name: "구름 빠른 흐름", desc: "8초 완성 · 2초 간격", values: { clip: 8, fps: "30", interval: 2 } },
    ],
    compute: (s) => {
      const r = O.timelapse(num(s, "clip"), Number(str(s, "fps")), num(s, "interval"), num(s, "mb"));
      const hours = r.shootMin / 60;
      return {
        results: [
          { label: "필요 컷 수", value: `${r.shots}컷`, emph: true },
          { label: "촬영 소요", value: hours >= 1 ? `${hours.toFixed(1)}시간` : `${r.shootMin.toFixed(0)}분`, emph: true },
          { label: "저장 용량", value: `약 ${r.storageGb.toFixed(1)} GB` },
          { label: "배속", value: `×${r.speedup.toFixed(0)}`, sub: "인터벌 × 재생 fps" },
        ],
        visual: {
          type: "bars",
          items: [
            { label: "촬영 시간", value: r.shootMin, display: hours >= 1 ? `${hours.toFixed(1)}h` : `${r.shootMin.toFixed(0)}분`, tone: "a" },
            { label: "완성 영상", value: num(s, "clip") / 60, display: `${num(s, "clip")}초`, tone: "b" },
          ],
        },
        notes: ["인터벌은 (셔터속도 + 저장 시간)보다 길어야 합니다. 장노출 야간 타임랩스에서 이 하한이 먼저 걸립니다."],
      };
    },
  },
};

export { CITY_PRESETS };
