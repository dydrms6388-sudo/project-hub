"use client";
import { useEffect, useRef, useState } from "react";

export interface CardLine {
  label: string;
  value: string;
}

export interface ShareRowProps {
  code: string;
  name: string;
  marketLabel: string;
  sector: string | null;
  asOf: string;
  lines: CardLine[];
  /** 카드에 실을 "확인 항목" 문구 (조건문). 최대 4개까지 그려진다 */
  checks: string[];
  /** 커뮤니티 붙여넣기용 텍스트 (숫자 나열 + 링크) */
  communityText: string;
}

type Toast = "" | "링크를 복사했습니다" | "텍스트를 복사했습니다" | "복사에 실패했습니다" | "카드 이미지를 저장했습니다" | "이미지를 만들지 못했습니다";

const CARD_W = 1080;
const CARD_H = 1080;
/* 캔버스는 CSS 토큰을 읽을 수 없어 고정 색상을 사용합니다 (라이트 카드 고정) */
const C_BG = "#ffffff";
const C_PANEL = "#f1f3f6";
const C_BORDER = "#e3e6eb";
const C_FG = "#111418";
const C_MUTED = "#5d6673";
const C_BRAND = "#1d4ed8";
const C_WARN = "#b45309";

function drawCard(ctx: CanvasRenderingContext2D, p: ShareRowProps): void {
  const sans = `700 1px "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  const font = (weight: number, size: number) => sans.replace("700", String(weight)).replace("1px", `${size}px`);

  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = C_BRAND;
  ctx.fillRect(0, 0, CARD_W, 14);

  ctx.fillStyle = C_MUTED;
  ctx.font = font(600, 30);
  ctx.fillText("스톡랩 · 종목 팩트체크", 72, 100);

  ctx.fillStyle = C_FG;
  ctx.font = font(800, 72);
  ctx.fillText(p.name, 72, 190);
  ctx.fillStyle = C_MUTED;
  ctx.font = font(500, 32);
  ctx.fillText(`${p.code} · ${p.marketLabel}${p.sector ? ` · ${p.sector}` : ""}`, 72, 238);

  // 지표 2열 그리드
  const cols = 2;
  const boxW = (CARD_W - 144 - 24) / cols;
  const boxH = 118;
  const top = 290;
  p.lines.slice(0, 8).forEach((line, i) => {
    const cx = 72 + (i % cols) * (boxW + 24);
    const cy = top + Math.floor(i / cols) * (boxH + 20);
    ctx.fillStyle = C_PANEL;
    ctx.fillRect(cx, cy, boxW, boxH);
    ctx.strokeStyle = C_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, boxW, boxH);
    ctx.fillStyle = C_MUTED;
    ctx.font = font(500, 26);
    ctx.fillText(line.label, cx + 26, cy + 46);
    ctx.fillStyle = C_FG;
    ctx.font = font(700, 44);
    ctx.fillText(line.value, cx + 26, cy + 96);
  });

  const rows = Math.ceil(Math.min(p.lines.length, 8) / cols);
  let y = top + rows * (boxH + 20) + 28;

  ctx.fillStyle = C_FG;
  ctx.font = font(700, 32);
  ctx.fillText("확인 항목", 72, y);
  y += 46;
  ctx.font = font(500, 28);
  const checks = p.checks.slice(0, 4);
  if (checks.length === 0) {
    ctx.fillStyle = C_MUTED;
    ctx.fillText("설정한 기준을 넘은 항목이 없습니다", 72, y);
    y += 42;
  } else {
    for (const c of checks) {
      ctx.fillStyle = C_WARN;
      ctx.fillText("•", 72, y);
      ctx.fillStyle = C_FG;
      ctx.fillText(c.length > 34 ? `${c.slice(0, 33)}…` : c, 104, y);
      y += 42;
    }
  }

  ctx.fillStyle = C_MUTED;
  ctx.font = font(500, 24);
  ctx.fillText(`데이터 기준일 ${p.asOf} · 전일 종가 기준 지연 시세 · 숫자 정리이며 매매 권유가 아닙니다`, 72, CARD_H - 112);
  ctx.fillStyle = C_BRAND;
  ctx.font = font(700, 30);
  ctx.fillText(`tomatoeggcat.com/stocklab/check/${p.code}`, 72, CARD_H - 60);
}

export function ShareRow(props: ShareRowProps) {
  const [toast, setToast] = useState<Toast>("");
  const [canShare, setCanShare] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flash(msg: Toast) {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2200);
  }

  async function copy(text: string, msg: Toast) {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash("복사에 실패했습니다");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `${props.name} 종목 팩트체크`, text: props.communityText, url: window.location.href });
    } catch {
      /* 사용자가 취소했거나 미지원 */
    }
  }

  function savePng() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        flash("이미지를 만들지 못했습니다");
        return;
      }
      drawCard(ctx, props);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `stocklab-check-${props.code}.png`;
      a.click();
      flash("카드 이미지를 저장했습니다");
    } catch {
      flash("이미지를 만들지 못했습니다");
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">결과 공유</h2>
        <span aria-live="polite" className="text-xs text-muted">{toast}</span>
      </div>
      <p className="text-xs text-muted">
        이 페이지 주소가 곧 결과입니다. 링크를 열면 같은 종목의 같은 지표 화면이 그대로 다시 열립니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary h-9 text-xs" onClick={() => void copy(window.location.href, "링크를 복사했습니다")}>
          링크 복사
        </button>
        <button type="button" className="btn-ghost h-9 text-xs" onClick={savePng}>
          카드 이미지(PNG) 저장
        </button>
        <button type="button" className="btn-ghost h-9 text-xs" onClick={() => void copy(props.communityText, "텍스트를 복사했습니다")}>
          커뮤니티용 텍스트 복사
        </button>
        {canShare && (
          <button type="button" className="btn-ghost h-9 text-xs" onClick={() => void share()}>
            기기 공유
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted">카드 이미지에는 tomatoeggcat.com/stocklab/check/{props.code} 워터마크와 데이터 기준일이 함께 들어갑니다.</p>
    </div>
  );
}
