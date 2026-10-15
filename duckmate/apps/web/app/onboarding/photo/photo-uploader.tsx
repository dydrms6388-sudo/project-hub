"use client";

// =============================================================================
// E1 · 사진 업로드 — 클라이언트 리사이즈(webp) → Supabase Storage 업로드 →
//      savePhoto(path) 로 DB 등록. review_status 는 서버 기본값 pending 이며
//      클라이언트가 만질 수 없다(D1 컬럼 권한).
// 다크패턴 금지: "사진 없이 시작하기" 는 다음 버튼 대비 70% 이상 크기(ghost md).
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@duckmate/ui";
import type { ReviewStatus } from "@duckmate/db";
import { createClient } from "@/lib/supabase/client";
import { advanceOnboardingStep, savePhoto } from "@/lib/auth/actions";
import {
  messageForActionError,
  redirectForActionError,
} from "@/app/onboarding/_lib/action-errors";

export interface ExistingPhoto {
  id: string;
  path: string;
  reviewStatus: ReviewStatus;
  isPrimary: boolean;
}

const MAX_PHOTOS = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1440;

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "검수 중",
  approved: "승인됨",
  rejected: "반려됨",
};

async function toWebpBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85)
  );
  if (!blob) throw new Error("ENCODE_FAILED");
  return blob;
}

export function PhotoUploader({
  profileId,
  initialPhotos,
}: {
  profileId: string;
  initialPhotos: ExistingPhoto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<ExistingPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = Math.max(0, MAX_PHOTOS - photos.length);

  function handleActionError(
    code: Parameters<typeof messageForActionError>[0],
    message: string
  ): boolean {
    const to = redirectForActionError(code, message);
    if (to) {
      router.replace(to);
      return true;
    }
    setError(messageForActionError(code, message));
    return false;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("사진 1장은 10MB까지 올릴 수 있어요.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setError(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
      return;
    }

    setUploading(true);
    try {
      const blob = await toWebpBlob(file);
      const objectKey = `${profileId}/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(objectKey, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) {
        setError("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const isPrimary = photos.length === 0;
      const res = await savePhoto({ path: `photos/${objectKey}`, isPrimary });
      if (!res.ok) {
        handleActionError(res.code, res.message);
        return;
      }
      setPhotos((prev) => [
        ...prev,
        { id: res.data.photoId, path: `photos/${objectKey}`, reviewStatus: "pending", isPrimary },
      ]);
      window.dispatchEvent(
        new CustomEvent("duckmate:analytics", { detail: { event: "photo_upload_complete" } })
      );
    } catch {
      setError("사진을 처리하지 못했어요. 다른 사진으로 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  function goNext() {
    router.replace("/onboarding/mode");
    router.refresh();
  }

  function onNext() {
    setError(null);
    if (photos.length > 0) {
      // savePhoto 성공 시 서버가 이미 photo→mode 로 전진시켰다
      goNext();
      return;
    }
    startTransition(async () => {
      const res = await advanceOnboardingStep();
      if (!res.ok) {
        handleActionError(res.code, res.message);
        return;
      }
      goNext();
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-5" data-testid="photo-uploader">
      <Card>
        <h2 className="text-h3">올리기 전에 알아두세요</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">
          <li>올린 사진은 검수 후 공개돼요 (보통 24시간 이내).</li>
          <li>얼굴이 나온 사진이 1장 이상 승인되면 인증 뱃지가 붙어요.</li>
          <li>타인 사진·AI 생성 사진은 반려돼요.</li>
          <li>승인 전에는 상대에게 보이지 않아요.</li>
        </ul>
      </Card>

      <div className="flex flex-wrap gap-3" data-testid="photo-slots">
        {photos.map((p) => (
          <div
            key={p.id}
            className="flex size-24 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface-raised p-2 text-center"
            data-testid="photo-item"
          >
            <Badge variant={p.reviewStatus === "approved" ? "success" : p.reviewStatus === "rejected" ? "danger" : "warning"}>
              {STATUS_LABEL[p.reviewStatus]}
            </Badge>
            <span className="text-caption text-ink-muted">{p.isPrimary ? "대표" : "사진"}</span>
          </div>
        ))}
        {slots > 0 ? (
          <label
            className="flex size-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-raised text-body-sm text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
            data-testid="photo-add"
          >
            <span aria-hidden="true" className="text-h2">
              +
            </span>
            <span>사진 추가</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading || pending}
              onChange={onPick}
              data-testid="photo-input"
            />
          </label>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-body-sm text-ink-muted">
        {uploading ? "사진을 올리고 있어요…" : photos.length > 0 ? `${photos.length}장 등록됨 · 검수 결과는 알림으로 알려드려요.` : ""}
      </p>

      <p
        role="alert"
        aria-live="assertive"
        className="min-h-6 text-body-sm text-danger"
        data-testid="form-error"
      >
        {error}
      </p>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          loading={pending}
          disabled={uploading}
          onClick={onNext}
          data-testid="photo-next"
        >
          다음
        </Button>
        {photos.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onNext}
            disabled={uploading || pending}
            data-testid="photo-skip"
          >
            사진 없이 시작하기
          </Button>
        ) : null}
      </div>
    </div>
  );
}
