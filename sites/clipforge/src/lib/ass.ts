/**
 * Cue[] → ASS(Advanced SubStation Alpha) 변환.
 *
 * ffmpeg 의 subtitles 필터는 libass 로 렌더링한다. SRT 를 그대로 넣으면 스타일을
 * force_style 문자열로만 바꿀 수 있어 제어가 거칠기 때문에, 스타일을 직접 지정한
 * ASS 를 만들어 넣는다. 좌표계는 PlayResX/PlayResY 기준이라 원본 해상도를 그대로
 * 넣어 주면 "글자 크기 = 픽셀 높이" 로 예측 가능해진다.
 */

import type { Cue } from "./subtitle";

export type SubPosition = "bottom" | "middle" | "top";

export type AssStyle = {
  fontName: string;
  /** PlayResY 기준 픽셀 */
  fontSize: number;
  /** #rrggbb */
  primaryColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  bold: boolean;
  position: SubPosition;
  /** 화면 가장자리로부터의 여백(px) */
  marginV: number;
  marginH: number;
  /** 배경 박스 (BorderStyle=3) */
  boxed: boolean;
  /** 박스/그림자 불투명도 0~1 */
  boxOpacity: number;
};

export const defaultAssStyle: AssStyle = {
  fontName: "Pretendard",
  fontSize: 64,
  primaryColor: "#ffffff",
  outlineColor: "#000000",
  outline: 3,
  shadow: 0,
  bold: true,
  position: "bottom",
  marginV: 90,
  marginH: 60,
  boxed: false,
  boxOpacity: 0.6,
};

/** #rrggbb + alpha(0~1, 1=불투명) → ASS 의 &HAABBGGRR */
export function toAssColor(hex: string, alpha = 1): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const rgb = m ? m[1] : "ffffff";
  const r = rgb.slice(0, 2);
  const g = rgb.slice(2, 4);
  const b = rgb.slice(4, 6);
  const a = Math.round((1 - Math.max(0, Math.min(1, alpha))) * 255)
    .toString(16)
    .padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

const ALIGN: Record<SubPosition, number> = { bottom: 2, middle: 5, top: 8 };

/** ms → "H:MM:SS.cc" (ASS 는 1/100초 단위) */
export function assTime(ms: number): string {
  const v = Math.max(0, Math.round(ms));
  const h = Math.floor(v / 3600000);
  const m = Math.floor((v % 3600000) / 60000);
  const s = Math.floor((v % 60000) / 1000);
  const cs = Math.round((v % 1000) / 10);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(Math.min(99, cs)).padStart(2, "0")}`;
}

function assText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N")
    .replace(/<\/?[bi]>/gi, "");
}

export function cuesToAss(cues: Cue[], style: AssStyle, playResX: number, playResY: number): string {
  const primary = toAssColor(style.primaryColor, 1);
  const outlineCol = toAssColor(style.outlineColor, 1);
  const back = toAssColor(style.outlineColor, style.boxed ? style.boxOpacity : 0);
  const borderStyle = style.boxed ? 3 : 1;
  const bold = style.bold ? -1 : 0;

  const head = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    `PlayResX: ${Math.round(playResX)}`,
    `PlayResY: ${Math.round(playResY)}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    [
      "Style: Default",
      style.fontName,
      String(Math.round(style.fontSize)),
      primary,
      "&H000000FF",
      outlineCol,
      back,
      String(bold),
      "0",
      "0",
      "0",
      "100",
      "100",
      "0",
      "0",
      String(borderStyle),
      String(style.outline),
      String(style.shadow),
      String(ALIGN[style.position]),
      String(Math.round(style.marginH)),
      String(Math.round(style.marginH)),
      String(Math.round(style.marginV)),
      "1",
    ].join(","),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events = cues.map(
    (c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${assText(c.text)}`,
  );

  return `${head.join("\n")}\n${events.join("\n")}\n`;
}
