"use client";

import CopyButton from "./CopyButton";
import { Btn } from "./ui";
import type { SeedState } from "@/lib/seedstate";

/**
 * 결과 아래 공통 바 — seed 표시 / 공유 / 새로 뽑기 / 입력 수정.
 * 10개 도구가 전부 이 컴포넌트를 쓴다.
 */
export default function SeedBar<D>({
  s,
  shareTitle,
  shareText,
  onRerun,
}: {
  s: SeedState<D>;
  shareTitle: string;
  shareText?: string;
  onRerun?: () => void;
}) {
  async function share() {
    const url = s.shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText ?? shareTitle, url });
        return;
      } catch {
        /* 사용자가 취소했거나 미지원 → 아래 복사 버튼으로 폴백 */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      // eslint-disable-next-line no-alert
      window.alert("결과 링크를 복사했습니다. 붙여넣어 공유하세요.");
    } catch {
      window.prompt("아래 링크를 복사해 공유하세요", url);
    }
  }

  return (
    <div className="mt-5 space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
          seed
        </span>
        <code className="break-all font-mono text-xs text-slate-700">{s.seed}</code>
      </div>

      <p className="text-xs leading-relaxed text-slate-600">
        이 결과는 위 seed 와 입력값만으로 계산됩니다. 아래 링크를 다른 기기에서 열어도 <b>똑같은 결과</b>가
        나옵니다.
      </p>

      <div className="flex flex-wrap gap-2">
        <Btn onClick={share} ariaLabel="결과 링크 공유하기">
          결과 링크 공유
        </Btn>
        <CopyButton value={() => s.shareUrl} label="링크 복사" />
        <Btn variant="soft" onClick={onRerun ?? s.rerun} ariaLabel="새로운 seed 로 다시 뽑기">
          새로 뽑기
        </Btn>
        <Btn variant="ghost" onClick={s.reset} ariaLabel="입력값 다시 고치기">
          입력 수정
        </Btn>
      </div>
    </div>
  );
}

/** 재현 모드 배지 — 해시로 들어왔을 때 결과 위에 표시 */
export function ReplayBadge() {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <span aria-hidden="true">🔒</span>
      <p className="leading-relaxed">
        <b>이 결과는 seed 기반으로 재현되었습니다.</b> 링크에 담긴 seed 와 입력값으로 계산했기 때문에 누가 언제
        열어도 같은 결과입니다. 입력은 잠겨 있으며, 새 결과를 원하면 <b>새로 뽑기</b>를 누르세요.
      </p>
    </div>
  );
}

/** 해시가 깨졌을 때 */
export function BrokenBadge() {
  return (
    <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
      링크의 결과 데이터를 해석하지 못했습니다. 링크가 잘렸을 수 있으니 원본 링크를 다시 확인해 주세요.
    </div>
  );
}
