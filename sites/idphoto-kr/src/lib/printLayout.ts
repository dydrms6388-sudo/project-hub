"use client";

import { mmToPt } from "@/data/specs";

export type SheetId = "4x6" | "a4";

export type Sheet = {
  id: SheetId;
  label: string;
  /** 용지 크기 (mm) */
  mm: { w: number; h: number };
  /**
   * 최소 여백(mm). 일반 가정용 프린터는 A4 를 가장자리까지 인쇄하지 못하므로
   * A4 는 5mm 를 최소로 둔다. 인화지(4×6)는 사진관에서 무테 인화가 가능해 0 이다.
   */
  minMargin: number;
};

/** 4×6인치 = 101.6 × 152.4 mm, A4 = 210 × 297 mm */
export const SHEETS: Sheet[] = [
  { id: "4x6", label: "4×6인치 인화지 (101.6 × 152.4 mm)", mm: { w: 101.6, h: 152.4 }, minMargin: 0 },
  { id: "a4", label: "A4 용지 (210 × 297 mm)", mm: { w: 210, h: 297 }, minMargin: 5 },
];

export type Layout = {
  cols: number;
  rows: number;
  /** 실제로 배치되는 컷 수 */
  count: number;
  /** 한 컷의 배치 크기 (mm) — 눕혀 배치하면 w/h 가 뒤바뀐다 */
  cell: { w: number; h: number };
  /** 90도 눕혀서 배치했는가 */
  rotated: boolean;
  margin: number;
  gap: number;
  /** 격자 전체 크기 (mm) */
  grid: { w: number; h: number };
};

/** 여백/간격 후보 — 넉넉한 쪽부터 시도하고, 원하는 컷 수를 못 채우면 좁힌다 */
const PADDINGS: { margin: number; gap: number }[] = [
  { margin: 8, gap: 2 },
  { margin: 6, gap: 1.5 },
  { margin: 5, gap: 1 },
  { margin: 4, gap: 2 },
  { margin: 3, gap: 1.5 },
  { margin: 2, gap: 1 },
  { margin: 1, gap: 0.5 },
  { margin: 0, gap: 0 },
];

function gridFor(
  sheet: { w: number; h: number },
  cell: { w: number; h: number },
  margin: number,
  gap: number,
): { cols: number; rows: number } {
  const aw = sheet.w - margin * 2;
  const ah = sheet.h - margin * 2;
  if (aw < cell.w || ah < cell.h) return { cols: 0, rows: 0 };
  const cols = Math.floor((aw + gap) / (cell.w + gap));
  const rows = Math.floor((ah + gap) / (cell.h + gap));
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
}

/**
 * 규격을 세워서/눕혀서 배치했을 때 더 많이 들어가는 쪽을 고른다.
 * `want` 를 주면 그 컷 수를 채울 수 있는 가장 넉넉한 여백 조합을 고르고,
 * 못 채우면 최대로 들어가는 배치를 돌려준다.
 */
export function bestLayout(
  sheet: Sheet,
  photoMm: { w: number; h: number },
  want?: number,
): Layout {
  const sheetMm = sheet.mm;
  const orientations: { cell: { w: number; h: number }; rotated: boolean }[] = [
    { cell: { w: photoMm.w, h: photoMm.h }, rotated: false },
    { cell: { w: photoMm.h, h: photoMm.w }, rotated: true },
  ];

  let fallback: Layout | null = null;

  for (const { margin, gap } of PADDINGS.filter((p) => p.margin >= sheet.minMargin)) {
    for (const { cell, rotated } of orientations) {
      const { cols, rows } = gridFor(sheetMm, cell, margin, gap);
      const max = cols * rows;
      if (max === 0) continue;
      const layout: Layout = {
        cols,
        rows,
        count: max,
        cell,
        rotated,
        margin,
        gap,
        grid: { w: cols * cell.w + (cols - 1) * gap, h: rows * cell.h + (rows - 1) * gap },
      };
      if (!fallback || max > fallback.count) fallback = layout;
      if (want !== undefined && max >= want) {
        return { ...layout, count: want };
      }
    }
  }

  if (!fallback) {
    // 용지보다 큰 규격 — 1컷도 못 들어감
    return {
      cols: 0,
      rows: 0,
      count: 0,
      cell: photoMm,
      rotated: false,
      margin: 0,
      gap: 0,
      grid: { w: 0, h: 0 },
    };
  }
  return fallback;
}

/** 규격/용지 조합에서 고를 수 있는 컷 수 후보 */
export function countOptions(maxCount: number): number[] {
  const presets = [1, 2, 4, 6, 8, 9, 12, 16, 20, 24, 30, 36];
  const list = presets.filter((n) => n <= maxCount);
  if (!list.includes(maxCount) && maxCount > 0) list.push(maxCount);
  return list;
}

/**
 * 인화 배치 PDF 생성. pdf-lib 는 이 함수가 호출될 때 처음 로드된다.
 * @param jpeg 300dpi 로 렌더링된 규격 사진 JPEG
 */
export async function buildPrintPdf(opts: {
  jpeg: Blob;
  sheet: Sheet;
  photoMm: { w: number; h: number };
  count: number;
  /** 재단선(옅은 회색 테두리) 표시 */
  cutLines?: boolean;
}): Promise<Blob> {
  const { PDFDocument, rgb, degrees } = await import("pdf-lib");
  const { jpeg, sheet, photoMm, count } = opts;

  const layout = bestLayout(sheet, photoMm, count);
  if (layout.count === 0) {
    throw new Error("이 용지에는 규격 사진이 한 장도 들어가지 않습니다.");
  }

  const doc = await PDFDocument.create();
  doc.setTitle("증명사진 인화 배치");
  doc.setProducer("idphoto-kr");
  doc.setCreator("증명사진 메이커 (idphoto-kr.vercel.app)");

  const page = doc.addPage([mmToPt(sheet.mm.w), mmToPt(sheet.mm.h)]);
  const img = await doc.embedJpg(await jpeg.arrayBuffer());

  const { cols, cell, gap, grid } = layout;
  // 격자를 용지 정중앙에 배치
  const originXmm = (sheet.mm.w - grid.w) / 2;
  const originYmmTop = (sheet.mm.h - grid.h) / 2;

  for (let i = 0; i < layout.count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const xmm = originXmm + c * (cell.w + gap);
    const ymmTop = originYmmTop + r * (cell.h + gap);
    // pdf-lib 좌표계는 좌하단 원점
    const x = mmToPt(xmm);
    const y = mmToPt(sheet.mm.h - ymmTop - cell.h);
    const w = mmToPt(cell.w);
    const h = mmToPt(cell.h);

    if (layout.rotated) {
      // 90도 눕혀 배치: 회전 후 원점이 우측 하단으로 가므로 x 를 셀 폭만큼 밀어 준다
      page.drawImage(img, {
        x: x + w,
        y,
        width: mmToPt(photoMm.w),
        height: mmToPt(photoMm.h),
        rotate: degrees(90),
      });
    } else {
      page.drawImage(img, { x, y, width: w, height: h });
    }

    if (opts.cutLines !== false) {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: rgb(0.78, 0.78, 0.78),
        borderWidth: 0.25,
      });
    }
  }

  const bytes = await doc.save();
  // pdf-lib 는 Uint8Array 를 돌려준다 — Blob 으로 감싸 저장한다
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
