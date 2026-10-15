"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
// react-easy-crop 은 자체 CSS 를 반드시 함께 불러와야 크롭 영역이 올바르게 배치된다.
import "react-easy-crop/react-easy-crop.css";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import GuideOverlay from "./GuideOverlay";
import { DPI, specPixels, type PhotoSpec } from "@/data/specs";
import {
  canvasToBlob,
  canvasToJpeg300,
  compositeOnColor,
  loadImage,
  renderSpecCanvas,
  rotateImageUrl,
} from "@/lib/imaging";
import { extractMask, pickBackend, type BgProgress } from "@/lib/bgRemove";
import { bestLayout, buildPrintPdf, countOptions, SHEETS, type SheetId } from "@/lib/printLayout";
import { detectWebGPU, isMobile } from "@/lib/capability";

type Step = "pick" | "edit";

const btn =
  "rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const btnDark = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

export default function IdPhotoEditor({ spec }: { spec: PhotoSpec }) {
  const out = useMemo(() => specPixels(spec), [spec]);
  const aspect = spec.mm.w / spec.mm.h;

  const [step, setStep] = useState<Step>("pick");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [workUrl, setWorkUrl] = useState<string | null>(null);
  const [bgApplied, setBgApplied] = useState(false);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bgProg, setBgProg] = useState<BgProgress | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);

  const [sheetId, setSheetId] = useState<SheetId>("4x6");
  const [count, setCount] = useState<number | null>(null);
  const [cutLines, setCutLines] = useState(true);

  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  const madeUrls = useRef<string[]>([]);

  /* 만든 objectURL 정리 */
  useEffect(() => {
    const urls = madeUrls.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  const track = (u: string) => {
    madeUrls.current.push(u);
    return u;
  };

  /* 크롭 박스 크기 — 컨테이너 폭에 맞춰 규격 비율 유지 (320px 폭에서도 안 깨지게) */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setBoxW(entries[0].contentRect.width);
    });
    ro.observe(el);
    setBoxW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [step]);

  const stageH = boxW > 0 ? Math.min(460, Math.max(260, boxW * 1.05)) : 320;
  const cropSize = useMemo(() => {
    if (boxW <= 0) return { width: 180, height: 180 / aspect };
    const maxH = stageH - 32;
    const maxW = boxW - 48;
    let h = maxH;
    let w = h * aspect;
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }, [boxW, aspect, stageH]);

  /* ── 파일 선택 ── */
  const onFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    const url = track(URL.createObjectURL(f));
    setOriginalUrl(url);
    setWorkUrl(url);
    setBgApplied(false);
    setBgError(null);
    setBgProg(null);
    setPreviewUrl(null);
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setStep("edit");
  }, []);

  /* ── 미리보기 (디바운스) ── */
  useEffect(() => {
    if (!workUrl || !area) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const canvas = await renderSpecCanvas({
          src: workUrl,
          crop: area,
          outW: out.w,
          outH: out.h,
          bgColor: spec.bgColor,
          brightness,
          contrast,
        });
        if (cancelled) return;
        setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        /* 미리보기 실패는 무시 — 저장은 다시 시도한다 */
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [workUrl, area, out.w, out.h, spec.bgColor, brightness, contrast]);

  /* ── 회전 ── */
  async function rotate(deg: 90 | 270) {
    if (!workUrl) return;
    setBusy("사진을 회전하는 중…");
    try {
      const url = track(await rotateImageUrl(workUrl, deg));
      setWorkUrl(url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "회전에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  /* ── 배경 흰색화 (옵션) ── */
  async function whitenBackground() {
    if (!workUrl) return;
    setBgError(null);
    setBgProg({ percent: 0, label: "시작하는 중…" });
    try {
      const mask = await extractMask(workUrl, (p) => setBgProg(p));
      const img = await loadImage(workUrl);
      const canvas = compositeOnColor(img, mask.data, mask.width, mask.height, spec.bgColor);
      const blob = await canvasToBlob(canvas, "image/png");
      const url = track(URL.createObjectURL(blob));
      setWorkUrl(url);
      setBgApplied(true);
      setBgProg(null);
    } catch (e) {
      // 여기서 실패해도 나머지 기능은 계속 쓸 수 있어야 한다.
      setBgProg(null);
      setBgError(
        (e instanceof Error ? e.message : "알 수 없는 오류") +
          " — 배경 제거만 실패했습니다. 자르기·300dpi 저장·인화 배치는 그대로 사용할 수 있습니다.",
      );
    }
  }

  function undoBackground() {
    if (!originalUrl) return;
    setWorkUrl(originalUrl);
    setBgApplied(false);
    setBgError(null);
  }

  /* ── 300dpi JPG 저장 ── */
  async function download() {
    if (!workUrl || !area) return;
    setBusy("300dpi 파일을 만드는 중…");
    setError(null);
    try {
      const canvas = await renderSpecCanvas({
        src: workUrl,
        crop: area,
        outW: out.w,
        outH: out.h,
        bgColor: spec.bgColor,
        brightness,
        contrast,
      });
      const blob = await canvasToJpeg300(canvas, DPI, 0.94);
      saveBlob(blob, `${spec.slug}_${spec.mm.w}x${spec.mm.h}mm_300dpi.jpg`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  /* ── 인화 배치 PDF ── */
  const sheet = SHEETS.find((s) => s.id === sheetId)!;
  const maxLayout = useMemo(() => bestLayout(sheet, spec.mm), [sheet, spec.mm]);
  const options = useMemo(() => countOptions(maxLayout.count), [maxLayout.count]);
  const activeCount = count ?? Math.min(maxLayout.count, options[options.length - 1] ?? 0);
  const chosenLayout = useMemo(
    () => bestLayout(sheet, spec.mm, activeCount),
    [sheet, spec.mm, activeCount],
  );

  async function makePdf() {
    if (!workUrl || !area) return;
    setBusy("인화 배치 PDF 를 만드는 중…");
    setError(null);
    try {
      const canvas = await renderSpecCanvas({
        src: workUrl,
        crop: area,
        outW: out.w,
        outH: out.h,
        bgColor: spec.bgColor,
        brightness,
        contrast,
      });
      const jpeg = await canvasToJpeg300(canvas, DPI, 0.94);
      const pdf = await buildPrintPdf({
        jpeg,
        sheet,
        photoMm: spec.mm,
        count: activeCount,
        cutLines,
      });
      saveBlob(pdf, `${spec.slug}_${sheet.id}_${activeCount}컷.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF 생성에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  const backend = typeof window === "undefined" ? "wasm" : pickBackend();

  /* ─────────────────────────── 렌더 ─────────────────────────── */

  return (
    <div className="space-y-5">
      <SpecCard spec={spec} out={out} />

      {step === "pick" ? (
        <FileDrop
          accept="image/*"
          extensions={["jpg", "jpeg", "png", "webp", "bmp"]}
          multiple={false}
          maxSizeMB={30}
          onFiles={onFiles}
          hint="JPG · PNG · WEBP · 정면을 보고 찍은 밝은 사진이 가장 잘 나옵니다"
        />
      ) : (
        <>
          {/* 크롭 영역 */}
          <div>
            <div
              ref={boxRef}
              className="relative w-full overflow-hidden rounded-xl bg-slate-800"
              style={{ height: stageH }}
            >
              {workUrl ? (
                <Cropper
                  image={workUrl}
                  crop={crop}
                  zoom={zoom}
                  minZoom={0.4}
                  maxZoom={5}
                  aspect={aspect}
                  cropSize={cropSize}
                  restrictPosition={false}
                  showGrid={false}
                  objectFit="contain"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_a, px) => setArea(px)}
                />
              ) : null}
              {showGuide ? (
                <GuideOverlay spec={spec} width={cropSize.width} height={cropSize.height} />
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              사진을 끌어서 옮기고 확대/축소로 크기를 맞춥니다. 정수리가 파란 점선에, 턱이 옅은 파란
              띠 안에 오면 머리 길이 {spec.head.min}~{spec.head.max}mm 조건을 만족합니다.
            </p>
          </div>

          {/* 조작 */}
          <div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
            <Slider
              id="zoom"
              label="확대"
              min={0.4}
              max={5}
              step={0.01}
              value={zoom}
              onChange={setZoom}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Slider
              id="bright"
              label="밝기"
              min={-40}
              max={40}
              step={1}
              value={brightness}
              onChange={setBrightness}
              format={(v) => (v > 0 ? `+${v}` : `${v}`)}
            />
            <Slider
              id="contrast"
              label="대비"
              min={-40}
              max={40}
              step={1}
              value={contrast}
              onChange={setContrast}
              format={(v) => (v > 0 ? `+${v}` : `${v}`)}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} onClick={() => rotate(270)} aria-label="왼쪽으로 90도 회전">
                ↺ 왼쪽 회전
              </button>
              <button type="button" className={btnGhost} onClick={() => rotate(90)} aria-label="오른쪽으로 90도 회전">
                ↻ 오른쪽 회전
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setShowGuide((v) => !v)}
                aria-label={showGuide ? "얼굴 가이드 끄기" : "얼굴 가이드 켜기"}
              >
                {showGuide ? "가이드 끄기" : "가이드 켜기"}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setStep("pick");
                  setOriginalUrl(null);
                  setWorkUrl(null);
                  setPreviewUrl(null);
                  setArea(null);
                  setBgApplied(false);
                  setBgError(null);
                }}
                aria-label="다른 사진 선택"
              >
                다른 사진 선택
              </button>
            </div>
          </div>

          {/* 배경 흰색화 (옵션) */}
          <section className="rounded-xl border border-slate-200 p-3 sm:p-4">
            <h3 className="text-sm font-bold text-slate-900">배경 흰색으로 바꾸기 (선택)</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              브라우저에서 RMBG-1.4 분리 모델(약 40MB)을 내려받아 인물과 배경을 나눈 뒤 배경만 흰색으로 칠합니다.
              모델은 이 버튼을 눌렀을 때만 받고, 실패하더라도 자르기·300dpi 저장·인화 배치는 그대로
              동작합니다.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              실행 방식:{" "}
              {backend === "webgpu" ? (
                <strong className="text-slate-700">WebGPU (빠름)</strong>
              ) : (
                <strong className="text-amber-700">WASM 폴백 — 느릴 수 있습니다</strong>
              )}
              {isMobile() ? " · 모바일에서는 PC보다 오래 걸립니다." : null}
              {!detectWebGPU()
                ? " 최신 크롬·엣지에서 열면 WebGPU 로 훨씬 빨라집니다."
                : null}
            </p>

            {bgProg ? (
              <div className="mt-3">
                <Progress value={bgProg.percent} label={bgProg.label} />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={whitenBackground}
                  disabled={bgApplied}
                  aria-label="배경을 흰색으로 바꾸기"
                >
                  {bgApplied ? "배경 적용됨" : "배경 흰색으로 바꾸기"}
                </button>
                {bgApplied ? (
                  <button type="button" className={btnGhost} onClick={undoBackground} aria-label="원본 배경으로 되돌리기">
                    원본으로 되돌리기
                  </button>
                ) : null}
              </div>
            )}

            {bgError ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800" role="alert">
                {bgError}
              </p>
            ) : null}
          </section>

          {/* 미리보기 + 저장 */}
          <section className="rounded-xl border border-slate-200 p-3 sm:p-4">
            <h3 className="text-sm font-bold text-slate-900">미리보기 · 저장</h3>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <div
                  className="overflow-hidden rounded-md border border-slate-300 bg-white"
                  style={{ width: 132, height: Math.round(132 / aspect) }}
                >
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`${spec.name} 미리보기`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      준비 중…
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {spec.sizeLabel.split(" (")[0]} · {out.w}×{out.h}px
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs leading-relaxed text-slate-600">
                  저장 파일은 {out.w} × {out.h} px 이고 JPEG 헤더에 300dpi 해상도 정보를 심어 둡니다.
                  인화소에 넘길 때 &quot;원본 크기·무보정&quot; 으로 요청하면 규격 그대로 나옵니다.
                </p>
                <button
                  type="button"
                  className={btnDark}
                  onClick={download}
                  disabled={!area || busy !== null}
                  aria-label="300dpi JPG 파일 저장"
                >
                  300dpi JPG 저장
                </button>
              </div>
            </div>
          </section>

          {/* 인화 배치 */}
          <section className="rounded-xl border border-slate-200 p-3 sm:p-4">
            <h3 className="text-sm font-bold text-slate-900">인화 배치 PDF</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">용지</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={sheetId}
                  onChange={(e) => {
                    setSheetId(e.target.value as SheetId);
                    setCount(null);
                  }}
                  aria-label="인화 용지 선택"
                >
                  {SHEETS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  컷 수 (최대 {maxLayout.count}컷)
                </span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={activeCount}
                  onChange={(e) => setCount(Number(e.target.value))}
                  aria-label="인화 컷 수 선택"
                >
                  {options.map((n) => (
                    <option key={n} value={n}>
                      {n}컷
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={cutLines}
                onChange={(e) => setCutLines(e.target.checked)}
                className="h-4 w-4"
              />
              재단선(자르는 선) 넣기
            </label>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              배치: {chosenLayout.cols}열 × {chosenLayout.rows}행
              {chosenLayout.rotated ? " · 규격을 눕혀서 배치" : " · 규격을 세워서 배치"} · 여백{" "}
              {chosenLayout.margin}mm · 간격 {chosenLayout.gap}mm. 인쇄할 때 배율을 반드시
              100%(실제 크기)로 두세요.
            </p>

            <button
              type="button"
              className={`${btnDark} mt-3`}
              onClick={makePdf}
              disabled={!area || busy !== null || maxLayout.count === 0}
              aria-label="인화 배치 PDF 만들기"
            >
              {sheet.id === "4x6" ? "4×6인치" : "A4"} {activeCount}컷 PDF 만들기
            </button>
          </section>
        </>
      )}

      {busy ? (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700" role="status" aria-live="polite">
          {busy}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ─────────────────── 보조 컴포넌트 ─────────────────── */

function SpecCard({ spec, out }: { spec: PhotoSpec; out: { w: number; h: number } }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900">{spec.name} 규격</h2>
        {spec.verified ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            공식 출처 확인
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
            ⚠️ 확인 필요
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        <Row k="인쇄 크기" v={spec.sizeLabel} />
        <Row k="300dpi 픽셀" v={`${out.w} × ${out.h} px`} />
        <Row k="머리 길이" v={`${spec.head.min} ~ ${spec.head.max} mm (정수리~턱)`} />
        <Row
          k="세로 대비 비율"
          v={`${Math.round(spec.headRatio.min * 100)} ~ ${Math.round(spec.headRatio.max * 100)}%`}
        />
        <Row k="배경" v={spec.bgLabel} />
        <Row
          k="눈높이"
          v={
            spec.eyeFromBottom
              ? `아래에서 ${spec.eyeFromBottom.min} ~ ${spec.eyeFromBottom.max} mm`
              : "공식 수치 없음 (참고선)"
          }
        />
      </dl>

      {!spec.verified && spec.verifyNote ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
          {spec.verifyNote}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-600">
        {spec.notes.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 flex-1 font-medium text-slate-800">{v}</dd>
    </div>
  );
}

function Slider({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600"
        aria-label={label}
      />
    </div>
  );
}
