"use client";

import { Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { swipeAction } from "@/app/actions/social";

export function LikeBackButton({ targetId, nickname }: { targetId: string; nickname: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`${nickname}님에게 좋아요`}
      disabled={pending}
      data-testid="like-back"
      onClick={() =>
        start(async () => {
          const r = await swipeAction({ targetId, kind: "like" });
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.data.matched ? `${nickname}님과 매칭됐어요!` : "좋아요를 보냈어요.");
          router.refresh();
        })
      }
      className="bg-brand shadow-accent/30 flex size-11 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-90"
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Heart className="size-5 fill-current" />}
    </button>
  );
}
