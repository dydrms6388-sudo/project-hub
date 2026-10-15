"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { newId, useLocalStorage } from "@/lib/storage";
import { downloadPng, offscreen, WALLPAPER } from "@/lib/saveImage";
import { kstDay, kstDayOf, prettyDate } from "@/lib/kst";

type Exam = { id: string; name: string; date: string }; // date: YYYY-MM-DD

const label = (diff: number) => (diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${-diff}`);

export default function ExamDday() {
  const [exams, setExams, loaded] = useLocalStorage<Exam[]>("studyroom:exam-dday", []);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 오늘 날짜는 서버 렌더 결과와 어긋날 수 있으므로 마운트 후에 정한다.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setToday(kstDay(Date.now()));
    tick();
    // 자정을 넘겨도 숫자가 맞도록 1분마다 다시 센다.
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const wallRef = useRef<HTMLDivElement>(null);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("시험 이름을 입력하세요.");
      return;
    }
    if (kstDayOf(date) === null) {
      setError("시험 날짜를 선택하세요.");
      return;
    }
    setError(null);
    setExams((list) => [...list, { id: newId(), name: trimmed, date }]);
    setName("");
    setDate("");
  };

  const remove = (id: string) => setExams((list) => list.filter((e) => e.id !== id));

  /** 가까운 시험 먼저, 지난 시험은 최근 것부터 뒤에 */
  const sorted = useMemo(() => {
    if (today === null) return [];
    return exams
      .map((e) => ({ ...e, diff: (kstDayOf(e.date) ?? today) - today }))
      .sort((a, b) => {
        const aPast = a.diff < 0;
        const bPast = b.diff < 0;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return aPast ? b.diff - a.diff : a.diff - b.diff;
      });
  }, [exams, today]);

  const upcoming = sorted.filter((e) => e.diff >= 0);

  const saveWallpaper = async () => {
    if (!wallRef.current) return;
    setBusy(true);
    setNotice(null);
    try {
      await downloadPng(wallRef.current, "studyroom-dday-wallpaper.png", {
        width: WALLPAPER.width,
        height: WALLPAPER.height,
        pixelRatio: 1,
      });
    } catch {
      setNotice("이미지를 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const wallList = (upcoming.length ? upcoming : sorted).slice(0, 5);

  return (
    <div className="space-y-5">
      {/* 입력 */}
      <div className="grid gap-2 rounded-xl bg-paper p-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="시험 이름 (예: 2학기 중간고사)"
          aria-label="시험 이름"
          maxLength={30}
          className="min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-ink"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="시험 날짜"
          className="min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-[15px] outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-ink px-4 py-2 text-[15px] font-medium text-white"
        >
          추가
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-3">
            {error}
          </p>
        )}
      </div>

      {/* 카드 */}
      {today === null ? (
        <p className="text-sm text-muted">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        loaded && (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            아직 등록한 시험이 없습니다. 위에서 첫 시험을 추가해 보세요.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {sorted.map((e) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                e.diff < 0 ? "border-line bg-paper" : "border-line bg-white"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[15px] font-medium ${e.diff < 0 ? "text-muted" : "text-ink"}`}>
                  {e.name}
                </p>
                <p className="truncate text-sm text-muted">{prettyDate(e.date)}</p>
              </div>
              <span
                className={`flex-shrink-0 text-xl font-bold tabular-nums ${
                  e.diff < 0 ? "text-muted" : e.diff === 0 ? "text-red-700" : "text-ink"
                }`}
              >
                {label(e.diff)}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                aria-label={`${e.name} 삭제`}
                className="flex-shrink-0 rounded px-1.5 py-1 text-sm text-muted hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveWallpaper}
            disabled={busy}
            className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "만드는 중…" : "배경화면으로 저장 (1080×1920)"}
          </button>
          <span className="text-sm text-muted">가까운 {wallList.length}개가 담깁니다</span>
        </div>
      )}
      {notice && <p className="text-sm text-muted">{notice}</p>}

      <p className="text-xs text-muted">
        남은 날짜는 한국 시간(KST) 자정을 기준으로 셉니다. 등록한 시험은 이 브라우저에만 저장됩니다.
      </p>

      {/* 배경화면용 캡처 노드 (화면 밖) */}
      <div style={offscreen} aria-hidden="true">
        <div ref={wallRef} style={{ width: WALLPAPER.width, height: WALLPAPER.height }}>
          <div
          style={{
            width: "100%",
            height: "100%",
            background: "#16181d",
            color: "#fff",
            padding: 80,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 34, color: "#9ca3af", letterSpacing: 2 }}>D-DAY</div>
          <div // 잠금화면 시계가 위쪽을 차지하므로 카드는 가운데에 모은다.
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44 }}>
            {wallList.map((e) => (
              <div key={e.id}>
                <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>{label(e.diff)}</div>
                <div style={{ marginTop: 14, fontSize: 38, color: "#e5e7eb" }}>{e.name}</div>
                <div style={{ marginTop: 6, fontSize: 28, color: "#9ca3af" }}>{prettyDate(e.date)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 26, color: "#6b7280", textAlign: "right" }}>studyroom.kr</div>
          </div>
        </div>
      </div>
    </div>
  );
}
