"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bestTextOn,
  CVD_LABELS,
  CvdType,
  deltaE76,
  hexToRgb,
  RGB,
  rgbToHex,
  rgbToLab,
  simulateCvd,
} from "@/lib/color";
import { CopyChip, downloadPalettePng, Swatch, useQueryState } from "@/components/ui";

// ── 5. 이미지 팔레트 추출 (median cut, 전량 클라이언트 처리) ──
function medianCut(pixels: RGB[], count: number): RGB[] {
  type Box = RGB[];
  let boxes: Box[] = [pixels];
  while (boxes.length < count) {
    // 가장 큰 박스를 고른다
    boxes.sort((a, b) => b.length - a.length);
    const box = boxes.shift();
    if (!box || box.length < 2) {
      if (box) boxes.push(box);
      break;
    }
    // 범위가 가장 넓은 채널로 정렬 후 중앙 분할
    const ranges = (["r", "g", "b"] as const).map((ch) => {
      let min = 255, max = 0;
      for (const p of box) {
        if (p[ch] < min) min = p[ch];
        if (p[ch] > max) max = p[ch];
      }
      return { ch, range: max - min };
    });
    ranges.sort((a, b) => b.range - a.range);
    const ch = ranges[0].ch;
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.push(box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box) {
      r += p.r;
      g += p.g;
      b += p.b;
    }
    const n = box.length || 1;
    return { r: r / n, g: g / n, b: b / n };
  });
}

export function ImageExtractor() {
  const [palette, setPalette] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current ?? document.createElement("canvas");
      const scale = Math.min(1, 240 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixels: RGB[] = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // 투명 픽셀 제외
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
      const cols = medianCut(pixels, 6).map(rgbToHex);
      setPalette(cols);
      setPreview(url);
      setBusy(false);
    };
    img.src = url;
  }

  return (
    <div className="card">
      <p className="notice" style={{ marginTop: 0 }}>
        이미지는 <strong>브라우저 안에서만</strong> 처리되며 어떤 서버로도
        전송·저장되지 않습니다. 페이지를 닫으면 사라집니다.
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0])}
        aria-label="이미지 파일 선택"
      />
      {busy && <p className="muted">분석 중…</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="업로드한 이미지 미리보기"
          style={{
            maxWidth: "100%",
            maxHeight: 260,
            borderRadius: 10,
            marginTop: 12,
            border: "1px solid var(--line)",
          }}
        />
      )}
      {palette.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${palette.length}, 1fr)`,
              gap: 6,
              marginTop: 12,
            }}
          >
            {palette.map((c, i) => (
              <Swatch
                key={i}
                hex={c}
                height={58}
                textColor={bestTextOn(hexToRgb(c)!) + "cc"}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <CopyChip label="HEX 목록" value={palette.join(", ")} />
            <button
              type="button"
              className="btn"
              onClick={() => downloadPalettePng(palette, "image-palette")}
            >
              팔레트 PNG 다운로드
            </button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

// ── 6. 색각 이상 시뮬레이터 ────────────────────────────────
export function CvdSimulator() {
  const [listStr, setList] = useQueryState(
    "c",
    "#E34234,#FFD700,#228B22,#0047AB"
  );
  const [draft, setDraft] = useState("#800080");
  const colors = listStr
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => !!hexToRgb(s));

  return (
    <div className="card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(draft) ? draft : "#000000"}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          aria-label="추가할 색 선택"
        />
        <input
          type="text"
          value={draft}
          size={9}
          style={{ fontFamily: "ui-monospace, monospace" }}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="추가할 색 HEX"
        />
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (hexToRgb(draft) && colors.length < 8)
              setList([...colors, draft.toUpperCase()].join(","));
          }}
        >
          + 팔레트에 추가
        </button>
        <button type="button" className="btn" onClick={() => setList("")}>
          비우기
        </button>
      </div>

      {colors.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 90 }}>원본</th>
                {(Object.keys(CVD_LABELS) as CvdType[]).map((t) => (
                  <th key={t}>{CVD_LABELS[t].ko}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {colors.map((c, idx) => {
                const rgb = hexToRgb(c)!;
                return (
                  <tr key={`${c}-${idx}`}>
                    <td>
                      <Swatch hex={c} height={40} textColor={bestTextOn(rgb) + "cc"} />
                    </td>
                    {(Object.keys(CVD_LABELS) as CvdType[]).map((t) => {
                      const sim = rgbToHex(simulateCvd(rgb, t));
                      return (
                        <td key={t}>
                          <Swatch
                            hex={sim}
                            height={40}
                            textColor={bestTextOn(hexToRgb(sim)!) + "cc"}
                          />
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          setList(colors.filter((_, i) => i !== idx).join(","))
                        }
                        aria-label={`${c} 제거`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        구분이 필요한 색들(예: 차트 계열색)을 팔레트에 넣고, 세 유형 모두에서
        서로 구분되는지 확인하는 용도로 쓰세요. 팔레트 상태는 URL에 저장되어
        링크로 공유할 수 있습니다.
      </p>
    </div>
  );
}

// ── 9. 가까운 색 이름 찾기 ─────────────────────────────────
// CSS 표준 색상명. hex 값은 하드코딩하지 않고 브라우저의 색상명 해석
// (canvas fillStyle 정규화)으로 런타임에 얻는다.
const CSS_NAMES = [
  "aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black","blanchedalmond","blue","blueviolet","brown","burlywood","cadetblue","chartreuse","chocolate","coral","cornflowerblue","cornsilk","crimson","cyan","darkblue","darkcyan","darkgoldenrod","darkgray","darkgreen","darkkhaki","darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon","darkseagreen","darkslateblue","darkslategray","darkturquoise","darkviolet","deeppink","deepskyblue","dimgray","dodgerblue","firebrick","floralwhite","forestgreen","fuchsia","gainsboro","ghostwhite","gold","goldenrod","gray","green","greenyellow","honeydew","hotpink","indianred","indigo","ivory","khaki","lavender","lavenderblush","lawngreen","lemonchiffon","lightblue","lightcoral","lightcyan","lightgoldenrodyellow","lightgray","lightgreen","lightpink","lightsalmon","lightseagreen","lightskyblue","lightslategray","lightsteelblue","lightyellow","lime","limegreen","linen","magenta","maroon","mediumaquamarine","mediumblue","mediumorchid","mediumpurple","mediumseagreen","mediumslateblue","mediumspringgreen","mediumturquoise","mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite","navy","oldlace","olive","olivedrab","orange","orangered","orchid","palegoldenrod","palegreen","paleturquoise","palevioletred","papayawhip","peachpuff","peru","pink","plum","powderblue","purple","rebeccapurple","red","rosybrown","royalblue","saddlebrown","salmon","sandybrown","seagreen","seashell","sienna","silver","skyblue","slateblue","slategray","snow","springgreen","steelblue","tan","teal","thistle","tomato","turquoise","violet","wheat","white","whitesmoke","yellow","yellowgreen",
];

function resolveNamedColors(): { name: string; hex: string }[] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const out: { name: string; hex: string }[] = [];
  for (const name of CSS_NAMES) {
    ctx.fillStyle = "#000";
    ctx.fillStyle = name;
    const v = ctx.fillStyle; // 브라우저가 #rrggbb 로 정규화
    if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) {
      out.push({ name, hex: v.toUpperCase() });
    }
  }
  return out;
}

export function NameFinder() {
  const [c, setC] = useQueryState("c", "#37B6A0");
  const [named, setNamed] = useState<{ name: string; hex: string }[]>([]);
  useEffect(() => {
    setNamed(resolveNamedColors());
  }, []);

  const rgb = hexToRgb(c);
  const results = useMemo(() => {
    if (!rgb || named.length === 0) return [];
    const target = rgbToLab(rgb);
    return named
      .map((n) => ({
        ...n,
        dE: deltaE76(target, rgbToLab(hexToRgb(n.hex)!)),
      }))
      .sort((a, b) => a.dE - b.dE)
      .slice(0, 5);
  }, [rgb, named]);

  return (
    <div className="card">
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
        색
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : "#000000"}
          onChange={(e) => setC(e.target.value.toUpperCase())}
          aria-label="색 선택"
        />
        <input
          type="text"
          value={c}
          size={9}
          style={{ fontFamily: "ui-monospace, monospace" }}
          onChange={(e) => setC(e.target.value)}
          aria-label="HEX 입력"
        />
      </label>
      {rgb && results.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>CSS 색상명</th>
                <th>값</th>
                <th>미리보기</th>
                <th>색차 ΔE*ab</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontFamily: "ui-monospace, monospace" }}>{r.name}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace" }}>{r.hex}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <div style={{ background: c, width: 40, height: 24, borderRadius: 4, border: "1px solid var(--line)" }} title="입력한 색" />
                      <div style={{ background: r.hex, width: 40, height: 24, borderRadius: 4, border: "1px solid var(--line)" }} title={r.name} />
                    </div>
                  </td>
                  <td>{r.dE.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        입력한 색을 CIE LAB으로 변환한 뒤, CSS 표준 색상명 전체와의 색차
        ΔE*ab(CIE76)를 계산해 가장 가까운 5개를 보여줍니다. ΔE가 2.3 안팎이면
        일반적으로 구분이 어려운 차이로 봅니다.
      </p>
    </div>
  );
}
