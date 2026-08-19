"use client";

import { useCallback, useState } from "react";
import FileDrop from "@/components/FileDrop";
import Progress from "@/components/Progress";
import { saveBlob } from "@/components/DownloadButton";
import {
  baseName,
  embedKoreanFont,
  fileBytes,
  formatBytes,
  openPdfLib,
  parsePageRanges,
  pdfBlob,
  yieldToUi,
} from "@/lib/pdf";
import { Btn, ErrorBox, Field, Notice, ResultBox, inputCls } from "@/tools/ui";

type Kind = "text" | "image";

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.7, 0.1, 0.1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function Watermark() {
  const [file, setFile] = useState<File | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("대외비");
  const [size, setSize] = useState(48);
  const [opacity, setOpacity] = useState(0.25);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState("#c81e1e");
  const [tile, setTile] = useState(false);
  const [imgScale, setImgScale] = useState(0.4);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const [result, setResult] = useState<Blob | null>(null);

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0] ?? null);
    setResult(null);
    setError("");
  }, []);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError("");
    setWarn("");
    setResult(null);
    setProgress(0);
    try {
      const { degrees, rgb } = await import("pdf-lib");
      const doc = await openPdfLib(await fileBytes(file));
      const pages = doc.getPages();
      const indices = parsePageRanges(range, pages.length);

      let font: Awaited<ReturnType<typeof embedKoreanFont>> | null = null;
      let image: Awaited<ReturnType<typeof doc.embedPng>> | null = null;

      if (kind === "text") {
        if (!text.trim()) throw new Error("워터마크로 넣을 문구를 입력해 주세요.");
        font = await embedKoreanFont(doc);
        const missing = font.missingChars(text);
        if (missing.length > 0) {
          if (!font.korean) {
            throw new Error(
              `한글 폰트를 불러오지 못해 "${missing.slice(0, 6).join("")}" 같은 글자를 넣을 수 없습니다. 페이지를 새로고침한 뒤 다시 시도하거나, 영문·숫자만으로 문구를 작성해 주세요.`,
            );
          }
          throw new Error(
            `내장 한글 폰트(KS X 1001 서브셋)에 없는 글자가 있습니다: ${missing.join(" ")} — 한자·특수기호·희귀 음절은 지원하지 않습니다. 해당 글자를 빼고 다시 시도해 주세요. (깨진 글자를 그대로 내보내지 않기 위해 중단했습니다)`,
          );
        }
      } else {
        if (!imgFile) throw new Error("워터마크로 쓸 이미지를 선택해 주세요.");
        const bytes = await fileBytes(imgFile);
        const isPng =
          imgFile.type === "image/png" || /\.png$/i.test(imgFile.name);
        image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      }

      const [r, g, b] = hexToRgb(color);
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      for (let k = 0; k < indices.length; k++) {
        const page = pages[indices[k]];
        const { width: pw, height: ph } = page.getSize();

        if (kind === "text" && font) {
          const pdfFont = font.font;
          const tw = pdfFont.widthOfTextAtSize(text, size);
          const th = pdfFont.heightAtSize(size);
          const put = (cx: number, cy: number) => {
            const x = cx - (tw / 2) * cos + (th / 2) * sin;
            const y = cy - (tw / 2) * sin - (th / 2) * cos;
            page.drawText(text, {
              x,
              y,
              size,
              font: pdfFont,
              color: rgb(r, g, b),
              opacity,
              rotate: degrees(angle),
            });
          };
          if (tile) {
            const stepX = Math.max(60, tw * Math.abs(cos) + th * Math.abs(sin) + size * 1.2);
            const stepY = Math.max(50, tw * Math.abs(sin) + th * Math.abs(cos) + size * 1.2);
            for (let y = stepY / 2; y < ph + stepY; y += stepY) {
              for (let x = stepX / 2; x < pw + stepX; x += stepX) put(x, y);
            }
          } else {
            put(pw / 2, ph / 2);
          }
        } else if (image) {
          const pdfImage = image;
          const w = pw * imgScale;
          const h = (pdfImage.height / pdfImage.width) * w;
          const put = (cx: number, cy: number) => {
            const x = cx - (w / 2) * cos + (h / 2) * sin;
            const y = cy - (w / 2) * sin - (h / 2) * cos;
            page.drawImage(pdfImage, {
              x,
              y,
              width: w,
              height: h,
              opacity,
              rotate: degrees(angle),
            });
          };
          if (tile) {
            const stepX = Math.max(60, w * Math.abs(cos) + h * Math.abs(sin) + 24);
            const stepY = Math.max(50, w * Math.abs(sin) + h * Math.abs(cos) + 24);
            for (let y = stepY / 2; y < ph + stepY; y += stepY) {
              for (let x = stepX / 2; x < pw + stepX; x += stepX) put(x, y);
            }
          } else {
            put(pw / 2, ph / 2);
          }
        }

        setProgress(Math.round(((k + 1) / indices.length) * 100));
        if (k % 10 === 9) await yieldToUi();
      }

      if (kind === "text" && font && !font.korean) {
        setWarn("한글 폰트를 불러오지 못해 기본 라틴 폰트로 처리했습니다.");
      }
      const saved = await doc.save({ useObjectStreams: true });
      setResult(pdfBlob(saved));
    } catch (e) {
      setError((e as Error)?.message ?? "워터마크를 넣는 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FileDrop
        extensions={["pdf"]}
        accept="application/pdf,.pdf"
        multiple={false}
        maxSizeMB={200}
        onFiles={onFiles}
        hint="워터마크를 넣을 PDF 1개를 선택하세요"
      />

      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-sm font-medium text-slate-700">워터마크 종류</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="wm-kind"
            checked={kind === "text"}
            onChange={() => {
              setKind("text");
              setResult(null);
            }}
          />
          텍스트 (한글 가능)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="wm-kind"
            checked={kind === "image"}
            onChange={() => {
              setKind("image");
              setResult(null);
            }}
          />
          이미지 (로고·도장)
        </label>
      </fieldset>

      {kind === "text" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="문구" htmlFor="wm-text" hint="한글·영문·숫자 (한자는 지원하지 않습니다)">
            <input
              id="wm-text"
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              className={inputCls}
              maxLength={60}
            />
          </Field>
          <Field label="글자 크기 (pt)" htmlFor="wm-size">
            <input
              id="wm-size"
              type="number"
              min={8}
              max={200}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="색상" htmlFor="wm-color">
            <input
              id="wm-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300"
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <FileDrop
            extensions={["png", "jpg", "jpeg"]}
            accept="image/png,image/jpeg"
            multiple={false}
            maxSizeMB={20}
            onFiles={(f) => {
              setImgFile(f[0] ?? null);
              setResult(null);
            }}
            hint="PNG(투명 배경 권장) 또는 JPG 로고 이미지"
          />
          <Field label={`가로 크기 — 페이지 폭의 ${Math.round(imgScale * 100)}%`} htmlFor="wm-iscale">
            <input
              id="wm-iscale"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={imgScale}
              onChange={(e) => setImgScale(Number(e.target.value))}
              className="w-full"
            />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`투명도 — ${Math.round(opacity * 100)}%`} htmlFor="wm-op">
          <input
            id="wm-op"
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full"
          />
        </Field>
        <Field label={`기울기 — ${angle}°`} htmlFor="wm-angle">
          <input
            id="wm-angle"
            type="range"
            min={0}
            max={90}
            step={5}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-full"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} />
        페이지 전체에 반복(타일)해서 넣기
      </label>

      <Field label="적용할 페이지" htmlFor="wm-range" hint="비우면 전체. 예: 1,3-5">
        <input
          id="wm-range"
          type="text"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="전체"
          className={inputCls}
        />
      </Field>

      <Btn onClick={run} disabled={busy || !file}>
        {busy ? "처리 중…" : "워터마크 넣기"}
      </Btn>

      {busy && <Progress value={progress} label="워터마크 삽입 중" />}
      <ErrorBox>{error}</ErrorBox>
      {warn && <Notice tone="warn">{warn}</Notice>}

      {result && (
        <ResultBox>
          <p className="text-sm text-slate-700">완료 — {formatBytes(result.size)}</p>
          <Btn
            onClick={() => saveBlob(result, `${baseName(file?.name ?? "pdf")}_워터마크.pdf`)}
          >
            다운로드
          </Btn>
        </ResultBox>
      )}

      <Notice title="한글이 들어가는 원리">
        PDF 표준 14종 기본 글꼴(Helvetica 등)에는 한글 글리프가 아예 없어서, 그대로 넣으면 글자가
        비거나 깨집니다. 이 도구는 Pretendard 를 KS X 1001(한글 2,350자) 로 서브셋한 폰트 파일을
        문서에 <b>임베딩</b>한 뒤 그 글꼴로 그립니다. 실제로 쓰인 글자만 다시 추려 넣기 때문에
        늘어나는 용량은 보통 수 KB 수준입니다.
      </Notice>

      <Notice tone="warn">
        여기서 넣는 워터마크는 페이지 위에 그려지는 <b>시각적 표시</b>이며 복사 방지 기능이
        아닙니다. 편집 도구로 지울 수 있으므로 법적 보호 수단으로 삼지 마세요.
      </Notice>
    </div>
  );
}
