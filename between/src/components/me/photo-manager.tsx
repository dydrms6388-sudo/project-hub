"use client";

import { Eye, Loader2, Lock, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deletePhotoAction, makePrimaryPhotoAction, setPhotoVisibilityAction } from "@/app/actions/profile";
import { ProfilePhoto } from "@/components/profile/photo";
import type { Photo } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoManager({ photos, nickname }: { photos: Photo[]; nickname: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) return toast.error("JPG, PNG, WEBP 사진만 올릴 수 있어요.");
    if (file.size > MAX_BYTES) return toast.error("사진은 10MB 이하만 올릴 수 있어요.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/photos", { method: "POST", body: fd, credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "업로드에 실패했어요.");
        return;
      }
      toast.success("사진을 올렸어요.");
      router.refresh();
    } catch {
      toast.error("네트워크 오류로 업로드하지 못했어요.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function act(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setBusyId(id);
    start(async () => {
      const r = await fn();
      setBusyId(null);
      if (!r.ok) return void toast.error(r.error ?? "실패했어요.");
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2" data-testid="photo-list">
        {photos.map((p, i) => (
          <li
            key={p.id}
            className="bg-secondary relative aspect-[3/4] overflow-hidden rounded-xl"
            data-testid="my-photo"
          >
            <ProfilePhoto photoId={p.id} name={nickname} seed={p.id} className="absolute inset-0 size-full" />
            {busyId === p.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            {i === 0 && (
              <span className="bg-brand absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
                대표
              </span>
            )}
            {p.visibility === "matches" && (
              <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                <Lock className="size-3" /> 매칭만
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-around bg-gradient-to-t from-black/80 to-transparent pt-4 pb-1">
              {i !== 0 && (
                <IconBtn
                  label="대표로 설정"
                  onClick={() => act(p.id, () => makePrimaryPhotoAction(p.id), "대표 사진을 바꿨어요.")}
                >
                  <Star className="size-4" />
                </IconBtn>
              )}
              <IconBtn
                label={p.visibility === "public" ? "매칭 상대만 보기로 변경" : "전체 공개로 변경"}
                onClick={() =>
                  act(
                    p.id,
                    () => setPhotoVisibilityAction(p.id, p.visibility === "public" ? "matches" : "public"),
                    p.visibility === "public" ? "매칭 상대에게만 보여요." : "전체 공개로 바꿨어요.",
                  )
                }
              >
                {p.visibility === "public" ? <Eye className="size-4" /> : <Lock className="size-4" />}
              </IconBtn>
              <IconBtn
                label="사진 삭제"
                onClick={() => {
                  if (confirm("이 사진을 삭제할까요?")) act(p.id, () => deletePhotoAction(p.id), "사진을 삭제했어요.");
                }}
              >
                <Trash2 className="size-4" />
              </IconBtn>
            </div>
          </li>
        ))}
        {photos.length < MAX && (
          <li className="aspect-[3/4]">
            <label
              className={cn(
                "text-muted-foreground hover:border-primary hover:text-foreground flex size-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/15 transition-colors",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? <Loader2 className="size-6 animate-spin" /> : <Plus className="size-6" />}
              <span className="text-xs">{uploading ? "올리는 중…" : `사진 추가 (${photos.length}/${MAX})`}</span>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                data-testid="photo-upload-input"
                aria-label="사진 추가"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        업로드한 사진은 위치정보(EXIF)를 지우고 다시 저장돼요. 얼굴 사진이 아니어도 괜찮아요. 타인의 사진·노출 사진은
        제재 대상이에요.
      </p>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 active:scale-90"
    >
      {children}
    </button>
  );
}
