"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { newId, useLocalStorage } from "@/lib/storage";
import { downloadPng, offscreen, WALLPAPER } from "@/lib/saveImage";

type Mode = "univ" | "school";
type Course = {
  id: string;
  name: string;
  place: string;
  mode: Mode;
  day: number;   // 0=월
  start: number; // univ: 분(540=9:00) / school: 교시(1~7)
  end: number;   // univ: 분(끝) / school: 교시(끝, 포함)
  color: number;
};
type State = { mode: Mode; sat: boolean; courses: Course[] };

const DAYS = ["월", "화", "수", "목", "금", "토"];
const UNIV_START = 9 * 60;
const UNIV_END = 21 * 60;
const SLOT = 30;
const UNIV_ROWS = (UNIV_END - UNIV_START) / SLOT; // 24
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const COLORS = [
  { bg: "#E3EDF6", fg: "#1B5480" },
  { bg: "#F6E4EE", fg: "#84355C" },
  { bg: "#EBF0DE", fg: "#53621B" },
  { bg: "#F7EBDB", fg: "#83521B" },
  { bg: "#EDE3F6", fg: "#643584" },
  { bg: "#E2EAEE", fg: "#2B4351" },
  { bg: "#DEF0EA", fg: "#1B6551" },
  { bg: "#F9E4E0", fg: "#93372A" },
];

const EMPTY: State = { mode: "univ", sat: false, courses: [] };

const pad = (n: number) => String(n).padStart(2, "0");
const fmtMin = (m: number) => `${Math.floor(m / 60)}:${pad(m % 60)}`;

const UNIV_TIMES: number[] = [];
for (let m = UNIV_START; m <= UNIV_END; m += SLOT) UNIV_TIMES.push(m);

/** 겹치는 수업을 나란히 놓기 위한 레인 계산. end 는 배타적 경계로 넘긴다. */
type Placed = { c: Course; lane: number; lanes: number };
function layout(list: Course[], exclusiveEnd: (c: Course) => number): Placed[] {
  const sorted = [...list].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];

  const flush = () => {
    if (!cluster.length) return;
    for (const p of cluster) p.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const c of sorted) {
    // 지금까지의 모든 레인이 끝난 뒤에 시작하면 새 덩어리
    if (laneEnds.length && c.start >= Math.max(...laneEnds)) flush();
    let lane = laneEnds.findIndex((e) => e <= c.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(exclusiveEnd(c));
    } else {
      laneEnds[lane] = exclusiveEnd(c);
    }
    cluster.push({ c, lane, lanes: 1 });
  }
  flush();
  return result;
}

function geometry(c: Course, mode: Mode) {
  if (mode === "univ") {
    return { row: (c.start - UNIV_START) / SLOT, span: (c.end - c.start) / SLOT };
  }
  return { row: c.start - 1, span: c.end - c.start + 1 };
}

const label = (c: Course, mode: Mode) =>
  mode === "univ" ? `${fmtMin(c.start)}~${fmtMin(c.end)}` : `${c.start}교시~${c.end}교시`;

/** 시간표 격자. 화면용과 배경화면용이 같은 컴포넌트를 크기만 바꿔 쓴다. */
function Grid({
  state,
  rowH,
  fontSize,
  gutter,
  headerH,
}: {
  state: State;
  rowH: number;
  fontSize: number;
  gutter: number;
  headerH: number;
}) {
  const days = DAYS.slice(0, state.sat ? 6 : 5);
  const rows = state.mode === "univ" ? UNIV_ROWS : PERIODS.length;
  const visible = state.courses.filter((c) => c.mode === state.mode && c.day < days.length);
  const bodyH = rows * rowH;

  return (
    <div style={{ display: "flex", background: "#fff", fontSize }}>
      {/* 시간 눈금 */}
      <div style={{ width: gutter, flexShrink: 0 }}>
        <div style={{ height: headerH }} />
        <div style={{ position: "relative", height: bodyH }}>
          {state.mode === "univ"
            ? UNIV_TIMES.slice(0, -1).map((m, i) =>
                m % 60 === 0 ? (
                  <div
                    key={m}
                    style={{
                      position: "absolute",
                      top: i * rowH - fontSize * 0.6,
                      right: fontSize * 0.4,
                      color: "#9ca3af",
                      fontSize: fontSize * 0.85,
                      lineHeight: 1,
                    }}
                  >
                    {m / 60}
                  </div>
                ) : null
              )
            : PERIODS.map((p, i) => (
                <div
                  key={p}
                  style={{
                    position: "absolute",
                    top: i * rowH,
                    height: rowH,
                    right: fontSize * 0.4,
                    display: "flex",
                    alignItems: "center",
                    color: "#9ca3af",
                    fontSize: fontSize * 0.85,
                  }}
                >
                  {p}
                </div>
              ))}
        </div>
      </div>

      {/* 요일 열 */}
      <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
        {days.map((day, di) => {
          const placed = layout(
            visible.filter((c) => c.day === di),
            (c) => (state.mode === "univ" ? c.end : c.end + 1)
          );
          return (
            <div key={day} style={{ flex: 1, minWidth: 0, borderLeft: "1px solid #e5e7eb" }}>
              <div
                style={{
                  height: headerH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  color: "#16181d",
                  borderBottom: "1px solid #d1d5db",
                }}
              >
                {day}
              </div>
              <div style={{ position: "relative", height: bodyH }}>
                {Array.from({ length: rows }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      top: i * rowH,
                      left: 0,
                      right: 0,
                      borderTop:
                        state.mode === "univ" && i % 2 === 1
                          ? "1px dotted #f1f2f4"
                          : "1px solid #eceef1",
                    }}
                  />
                ))}
                {placed.map(({ c, lane, lanes }) => {
                  const g = geometry(c, state.mode);
                  const color = COLORS[c.color % COLORS.length];
                  return (
                    <div
                      key={c.id}
                      style={{
                        position: "absolute",
                        top: g.row * rowH + 1,
                        height: g.span * rowH - 2,
                        left: `${(lane / lanes) * 100}%`,
                        width: `${(1 / lanes) * 100}%`,
                        padding: fontSize * 0.35,
                        overflow: "hidden",
                        background: color.bg,
                        color: color.fg,
                        borderRadius: fontSize * 0.4,
                        lineHeight: 1.25,
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ fontWeight: 700, wordBreak: "break-all" }}>{c.name}</div>
                      {c.place && (
                        <div style={{ fontSize: fontSize * 0.82, opacity: 0.75, wordBreak: "break-all" }}>
                          {c.place}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Timetable() {
  const [state, setState, loaded] = useLocalStorage<State>("studyroom:timetable", EMPTY);
  const [shared, setShared] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  // 폼
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [day, setDay] = useState(0);
  const [start, setStart] = useState(UNIV_START);
  const [end, setEnd] = useState(UNIV_START + 90);
  const [error, setError] = useState<string | null>(null);

  // 공유 링크(?d=)가 있으면 저장값보다 우선한다.
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("d");
    if (!d) return;
    try {
      const parsed = JSON.parse(decompressFromEncodedURIComponent(d) || "") as State;
      if (parsed && Array.isArray(parsed.courses)) {
        setState({
          mode: parsed.mode === "school" ? "school" : "univ",
          sat: !!parsed.sat,
          courses: parsed.courses.slice(0, 60),
        });
        setShared(true);
      }
    } catch {
      setNotice("공유 링크를 읽지 못했습니다. 링크가 잘린 것 같아요.");
    }
  }, [setState]);

  // 모드가 바뀌면 폼의 시간 입력 단위도 바꾼다.
  const switchMode = (mode: Mode) => {
    setState((s) => ({ ...s, mode }));
    setError(null);
    if (mode === "univ") {
      setStart(UNIV_START);
      setEnd(UNIV_START + 90);
    } else {
      setStart(1);
      setEnd(2);
    }
  };

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("과목 이름을 입력하세요.");
      return;
    }
    if (state.mode === "univ" ? end <= start : end < start) {
      setError("종료 시간이 시작 시간보다 빠릅니다.");
      return;
    }
    setError(null);
    const used = new Set(state.courses.filter((c) => c.mode === state.mode).map((c) => c.color));
    let color = 0;
    while (used.has(color) && color < COLORS.length) color += 1;
    setState((s) => ({
      ...s,
      courses: [
        ...s.courses,
        { id: newId(), name: trimmed, place: place.trim(), mode: s.mode, day, start, end, color: color % COLORS.length },
      ],
    }));
    setName("");
    setPlace("");
  };

  const remove = (id: string) =>
    setState((s) => ({ ...s, courses: s.courses.filter((c) => c.id !== id) }));

  const recolor = (id: string) =>
    setState((s) => ({
      ...s,
      courses: s.courses.map((c) => (c.id === id ? { ...c, color: (c.color + 1) % COLORS.length } : c)),
    }));

  const clearAll = () => {
    if (!window.confirm("이 모드의 과목을 모두 지울까요?")) return;
    setState((s) => ({ ...s, courses: s.courses.filter((c) => c.mode !== s.mode) }));
  };

  const current = useMemo(
    () =>
      state.courses
        .filter((c) => c.mode === state.mode)
        .sort((a, b) => a.day - b.day || a.start - b.start),
    [state.courses, state.mode]
  );

  // 겹침 표시용 — 같은 요일에서 시간이 부딪치는 과목 id
  const clashing = useMemo(() => {
    const set = new Set<string>();
    for (const a of current) {
      for (const b of current) {
        if (a.id === b.id || a.day !== b.day) continue;
        const aEnd = state.mode === "univ" ? a.end : a.end + 1;
        const bEnd = state.mode === "univ" ? b.end : b.end + 1;
        if (a.start < bEnd && b.start < aEnd) set.add(a.id);
      }
    }
    return set;
  }, [current, state.mode]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}?d=${compressToEncodedURIComponent(
      JSON.stringify(state)
    )}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("공유 링크를 복사했습니다.");
    } catch {
      window.prompt("아래 링크를 복사하세요", url);
    }
  }, [state]);

  const savePng = async (kind: "wall" | "raw") => {
    const node = kind === "wall" ? wallRef.current : gridRef.current;
    if (!node) return;
    setBusy(true);
    setNotice(null);
    try {
      await downloadPng(
        node,
        kind === "wall" ? "studyroom-timetable-wallpaper.png" : "studyroom-timetable.png",
        kind === "wall"
          ? { width: WALLPAPER.width, height: WALLPAPER.height, pixelRatio: 1 }
          : { pixelRatio: 2 }
      );
    } catch {
      setNotice("이미지를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const wallRows = state.mode === "univ" ? UNIV_ROWS : PERIODS.length;
  const wallRowH = Math.min(160, Math.floor(1450 / wallRows));

  return (
    <div className="space-y-5">
      {shared && (
        <p className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">
          공유 링크의 시간표를 불러왔습니다. 여기서 바로 고치면 내 브라우저에 저장됩니다.
        </p>
      )}

      {/* 모드 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="시간표 모드">
          {(["univ", "school"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={state.mode === m}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                state.mode === m ? "bg-ink text-white" : "text-muted"
              }`}
            >
              {m === "univ" ? "대학" : "중고등"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={state.sat}
            onChange={(e) => setState((s) => ({ ...s, sat: e.target.checked }))}
            className="size-4"
          />
          토요일 표시
        </label>
      </div>

      {/* 입력 */}
      <div className="grid gap-2 rounded-xl bg-paper p-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="과목 이름"
          aria-label="과목 이름"
          maxLength={30}
          className="rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-ink sm:col-span-2"
        />
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="강의실 (선택)"
          aria-label="강의실"
          maxLength={20}
          className="rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-ink sm:col-span-2"
        />
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          aria-label="요일"
          className="rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-ink"
        >
          {DAYS.slice(0, state.sat ? 6 : 5).map((d, i) => (
            <option key={d} value={i}>
              {d}요일
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <select
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            aria-label="시작"
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-2 text-[15px] outline-none focus:border-ink"
          >
            {state.mode === "univ"
              ? UNIV_TIMES.slice(0, -1).map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))
              : PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}교시
                  </option>
                ))}
          </select>
          <span className="text-muted">~</span>
          <select
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            aria-label="종료"
            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-2 text-[15px] outline-none focus:border-ink"
          >
            {state.mode === "univ"
              ? UNIV_TIMES.slice(1).map((m) => (
                  <option key={m} value={m}>
                    {fmtMin(m)}
                  </option>
                ))
              : PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}교시
                  </option>
                ))}
          </select>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-ink px-4 py-2 text-[15px] font-medium text-white sm:col-span-2"
        >
          과목 추가
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {error}
          </p>
        )}
      </div>

      {/* 시간표 */}
      <div ref={gridRef} className="overflow-hidden rounded-xl border border-line bg-white p-2">
        <Grid state={state} rowH={22} fontSize={11} gutter={26} headerH={26} />
      </div>

      {/* 동작 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => savePng("wall")}
          disabled={busy || !current.length}
          className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "배경화면 저장 (1080×1920)"}
        </button>
        <button
          type="button"
          onClick={() => savePng("raw")}
          disabled={busy || !current.length}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          원본 비율로 저장
        </button>
        <button
          type="button"
          onClick={share}
          disabled={!current.length}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          공유 링크 복사
        </button>
        {current.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted"
          >
            전체 삭제
          </button>
        )}
      </div>
      {notice && <p className="text-sm text-muted">{notice}</p>}

      {/* 목록 */}
      {current.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {current.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => recolor(c.id)}
                aria-label={`${c.name} 색 바꾸기`}
                className="size-5 flex-shrink-0 rounded"
                style={{ background: COLORS[c.color % COLORS.length].bg, border: `2px solid ${COLORS[c.color % COLORS.length].fg}` }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {c.name}
                  {clashing.has(c.id) && (
                    <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">겹침</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted">
                  {DAYS[c.day]} {label(c, state.mode)}
                  {c.place ? ` · ${c.place}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label={`${c.name} 삭제`}
                className="flex-shrink-0 rounded px-2 py-1 text-sm text-muted hover:text-ink"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {loaded && !current.length && (
        <p className="text-sm text-muted">아직 과목이 없습니다. 위에서 첫 과목을 추가해 보세요.</p>
      )}

      {/* 배경화면용 캡처 노드 (화면 밖) */}
      <div style={offscreen} aria-hidden="true">
        <div ref={wallRef} style={{ width: WALLPAPER.width, height: WALLPAPER.height }}>
          <div
          style={{
            width: "100%",
            height: "100%",
            background: "#fff",
            padding: 56,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: "#16181d" }}>시간표</div>
          <div style={{ marginTop: 10, fontSize: 30, color: "#6b7280" }}>
            {state.mode === "univ" ? "대학 시간표" : "중고등 시간표"} · {current.length}과목
          </div>
          <div style={{ marginTop: 36, flex: 1 }}>
            <Grid state={state} rowH={wallRowH} fontSize={26} gutter={54} headerH={62} />
          </div>
          <div style={{ fontSize: 26, color: "#9ca3af", textAlign: "right" }}>studyroom.kr</div>
          </div>
        </div>
      </div>
    </div>
  );
}
