"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ChevronLeft, ImagePlus, Star, Trash2 } from "lucide-react";
import { PHOTO_MAX, type Enums, type VerifyLevel } from "@duckmate/db";
import { Badge, Button, EmptyState, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, cn, useToast } from "@duckmate/ui";
import { confirmPhotoUpload, createPhotoUploadUrl, deletePhoto, setPrimaryPhoto } from "@/lib/photos/actions";
import { PHOTO_ALLOWED_MIME, PHOTO_BUCKET, PHOTO_MAX_BYTES } from "@/lib/photos/upload";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_COPY } from "@/components/settings/copy";
import { track } from "@/components/settings/track";
import { photoBadgeVariant, photoStatusLabel } from "./format";
import type { MyPhoto } from "./types";

type Props = { photos: MyPhoto[]; profileId: string; verifyLevel: VerifyLevel; mode: Enums["profile_mode"] };

export function PhotosScreen({ photos, verifyLevel, mode }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MyPhoto | null>(null);

  const approvedCount = photos.filter((p) => p.reviewStatus === "approved").length;
  const isLastApproved = (p: MyPhoto) => p.reviewStatus === "approved" && approvedCount === 1;

  const handle = <T,>(r: { ok: true; data: T } | { ok: false; message: string; redirectTo?: string }, okMsg?: string) => {
    if (!r.ok) {
      if (r.redirectTo) router.replace(r.redirectTo);
      else toast({ title: r.message, variant: "error" });
      return false;
    }
    if (okMsg) toast({ title: okMsg, variant: "success" });
    router.refresh();
    return true;
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (!PHOTO_ALLOWED_MIME.includes(file.type)) {
      toast({ title: "JPG/PNG/WebP 만 올릴 수 있어요", variant: "error" });
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      toast({ title: "5MB 이하 사진만 올릴 수 있어요", variant: "error" });
      return;
    }
    setUploading(true);
    try {
      const ticket = await createPhotoUploadUrl({ contentType: file.type, sizeBytes: file.size });
      if (!ticket.ok) {
        handle(ticket);
        return;
      }
      const { error } = await createClient().storage.from(PHOTO_BUCKET).uploadToSignedUrl(ticket.data.path, ticket.data.token, file, { contentType: file.type });
      if (error) {
        toast({ title: "업로드하지 못했어요. 다시 시도해 주세요", variant: "error" });
        return;
      }
      const done = await confirmPhotoUpload({ photoId: ticket.data.photoId });
      if (handle(done, "올렸어요. 24시간 안에 확인해요")) track("photo_uploaded", { is_primary: done.ok ? done.data.isPrimary : false });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doDelete = (p: MyPhoto) =>
    start(async () => {
      const r = await deletePhoto({ photoId: p.id });
      setConfirmDelete(null);
      if (handle(r, "삭제했어요")) track("photo_deleted", { review_status: p.reviewStatus, was_primary: p.isPrimary });
    });

  const doPrimary = (p: MyPhoto) =>
    start(async () => {
      if (p.reviewStatus !== "approved") {
        toast({ title: PHOTO_COPY.onlyApprovedPrimary, variant: "error" });
        return;
      }
      handle(await setPrimaryPhoto({ photoId: p.id }), "대표 사진으로 지정했어요");
    });

  const slots = [...photos, ...Array.from({ length: Math.max(0, PHOTO_MAX - photos.length) }, () => null)];

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="me-photos-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/me" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">사진 관리</h1>
        <span className="tnum text-body-sm ml-auto text-muted-foreground">
          {photos.length}/{PHOTO_MAX}
        </span>
      </header>
      <p className="text-body-sm text-muted-foreground">
        승인된 대표 사진 1장이면 사진인증(L3)이 돼요. 사진은 사람이 24시간 안에 확인하고, 승인 전에는 다른 사람에게 보이지 않아요.
        {verifyLevel >= 3 ? " 지금은 사진인증 상태예요." : ""}
      </p>

      <input ref={fileRef} type="file" accept={PHOTO_ALLOWED_MIME.join(",")} className="sr-only" onChange={(e) => void onPick(e.target.files?.[0])} data-testid="photo-file-input" />

      {photos.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={ImagePlus}
            title="아직 사진이 없어요"
            description={PHOTO_COPY.empty}
            action={
              <Button onClick={() => fileRef.current?.click()} loading={uploading} data-testid="photo-add">
                {PHOTO_COPY.add}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {slots.map((p, i) =>
            p ? (
              <li key={p.id} className="overflow-hidden rounded-lg border border-border bg-card" data-testid={`photo-${p.reviewStatus}`}>
                <div className="relative aspect-square bg-muted">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" className={cn("size-full object-cover", p.reviewStatus === "rejected" && "opacity-50")} />
                  ) : (
                    <div className="text-caption flex size-full items-center justify-center text-muted-foreground">미리보기 없음</div>
                  )}
                  {p.isPrimary ? (
                    <Badge variant="primary" size="sm" className="absolute left-2 top-2">
                      {PHOTO_COPY.primary}
                    </Badge>
                  ) : null}
                </div>
                <div className="p-2.5">
                  <Badge variant={photoBadgeVariant(p.reviewStatus)} size="sm" className="max-w-full whitespace-normal text-left">
                    {photoStatusLabel(p.reviewStatus, p.rejectCode)}
                  </Badge>
                  <div className="mt-2 flex gap-1.5">
                    {!p.isPrimary && p.reviewStatus === "approved" ? (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => doPrimary(p)} disabled={pending} data-testid="photo-set-primary">
                        <Star aria-hidden="true" /> {PHOTO_COPY.setPrimary}
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" className={cn("text-destructive", p.isPrimary || p.reviewStatus !== "approved" ? "flex-1" : "")} onClick={() => setConfirmDelete(p)} disabled={pending} aria-label="삭제" data-testid="photo-delete">
                      <Trash2 aria-hidden="true" /> 삭제
                    </Button>
                  </div>
                </div>
              </li>
            ) : (
              <li key={`empty-${i}`}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-50"
                  data-testid="photo-add"
                >
                  <ImagePlus size={24} strokeWidth={1.75} aria-hidden="true" />
                  <span className="text-caption">{uploading ? "올리는 중…" : PHOTO_COPY.add}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <Sheet open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>사진을 삭제할까요?</SheetTitle>
            <SheetDescription>
              {confirmDelete && isLastApproved(confirmDelete) ? PHOTO_COPY.deleteLastApproved : "삭제한 사진은 되돌릴 수 없어요."}
              {confirmDelete && isLastApproved(confirmDelete) && mode === "dating" ? " 지금 데이팅 모드라서 취미 친구 모드로 돌아가요." : ""}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="destructive" className="w-full" loading={pending} onClick={() => confirmDelete && doDelete(confirmDelete)} data-testid="photo-delete-confirm">
              삭제하기
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
