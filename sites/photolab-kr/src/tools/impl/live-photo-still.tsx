"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob, saveFiles, type DownloadFile } from "@/components/DownloadButton";
import { canvasToBlob } from "@/lib/image";
import { formatBytes, replaceExt, uniqueName, yieldToUI, type OutFormat } from "@/lib/image-core";
import {
  ManyFilesWarning,
  Notice,
  NumberField,
  PrivacyNote,
  ResultTable,
  RunButton,
  Select,
  Slider,
  type ResultRow,
} from "./_ui";

const CODEC_HELP =
  "동영상을 재생하지 못했습니다. 아이폰 라이브포토의 .MOV 는 HEVC(H.265)로 저장되는 경우가 많고, 이 코덱은 브라우저·운영체제에 따라 지원되지 않습니다. 아이폰·아이패드·맥의 사파리에서 다시 시도하거나, 윈도우 크롬이라면 'HEVC 비디오 확장' 설치 후 다시 시도해 보세요.";

/** 동영상 파일에서 지정한 시각의 프레임 1장을 캔버스로 캡처한다 */
function captureFrame(
  file: File,
  seconds: number,
  format: OutFormat,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let done = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    const fail = (msg: string) => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(msg));
    };

    video.onerror = () => fail(CODEC_HELP);
    video.onloadeddata = () => {
      const t = Math.max(0, Math.min(seconds, Math.max(0, (video.duration || 0) - 0.05)));
      if (Math.abs(video.currentTime - t) < 0.001) void draw();
      else video.currentTime = t;
    };
    const draw = async () => {
      if (done) return;
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error(CODEC_HELP);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");
        ctx.drawImage(video, 0, 0, w, h);
        const blob = await canvasToBlob(canvas, format, quality);
        done = true;
        cleanup();
        resolve({ blob, width: w, height: h });
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    };
    video.onseeked = () => void draw();
    setTimeout(() => fail("동영상을 읽는 데 시간이 너무 오래 걸립니다. " + CODEC_HELP), 30000);
    video.src = url;
  });
}

export default function LivePhotoStill() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<OutFormat>("image/jpeg");
  const [quality, setQuality] = useState(92);

  // 단일 파일 미리보기
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [shot, setShot] = useState<{ url: string; blob: Blob; w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 다중 파일 배치
  const [atSeconds, setAtSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [batch, setBatch] = useState<{ name: string; blob: Blob | null; error: string | null }[] | null>(
    null,
  );

  const single = files.length === 1;

  const onFiles = useCallback((f: File[]) => {
    setFiles(f);
    setBatch(null);
    setError(null);
    setShot(null);
    setDuration(0);
    setTime(0);
  }, []);

  useEffect(() => {
    if (!single) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(files[0]);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [files, single]);

  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  const grabFromPreview = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) throw new Error(CODEC_HELP);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스를 만들지 못했습니다.");
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await canvasToBlob(canvas, format, quality / 100);
      setShot((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), blob, w, h };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [format, quality]);

  function seekTo(t: number) {
    const video = videoRef.current;
    setTime(t);
    if (video) video.currentTime = Math.max(0, Math.min(t, Math.max(0, duration - 0.05)));
  }

  async function runBatch() {
    if (files.length === 0) return;
    setBusy(true);
    setBatch(null);
    setPct(0);
    const out: { name: string; blob: Blob | null; error: string | null }[] = [];
    for (let i = 0; i < files.length; i++) {
      setPct((i / files.length) * 100);
      try {
        const r = await captureFrame(files[i], atSeconds, format, quality / 100);
        out.push({ name: files[i].name, blob: r.blob, error: null });
      } catch (e) {
        out.push({
          name: files[i].name,
          blob: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      await yieldToUI();
    }
    setPct(100);
    setBatch(out);
    setBusy(false);
  }

  const ext = format === "image/png" ? "png" : "jpg";
  const batchOutputs: DownloadFile[] = (() => {
    const taken = new Set<string>();
    return (batch ?? [])
      .filter((b): b is { name: string; blob: Blob; error: null } => Boolean(b.blob))
      .map((b) => ({ name: uniqueName(taken, replaceExt(b.name, ext)), blob: b.blob }));
  })();

  const batchRows: ResultRow[] = (batch ?? []).map((b) => ({
    name: b.name,
    outName: replaceExt(b.name, ext),
    after: b.blob?.size,
    error: b.error,
  }));

  return (
    <div className="space-y-5">
      <FileDrop
        accept="video/*,.mov,.mp4,.m4v"
        extensions={["mov", "mp4", "m4v", "webm"]}
        multiple
        maxSizeMB={500}
        onFiles={onFiles}
        hint="라이브포토의 .MOV 또는 일반 동영상 (아이폰: 사진 앱에서 '동영상으로 저장' 후 사용)"
      />
      <ManyFilesWarning count={files.length} />

      <Notice tone="info">
        아이폰 라이브포토는 <b>정지 사진(HEIC) + 3초 동영상(MOV)</b> 두 파일로 저장됩니다. 아이폰에서
        내보내면 보통 두 파일이 함께 나오는데, 이 도구는 그중 <b>MOV 에서 원하는 순간</b>을 골라 사진
        한 장으로 뽑아 줍니다. 정지 사진 쪽(HEIC)만 필요하다면 HEIC JPG 변환 도구를 쓰세요.
      </Notice>

      <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <Select
          label="저장 형식"
          value={format}
          onChange={setFormat}
          options={[
            { value: "image/jpeg", label: "JPG" },
            { value: "image/png", label: "PNG (무손실)" },
          ]}
        />
        {format === "image/jpeg" ? (
          <Slider label="품질" value={quality} min={50} max={100} onChange={setQuality} />
        ) : null}
      </div>

      {single && url ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            src={url}
            muted
            playsInline
            preload="auto"
            controls
            className="w-full rounded-xl border border-slate-200 bg-black"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuration(Number.isFinite(v.duration) ? v.duration : 0);
              setError(null);
            }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onError={() => setError(CODEC_HELP)}
          />
          {duration > 0 ? (
            <>
              <Slider
                label="추출할 시점"
                value={time}
                min={0}
                max={Math.max(0.05, duration)}
                step={0.03}
                onChange={seekTo}
                format={(v) => `${v.toFixed(2)}초 / ${duration.toFixed(2)}초`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => seekTo(0)}
                  aria-label="첫 프레임으로 이동"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  첫 프레임
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(duration / 2)}
                  aria-label="가운데 프레임으로 이동"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  가운데
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(Math.max(0, duration - 0.05))}
                  aria-label="마지막 프레임으로 이동"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  마지막
                </button>
              </div>
            </>
          ) : null}

          <RunButton onClick={grabFromPreview} disabled={!!error}>
            이 장면을 사진으로 저장
          </RunButton>

          {error ? <Notice tone="error">{error}</Notice> : null}

          {shot ? (
            <div className="space-y-2 rounded-xl border border-slate-200 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.url}
                alt="추출된 정지 사진 미리보기"
                className="mx-auto max-h-80 w-auto max-w-full rounded-lg"
              />
              <p className="text-center text-sm text-slate-600">
                {shot.w} × {shot.h} px · {formatBytes(shot.blob.size)}
              </p>
              <button
                type="button"
                onClick={() => saveBlob(shot.blob, replaceExt(files[0].name, ext))}
                aria-label="추출한 사진 저장"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                사진 저장
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {files.length > 1 ? (
        <div className="space-y-4">
          <NumberField
            label="추출 시점"
            value={atSeconds}
            onChange={setAtSeconds}
            min={0}
            step={0.1}
            suffix="초"
            hint="0 이면 첫 프레임입니다. 동영상 길이보다 길면 마지막 프레임을 뽑습니다."
          />
          <RunButton onClick={runBatch} busy={busy}>
            {files.length}개에서 한 장씩 추출
          </RunButton>
          {busy ? <Progress value={pct} label="프레임 추출 중" /> : null}
          {batch ? (
            <div className="space-y-3">
              <ResultTable rows={batchRows} />
              <button
                type="button"
                onClick={() => saveFiles(batchOutputs, "live-photo-stills.zip")}
                disabled={batchOutputs.length === 0}
                aria-label="추출한 사진 모두 저장"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-300 sm:w-auto"
              >
                {batchOutputs.length > 1 ? `ZIP 으로 ${batchOutputs.length}개 저장` : "저장"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <PrivacyNote />
    </div>
  );
}
