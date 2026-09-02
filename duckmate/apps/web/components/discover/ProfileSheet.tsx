"use client";

/**
 * 상대 프로필 상세 bottom Sheet — 전체 덕질 카드(Top3 + 나머지 취미) · 소개 · 승인 사진 · 신고/차단 진입.
 * 신고 = E4 `/report?target=&surface=profile`, 차단 = BlockConfirmDialog(lib/moderation blockProfile).
 */
import * as React from "react";
import Link from "next/link";
import { Flag, ShieldBan } from "lucide-react";
import { Button, HobbyChip, INTENSITY_LABELS, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@duckmate/ui";
import { BlockConfirmDialog } from "./BlockConfirmDialog";
import { clampIntensity, uiCategoryOf } from "./format";
import { PersonCard } from "./PersonCard";
import type { CardPerson, DiscoverApi } from "./types";

export function ProfileSheet({
  person,
  open,
  onOpenChange,
  api,
  compat,
  reasons,
  onBlocked,
}: {
  person: CardPerson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: DiscoverApi;
  compat?: number | null;
  reasons?: string[];
  onBlocked?: (targetId: string) => void;
}) {
  const [blockOpen, setBlockOpen] = React.useState(false);
  if (!person) return null;
  const extra = person.hobbies.filter((h) => h.rank > 3);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent data-testid="profile-sheet" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>{person.nickname} 님의 덕질 카드</SheetTitle>
            <SheetDescription className="sr-only">상대 프로필 상세</SheetDescription>
          </SheetHeader>
          <PersonCard person={person} compat={compat ?? null} reasons={reasons ?? []} showPhotos />
          {extra.length > 0 ? (
            <section className="mt-4">
              <h3 className="text-label text-muted-foreground">그 밖의 취미</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {extra.map((h) => (
                  <li key={h.hobbyId}>
                    <HobbyChip label={h.name} category={uiCategoryOf(h.categoryId)} intensity={clampIntensity(h.intensity)} highlighted={h.isCommon} size="sm" />
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-caption text-muted-foreground">몰입도: {extra.map((h) => `${h.name} ${INTENSITY_LABELS[clampIntensity(h.intensity)]}`).join(" · ")}</p>
            </section>
          ) : null}
          {person.bio ? (
            <section className="mt-4">
              <h3 className="text-label text-muted-foreground">소개</h3>
              <p className="mt-1 whitespace-pre-wrap text-body">{person.bio}</p>
            </section>
          ) : null}
          <div className="mt-6 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={`/report?target=${encodeURIComponent(person.profileId)}&surface=profile`} data-testid="profile-report">
                <Flag aria-hidden="true" />
                신고
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-destructive" onClick={() => setBlockOpen(true)} data-testid="profile-block">
              <ShieldBan aria-hidden="true" />
              차단
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <BlockConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        targetId={person.profileId}
        nickname={person.nickname}
        api={api}
        onBlocked={(id) => {
          onOpenChange(false);
          onBlocked?.(id);
        }}
      />
    </>
  );
}
