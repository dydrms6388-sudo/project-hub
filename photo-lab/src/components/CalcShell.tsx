"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REGISTRY, CalcState, FieldDef, VisualSpec } from "@/lib/registry";
import { SENSORS, getSensor } from "@/lib/data";
import { F_THIRD, T_THIRD, ISO_THIRD } from "@/lib/engine/stops";
import { CITY_PRESETS } from "@/lib/engine/sun";
import {
  ClickField,
  NumberField,
  ResultGrid,
  ResultItem,
  SegmentField,
  SelectField,
  SliderField,
} from "./ui";
import {
  AngleWedge,
  CompareBars,
  DofBar,
  PanoArc,
  SunCurve,
  SunLegend,
} from "./visuals";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** URL 쿼리 → 상태. 장비 프리셋 공유·북마크 재현용 (localStorage 미사용) */
function readUrl(defaults: CalcState): CalcState {
  if (typeof window === "undefined") return defaults;
  const q = new URLSearchParams(window.location.search);
  const s: CalcState = { ...defaults };
  for (const [k, v] of q.entries()) {
    if (!(k in defaults)) continue;
    s[k] = typeof defaults[k] === "number" ? Number(v) : v;
    if (typeof defaults[k] === "number" && Number.isNaN(s[k] as number)) s[k] = defaults[k];
  }
  return s;
}

function Visual({ spec }: { spec: VisualSpec }) {
  if (!spec) return null;
  switch (spec.type) {
    case "dof":
      return <DofBar nearM={spec.nearM} farM={spec.farM} subjectM={spec.subjectM} hyperM={spec.hyperM} />;
    case "bars":
      return <CompareBars items={spec.items} unit={spec.unit} />;
    case "sun":
      return (
        <>
          <SunCurve pts={spec.pts} />
          <SunLegend />
        </>
      );
    case "wedge":
      return <AngleWedge deg={spec.deg} label={spec.label} />;
    case "pano":
      return <PanoArc shots={spec.shots} stepDeg={spec.stepDeg} fovDeg={spec.fovDeg} totalDeg={spec.totalDeg} />;
    case "equiv":
      return (
        <div className="table-wrap">
          <table className="equiv-table">
            <thead>
              <tr>
                <th>조리개</th>
                <th>셔터</th>
                <th>ISO</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {spec.rows.map((r, i) => {
                const base = Math.floor(spec.rows.length / 2) === i;
                return (
                  <tr key={i} className={base ? "row-base" : r.possible ? "" : "row-impossible"}>
                    <td>f/{r.n}</td>
                    <td>{r.t}초</td>
                    <td>{r.iso}</td>
                    <td>
                      {!r.possible
                        ? "클릭 범위 밖"
                        : base
                          ? "기준"
                          : Math.abs(r.offStops) > 0.15
                            ? `표기 반올림 ${r.offStops > 0 ? "+" : ""}${r.offStops.toFixed(1)}EV`
                            : "등가"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function CalcShell({ slug }: { slug: string }) {
  const def = REGISTRY[slug];
  const [state, setState] = useState<CalcState>(def.defaults);
  const [copied, setCopied] = useState(false);
  const mounted = useRef(false);

  // 최초 마운트: URL 복원 (+ 태양 계산기는 오늘 날짜로)
  useEffect(() => {
    const fromUrl = readUrl(def.defaults);
    if (slug === "sun-altitude" && !new URLSearchParams(window.location.search).has("date")) {
      fromUrl.date = todayStr();
    }
    setState(fromUrl);
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // 상태 → URL (기본값과 다른 것만)
  useEffect(() => {
    if (!mounted.current) return;
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (String(v) !== String(def.defaults[k])) q.set(k, String(v));
    }
    const url = q.toString() ? `?${q}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [state, def.defaults]);

  const set = useCallback((k: string, v: string | number) => {
    setState((s) => ({ ...s, [k]: v }));
  }, []);

  const out = useMemo(() => {
    try {
      return def.compute(state);
    } catch {
      return {
        results: [{ label: "오류", value: "입력을 확인하세요" }] as import("@/lib/registry").ResultRow[],
        visual: null,
      };
    }
  }, [def, state]);

  const applyPreset = (values: CalcState) => {
    const v = { ...values };
    if (v.date === "__today__") v.date = todayStr();
    setState((s) => ({ ...s, ...v }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 미지원 환경 무시 */
    }
  };

  const renderField = (fd: FieldDef) => {
    if (fd.showIf && !fd.showIf(state)) return null;
    const key = fd.key;
    switch (fd.kind) {
      case "slider":
        return (
          <SliderField
            key={key}
            label={fd.label}
            value={Number(state[key])}
            display={fd.fmt(Number(state[key]))}
            min={fd.min}
            max={fd.max}
            step={fd.step}
            log={fd.log}
            onChange={(v) => set(key, v)}
          />
        );
      case "click": {
        if (fd.list === "f") {
          const idx = F_THIRD.findIndex((v) => Math.abs(v - Number(state[key])) < 0.001);
          return (
            <ClickField
              key={key}
              label={fd.label}
              items={F_THIRD}
              index={idx < 0 ? 18 : idx}
              format={(v) => `f/${v}`}
              onChange={(i) => set(key, F_THIRD[i])}
            />
          );
        }
        if (fd.list === "t") {
          const idx = T_THIRD.indexOf(String(state[key]));
          return (
            <ClickField
              key={key}
              label={fd.label}
              items={T_THIRD}
              index={idx < 0 ? 18 : idx}
              format={(v) => `${v}초`}
              onChange={(i) => set(key, T_THIRD[i])}
            />
          );
        }
        const idx = ISO_THIRD.indexOf(Number(state[key]));
        return (
          <ClickField
            key={key}
            label={fd.label}
            items={ISO_THIRD}
            index={idx < 0 ? 3 : idx}
            format={(v) => `ISO ${v}`}
            onChange={(i) => set(key, ISO_THIRD[i])}
          />
        );
      }
      case "select":
        return (
          <SelectField
            key={key}
            label={fd.label}
            value={String(state[key])}
            options={fd.options}
            onChange={(v) => set(key, v)}
          />
        );
      case "segment":
        return (
          <SegmentField
            key={key}
            label={fd.label}
            value={String(state[key])}
            options={fd.options}
            onChange={(v) => set(key, v)}
          />
        );
      case "number":
        return (
          <NumberField
            key={key}
            label={fd.label}
            value={Number(state[key])}
            min={fd.min}
            max={fd.max}
            step={fd.step}
            unit={fd.unit}
            onChange={(v) => set(key, v)}
          />
        );
      case "sensor":
        return (
          <SelectField
            key={key}
            label={fd.label}
            value={String(state[key])}
            options={SENSORS.map((s) => ({ value: s.id, label: `${s.name} (${s.widthMm}×${s.heightMm}mm)` }))}
            onChange={(v) => {
              set(key, v);
              // 해상도 인덱스가 새 센서 범위를 넘으면 리셋
              const sen = getSensor(v);
              if (Number(state.res) >= sen.commonResolutions.length) set("res", 0);
            }}
          />
        );
      case "resolution": {
        const sen = getSensor(String(state.sensor));
        return (
          <SelectField
            key={key}
            label={fd.label}
            value={String(state[key])}
            options={sen.commonResolutions.map((r, i) => ({
              value: String(i),
              label: `${r.label} — 피치 ${r.pitchUm.toFixed(2)}μm`,
            }))}
            onChange={(v) => set(key, Number(v))}
          />
        );
      }
      case "date":
        return (
          <div className="field" key={key}>
            <div className="field-head">
              <span className="field-label">{fd.label}</span>
            </div>
            <input
              type="date"
              value={String(state[key])}
              onChange={(e) => set(key, e.target.value)}
              aria-label={fd.label}
            />
          </div>
        );
      case "city":
        return (
          <SelectField
            key={key}
            label={fd.label}
            value={String(state[key])}
            options={[
              { value: "직접 입력", label: "직접 입력" },
              ...CITY_PRESETS.map((c) => ({ value: c.name, label: c.name })),
            ]}
            onChange={(v) => {
              const city = CITY_PRESETS.find((c) => c.name === v);
              if (city) {
                setState((s) => ({ ...s, city: v, lat: city.lat, lon: city.lon, tz: city.tz }));
              } else {
                set(key, v);
              }
            }}
          />
        );
    }
  };

  return (
    <div className="calc-shell">
      <div className="calc-fields">{def.fields.map(renderField)}</div>

      <div className="preset-row">
        {def.presets.map((p) => (
          <button key={p.name} type="button" className="preset-btn" onClick={() => applyPreset(p.values)} title={p.desc}>
            {p.name}
          </button>
        ))}
        <button type="button" className="preset-btn share-btn" onClick={copyLink}>
          {copied ? "복사됨 ✓" : "설정 링크 복사"}
        </button>
      </div>
      <div className="preset-descs">
        {def.presets.map((p) => (
          <p key={p.name}>
            <strong>{p.name}</strong> — {p.desc}
          </p>
        ))}
      </div>

      <ResultGrid>
        {out.results.map((r) => (
          <ResultItem key={r.label} label={r.label} value={r.value} sub={r.sub} emph={r.emph} warn={r.warn} />
        ))}
      </ResultGrid>

      <Visual spec={out.visual} />

      {out.notes?.map((n, i) => (
        <p key={i} className="calc-note">
          {n}
        </p>
      ))}
    </div>
  );
}
