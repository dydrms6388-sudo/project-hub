"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ChevronLeft, Info } from "lucide-react";
import { SEEKING_GENDERS, type Enums } from "@duckmate/db";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DuckCard, RadioCard, RadioGroup, SafetyBanner, cn, useToast } from "@duckmate/ui";
import { setMode } from "@/lib/account/actions";
import type { MyProfileView } from "@/components/profile/types";
import { MODE_COPY } from "./copy";
import { track } from "./track";

export function ModeScreen({ view }: { view: MyProfileView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<Enums["profile_mode"]>(view.mode);
  const [seeking, setSeeking] = useState<Enums["seeking_gender"] | "">(view.seekingGender ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewViewed, setPreviewViewed] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [notEntitled, setNotEntitled] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canDating = view.verifyLevel >= 3;
  const changed = target !== view.mode;
  const needsSeeking = target === "dating" && !seeking;
  const canSubmit = changed && previewViewed && !needsSeeking && !(target === "dating" && !canDating);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 8) setReachedEnd(true);
  };
  const openPreview = () => {
    setReachedEnd(false);
    setPreviewOpen(true);
    // 스크롤이 필요 없을 만큼 짧으면 바로 끝으로 간주
    setTimeout(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 8) setReachedEnd(true);
    }, 50);
  };

  const submit = () =>
    start(async () => {
      setNotEntitled(null);
      const r = await setMode({ mode: target, seekingGender: target === "dating" ? seeking || undefined : undefined, previewViewed });
      if (!r.ok) {
        if (r.code === "NOT_ENTITLED") {
          setNotEntitled(r.message);
          return;
        }
        if (r.redirectTo) {
          router.replace(r.redirectTo);
          return;
        }
        toast({ title: r.message, variant: "error" });
        return;
      }
      track("mode_changed", { from: view.mode, to: r.data.mode, preview_viewed: previewViewed });
      toast({ title: MODE_COPY.done, variant: "success" });
      router.replace("/settings");
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="mode-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">모드</h1>
      </header>

      <RadioGroup
        value={target}
        onValueChange={(v) => {
          setTarget(v as Enums["profile_mode"]);
          setPreviewViewed(false);
          setNotEntitled(null);
        }}
        className="space-y-2"
      >
        <RadioCard value="friend" label={`${MODE_COPY.friend.label}${view.mode === "friend" ? " (현재)" : ""}`} description={MODE_COPY.friend.description} data-testid="mode-friend" />
        <RadioCard value="dating" label={`${MODE_COPY.dating.label}${view.mode === "dating" ? " (현재)" : ""}`} description={MODE_COPY.dating.description} disabled={!canDating && view.mode !== "dating"} data-testid="mode-dating" />
      </RadioGroup>

      {!canDating ? (
        <SafetyBanner variant="info" className="mt-3" action={{ label: "인증 센터로", onClick: () => router.push("/settings/verify") }}>
          {MODE_COPY.needL3}
        </SafetyBanner>
      ) : null}

      {changed ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-4">
          <h2 className="text-h3">{MODE_COPY.previewTitle} (필수)</h2>
          <p className="text-body-sm mt-1 text-muted-foreground">{target === "dating" ? "데이팅 모드 회원에게 이렇게 보여요." : MODE_COPY.toFriendNotice}</p>
          <Button variant={previewViewed ? "outline" : "default"} className="mt-3 w-full" onClick={openPreview} data-testid="mode-preview-open">
            {previewViewed ? "미리보기 다시 보기 (확인 완료)" : "공개 범위 미리보기"}
          </Button>
          {!previewViewed ? <p className="text-caption mt-2 text-muted-foreground">{MODE_COPY.previewRequired}</p> : null}
        </section>
      ) : null}

      {changed && target === "dating" ? (
        <fieldset className="mt-5">
          <legend className="text-label mb-2">{MODE_COPY.seekingLabel}</legend>
          <div className="flex gap-2">
            {SEEKING_GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={seeking === g}
                onClick={() => setSeeking(g)}
                className={cn("text-label h-10 flex-1 rounded-md border", seeking === g ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
                data-testid={`mode-seeking-${g}`}
              >
                {MODE_COPY.seeking[g]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <p className="text-body-sm mt-5 flex gap-2 text-muted-foreground">
        <Info size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
        {MODE_COPY.keepFriend}
      </p>

      {notEntitled ? (
        <SafetyBanner variant="warn" className="mt-3" action={{ label: "인증 센터로", onClick: () => router.push("/settings/verify") }}>
          {notEntitled}
        </SafetyBanner>
      ) : null}

      <Button className="mt-6 w-full" disabled={!canSubmit} loading={pending} onClick={submit} data-testid="mode-submit">
        {MODE_COPY.submit(target)}
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85dvh] overflow-hidden p-0" data-testid="mode-preview">
          <div className="p-5 pb-0">
            <DialogHeader>
              <DialogTitle>{MODE_COPY.previewTitle}</DialogTitle>
              <DialogDescription>{target === "dating" ? "데이팅 모드 회원에게 이렇게 보여요. 끝까지 확인해 주세요." : "친구 모드로 돌아가면 이렇게 보여요."}</DialogDescription>
            </DialogHeader>
          </div>
          <div ref={scrollRef} onScroll={onScroll} className="max-h-[55dvh] overflow-y-auto px-5 py-4" data-testid="mode-preview-scroll">
            <DuckCard
              profileId={view.profileId}
              nickname={view.nickname || "닉네임"}
              ageBand={view.ageBand}
              region={view.regionLabel}
              verifyLevel={view.verifyLevel}
              hobbies={view.hobbies.slice(0, 3).map((h) => ({ category: h.categorySlug, label: h.name, intensity: h.intensity as 1 | 2 | 3 | 4 | 5 }))}
              favorite={view.hobbies.find((h) => h.rank === 1)?.favNote ?? null}
              nowInto={view.nowInto}
              photos={target === "dating" ? view.photos.filter((p) => p.reviewStatus === "approved" && p.url).map((p) => ({ src: p.url as string })) : undefined}
              compact
            />
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-md bg-muted p-3">
                <p className="text-label">표시됨</p>
                <ul className="text-body-sm mt-1 list-disc pl-5">
                  {MODE_COPY.previewShown.map((s) => (
                    <li key={s}>{s}{s === "승인된 사진" && target === "friend" ? " (매칭된 상대에게만)" : ""}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-label">표시 안 됨</p>
                <ul className="text-body-sm mt-1 list-disc pl-5">
                  {MODE_COPY.previewHidden.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="p-5 pt-0">
            <Button
              className="w-full"
              disabled={!reachedEnd}
              onClick={() => {
                setPreviewViewed(true);
                setPreviewOpen(false);
              }}
              data-testid="mode-preview-confirm"
            >
              {reachedEnd ? "확인했어요" : "끝까지 스크롤해 주세요"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
