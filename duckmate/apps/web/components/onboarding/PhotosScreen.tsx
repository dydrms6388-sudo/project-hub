"use client";

/**
 * S6-b 사진(선택) — /onboarding/photos (12_flows §2 S6-b, 10_brand #11, 15_auth §0-11). 진행 바 6/6 유지.
 * 업로드: 클라이언트 압축 → createPhotoUploadUrl → storage.uploadToSignedUrl → confirmPhotoUpload(pending). 첫 장 자동 대표.
 * 완료/나중에 → finishPhotos({skipped}) → /verify + onboarding_completed{hobby_count, quiz_count, photo_count}.
 */
import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Badge, Button, SafetyBanner, Spinner, cn, useToast } from "@duckmate/ui";
import { PHOTO_MAX, type Enums } from "@duckmate/db";
import { track } from "@/lib/analytics/track";
import { useStepTimer } from "@/lib/analytics/useTrack";
import { finishPhotos } from "@/lib/onboarding/actions";
import { confirmPhotoUpload, createPhotoUploadUrl, deletePhoto } from "@/lib/photos/actions";
import { PHOTO_BUCKET } from "@/lib/photos/upload";
import { createClient } from "@/lib/supabase/client";
import { COPY } from "./copy";
import { OnboardingFrame } from "./OnboardingFrame";
import { PHOTO_ACCEPT, compressImage, photoFileError } from "./photo-utils";
import { useActionResult } from "./useActionResult";

export type PhotoTile = { id: string; path: string; isPrimary: boolean; reviewStatus: Enums["review_status"]; previewUrl: string | null };

export function PhotosScreen({ initial }: { initial: Array<{ id: string; path: string; isPrimary: boolean; reviewStatus: Enums["review_status"] }> }) {
  const timer = useStepTimer();
  const { toast } = useToast();
  const { handle, run, pending } = useActionResult();
  const [photos, setPhotos] = React.useState<PhotoTile[]>(() => initial.map((p) => ({ ...p, previewUrl: null })));
  const [uploading, setUploading] = React.useState(false);
  const [finishing, setFinishing] = React.useState<"done" | "later" | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 기존 사진 썸네일: 서명 URL 시도(실패 시 플레이스홀더)
  React.useEffect(() => {
    const missing = photos.filter((p) => p.previewUrl === null);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(missing.map((p) => p.path), 3600);
        if (cancelled || !data) return;
        setPhotos((prev) =>
          prev.map((p) => {
            const hit = data.find((d) => d.path === p.path && d.signedUrl);
            return hit ? { ...p, previewUrl: hit.signedUrl } : p;
          }),
        );
      } catch {
        /* 플레이스홀더 유지 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photos.length >= PHOTO_MAX) {
      toast({ title: `사진은 최대 ${PHOTO_MAX}장까지 올릴 수 있어요` });
      return;
    }
    const err = photoFileError(file);
    if (err) {
      toast({ title: err, variant: "error" });
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const sizeErr = compressed.size > 5 * 1024 * 1024 ? COPY.photos.fileError : null;
      if (sizeErr) {
        toast({ title: sizeErr, variant: "error" });
        return;
      }
      const ticket = await run(() => createPhotoUploadUrl({ contentType: compressed.type, sizeBytes: compressed.size }));
      if (!handle(ticket, { onFailure: (f) => (toast({ title: f.message, variant: "error" }), true) }) || !ticket.ok) return;
      const supabase = createClient();
      const up = await supabase.storage.from(PHOTO_BUCKET).uploadToSignedUrl(ticket.data.path, ticket.data.token, compressed, { contentType: compressed.type });
      if (up.error) {
        toast({ title: COPY.common.network, variant: "error" });
        return;
      }
      const confirmed = await run(() => confirmPhotoUpload({ photoId: ticket.data.photoId }));
      handle(confirmed, {
        onSuccess: (c) => {
          setPhotos((prev) => [...prev, { id: c.photoId, path: c.path, isPrimary: c.isPrimary, reviewStatus: c.reviewStatus, previewUrl: URL.createObjectURL(compressed) }]);
        },
      });
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    const res = await run(() => deletePhoto({ photoId: id }));
    handle(res, {
      onSuccess: () => setPhotos((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, isPrimary: i === 0 }))),
    });
  };

  const finish = async (skipped: boolean) => {
    setFinishing(skipped ? "later" : "done");
    const res = await run(() => finishPhotos({ skipped }));
    setFinishing(null);
    handle(res, {
      onSuccess: ({ redirectTo, counts }) => {
        const duration = timer.elapsed();
        if (skipped) track("onboarding_step_skipped", { step: "photos", duration_ms: duration });
        else track("onboarding_step_completed", { step: "photos", duration_ms: duration, photo_count: counts.photos });
        track("onboarding_completed", { hobby_count: counts.hobbies, quiz_count: counts.quiz, photo_count: counts.photos });
        window.location.assign(redirectTo); // /verify 는 별도 layout — 게이트 재평가를 위해 풀 내비게이션
      },
    });
  };

  const slots = Array.from({ length: PHOTO_MAX });

  return (
    <OnboardingFrame
      step={6}
      backHref="/onboarding/card"
      headline={COPY.photos.headline}
      sub={COPY.photos.sub}
      testId="photos-screen"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" loading={finishing === "later"} disabled={pending || uploading} data-testid="photos-later" onClick={() => finish(true)}>
            {COPY.photos.later}
          </Button>
          <Button size="lg" loading={finishing === "done"} disabled={pending || uploading || photos.length === 0} data-testid="onb-next" onClick={() => finish(false)}>
            {COPY.photos.done}
          </Button>
        </div>
      }
    >
      <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} className="sr-only" data-testid="photo-file-input" onChange={onPick} aria-label={COPY.photos.add} />
      <ul className="grid grid-cols-3 gap-2" aria-label={`사진 ${photos.length}/${PHOTO_MAX}`} data-testid="photo-grid">
        {slots.map((_, i) => {
          const p = photos[i];
          if (p) {
            return (
              <li key={p.id} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted" data-testid={`photo-tile-${i}`}>
                {p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.previewUrl} alt={`내 사진 ${i + 1}`} className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-caption text-muted-foreground">사진 {i + 1}</span>
                )}
                <div className="absolute inset-x-1 top-1 flex flex-wrap gap-1">
                  {p.isPrimary ? <Badge variant="primary" size="sm">{COPY.photos.primary}</Badge> : null}
                  <Badge variant="warning" size="sm">검수 대기</Badge>
                </div>
                <Button variant="secondary" size="icon" aria-label={`${COPY.photos.remove} 사진 ${i + 1}`} data-testid={`photo-remove-${i}`} className="absolute right-1 bottom-1 size-9" onClick={() => onDelete(p.id)} disabled={pending}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          }
          const isNext = i === photos.length;
          return (
            <li key={`empty-${i}`} className="aspect-square">
              <button
                type="button"
                disabled={!isNext || uploading}
                aria-label={isNext ? COPY.photos.add : undefined}
                aria-hidden={!isNext}
                tabIndex={isNext ? 0 : -1}
                data-testid={isNext ? "photo-add" : undefined}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex size-full items-center justify-center rounded-md border border-dashed border-input bg-card text-sand-500",
                  isNext && "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  !isNext && "opacity-50",
                )}
              >
                {isNext && uploading ? <Spinner label="올리는 중" /> : <ImagePlus aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="tnum text-caption text-muted-foreground" role="status" aria-live="polite">
        {COPY.photos.max(PHOTO_MAX)} · {photos.length}장 {photos.length > 0 ? `· ${COPY.photos.pending}` : ""}
      </p>
      <SafetyBanner variant="info">{COPY.photos.guide}</SafetyBanner>
    </OnboardingFrame>
  );
}
