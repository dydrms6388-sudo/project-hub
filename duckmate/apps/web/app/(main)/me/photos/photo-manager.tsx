"use client";

// =============================================================================
// E4 · 사진 관리 (client) — 업로드/삭제/대표 지정 + 검수 상태 표시 [F-ONB-08]
//
// 규약:
// - 업로드 경로 = photos/{profile_id}/{uuid}.webp (00006 storage 정책 + savePhoto 검증).
//   재업로드는 항상 **새 uuid** 로 올린다 (캐시·검수 이력 혼선 방지).
// - 클라이언트에서 webp 로 리사이즈 후 업로드(버킷 allowed_mime_types = image/webp).
// - review_status 는 클라이언트가 건드릴 수 없다(컬럼 권한 없음) — 표시 전용.
// - 서명 URL 은 본인 폴더 SELECT 권한으로 브라우저에서 직접 발급한다.
// =============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent } from "@duckmate/ui";
import type { Photo } from "@duckmate/db";
import { createClient } from "@/lib/supabase/client";
import { savePhoto } from "@/lib/auth/actions";

const MAX_PHOTOS = 6;
const MAX_EDGE = 1280;
const BUCKET = "photos";

interface Props {
  profileId: string;
  photos: Photo[];
}

const STATUS_LABEL: Record<Photo["review_status"], { label: string; icon: string; variant: "warning" | "success" | "danger" }> = {
  pending: { label: "검수 중", icon: "⏳", variant: "warning" },
  approved: { label: "승인", icon: "✓", variant: "success" },
  rejected: { label: "반려", icon: "✕", variant: "danger" },
};

/** 이미지 → 최대 1280px webp Blob (원본 그대로 올리지 않는다) */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 변환할 수 없어요.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", 0.85),
  );
  if (!blob) throw new Error("이미지를 변환할 수 없어요.");
  return blob;
}

/** storage 객체 경로 (photos.path 는 버킷 접두 포함 문자열) */
function objectPath(path: string): string {
  return path.startsWith(`${BUCKET}/`) ? path.slice(BUCKET.length + 1) : path;
}

export function PhotoManager({ profileId, photos }: Props) {
  const router = useRouter();
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const replaceIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (photos.length === 0) return;
      const supabase = createClient();
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(photos.map((p) => objectPath(p.path)), 600);
      if (!alive || !data) return;
      const next: Record<string, string> = {};
      photos.forEach((photo, index) => {
        const signed = data[index]?.signedUrl;
        if (signed) next[photo.id] = signed;
      });
      setUrls(next);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [photos]);

  const pickFile = (replacePhotoId: string | null) => {
    replaceIdRef.current = replacePhotoId;
    inputRef.current?.click();
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const replaceId = replaceIdRef.current;
    replaceIdRef.current = null;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const blob = await toWebp(file);
      const supabase = createClient();
      // 재업로드도 새 uuid — 기존 객체를 덮어쓰지 않는다.
      const uuid = crypto.randomUUID();
      const target = `${profileId}/${uuid}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(target, blob, { contentType: "image/webp", upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const result = await savePhoto({
        path: `${BUCKET}/${target}`,
        isPrimary: photos.length === 0,
      });
      if (!result.ok) throw new Error(result.message);

      if (replaceId) {
        const old = photos.find((p) => p.id === replaceId);
        if (old) {
          await supabase.storage.from(BUCKET).remove([objectPath(old.path)]);
          await supabase.from("photos").delete().eq("id", old.id);
        }
      }

      setNotice("업로드했어요. 검수 결과는 보통 24시간 이내에 알려드려요.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (photo: Photo) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([objectPath(photo.path)]);
      const { error: deleteError } = await supabase.from("photos").delete().eq("id", photo.id);
      if (deleteError) throw new Error(deleteError.message);
      setNotice("사진을 삭제했어요.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const onSetPrimary = async (photo: Photo) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      await supabase.from("photos").update({ is_primary: false }).eq("profile_id", profileId);
      const { error: updateError } = await supabase
        .from("photos")
        .update({ is_primary: true })
        .eq("id", photo.id);
      if (updateError) throw new Error(updateError.message);
      setNotice("대표 사진을 바꿨어요.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "대표 사진을 바꾸지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {error && (
        <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 text-body-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-success-tint px-4 py-3 text-body-sm text-success">
          {notice}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {photos.map((photo) => {
          const status = STATUS_LABEL[photo.review_status];
          const preview = urls[photo.id];
          return (
            <li key={photo.id}>
              <Card>
                <CardContent className="flex gap-3 py-4">
                  <div className="size-24 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                    {preview ? (
                      // 서명 URL(10분) — next/image 최적화 대상 아님(비공개 버킷)
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-caption text-ink-muted">
                        불러오는 중
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={status.variant}>
                        {status.icon} {status.label}
                      </Badge>
                      {photo.is_primary && <Badge variant="brand">대표</Badge>}
                    </span>
                    {photo.review_status === "rejected" && (
                      <p className="text-body-sm text-danger">
                        반려 사유: {photo.reject_reason ?? "기준 미충족"}
                      </p>
                    )}
                    {photo.review_status === "pending" && (
                      <p className="text-caption text-ink-muted">
                        승인 전 사진은 상대에게 보이지 않아요.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {photo.review_status === "rejected" && (
                        <Button size="sm" disabled={busy} onClick={() => pickFile(photo.id)}>
                          다시 올리기
                        </Button>
                      )}
                      {photo.review_status === "approved" && !photo.is_primary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void onSetPrimary(photo)}
                        >
                          대표로 지정
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void onDelete(photo)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        loading={busy}
        disabled={photos.length >= MAX_PHOTOS}
        onClick={() => pickFile(null)}
      >
        {photos.length >= MAX_PHOTOS ? "최대 6장까지 올릴 수 있어요" : "사진 추가"}
      </Button>
    </div>
  );
}
