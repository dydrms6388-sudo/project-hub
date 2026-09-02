"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ChevronRight, Settings } from "lucide-react";
import { DuckCard, VerifyBadge, type VerifyLevel, VERIFY_LABELS } from "@duckmate/ui";
import { MODE_COPY } from "@/components/settings/copy";
import { track } from "@/lib/analytics/track";
import type { MyProfileView } from "./types";

function Row({ href, label, meta, testId }: { href: string; label: string; meta?: string; testId?: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted" data-testid={testId}>
        <span className="text-body flex-1">{label}</span>
        {meta ? <span className="text-body-sm tnum text-muted-foreground">{meta}</span> : null}
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
      </Link>
    </li>
  );
}

/** /me — 상대가 보는 그대로의 덕질 카드(compat 없음) + 인증 진행 + 편집 진입 (12_flows §6.1) */
export function MeScreen({ view }: { view: MyProfileView }) {
  useEffect(() => {
    track("me_viewed", { verify_level: view.verifyLevel, mode: view.mode });
  }, [view.verifyLevel, view.mode]);

  const approvedPhotos = view.photos.filter((p) => p.reviewStatus === "approved" && p.url).map((p) => ({ src: p.url as string, alt: "내 사진" }));
  const levels: VerifyLevel[] = [1, 2, 3];
  const quizLeft = Math.max(0, view.quizTotal - view.quizAnswered);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-safe" data-testid="me-screen">
      <header className="flex h-14 items-center justify-between">
        <h1 className="text-h2">나</h1>
        <Link href="/settings" aria-label="설정" className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted" data-testid="me-settings">
          <Settings size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </header>

      <p className="text-caption mb-2 text-muted-foreground">상대에게 이렇게 보여요</p>
      <DuckCard
        profileId={view.profileId}
        nickname={view.nickname || "닉네임 없음"}
        ageBand={view.ageBand}
        region={view.regionLabel}
        verifyLevel={view.verifyLevel}
        hobbies={view.hobbies.slice(0, 3).map((h) => ({ category: h.categorySlug, label: h.name, intensity: h.intensity as 1 | 2 | 3 | 4 | 5 }))}
        favorite={view.hobbies.find((h) => h.rank === 1)?.favNote ?? null}
        nowInto={view.nowInto}
        photos={approvedPhotos.length ? approvedPhotos : undefined}
        compact
      />

      <section className="mt-5 rounded-lg border border-border bg-card">
        <Link href="/settings/verify" className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted" data-testid="me-verify">
          <span className="text-body">인증</span>
          <span className="flex flex-1 flex-wrap gap-1.5">
            {levels.map((l) => (
              <VerifyBadge
                key={l}
                level={l}
                showLow
                // 미달성 레벨: opacity 로 흐리게 하면 흰 글자/보라 배경 대비가 4.5:1 미만(axe serious) → 중립 톤 + 라벨 "미완료" (E6)
                {...(view.verifyLevel < l ? { className: "border-border bg-muted text-muted-foreground", "aria-label": `${VERIFY_LABELS[l]} 미완료` } : {})}
              />
            ))}
          </span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
        </Link>
        <Link href="/settings/mode" className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-3 hover:bg-muted" data-testid="me-mode">
          <span className="text-body flex-1">모드</span>
          <span className="text-body-sm text-muted-foreground">{MODE_COPY[view.mode].label}</span>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted-foreground" />
        </Link>
      </section>

      <h2 className="text-label mt-6 px-1 text-muted-foreground">편집</h2>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
        <Row href="/me/edit#card" label="덕질 카드 편집" meta="취미·최애·요즘" testId="me-edit-card" />
        <Row href="/me/photos" label="사진 관리" meta={`대기 ${view.photoCounts.pending} · 승인 ${view.photoCounts.approved}`} testId="me-photos" />
        <Row href="/me/edit#quiz" label="퀴즈 답하기" meta={quizLeft > 0 ? `${quizLeft}문항 남음` : "완료"} testId="me-edit-quiz" />
        <Row href="/me/edit#availability" label="활동 시간대" meta={`${view.availabilityCount}칸`} testId="me-edit-availability" />
        <Row href="/me/edit#bio" label="소개(bio)" meta={`${(view.bio ?? "").length}/200자`} testId="me-edit-bio" />
      </ul>
    </div>
  );
}
