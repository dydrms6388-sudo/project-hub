"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { ProfilePhoto } from "@/components/profile/photo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ProfileCard } from "@/lib/types";

export function MatchDialog({ profile, onClose }: { profile: ProfileCard | null; onClose: () => void }) {
  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm overflow-hidden rounded-3xl border-white/10 bg-popover p-0 text-center"
        data-testid="match-dialog"
      >
        {profile && (
          <div className="relative px-6 pt-8 pb-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-brand opacity-25 blur-3xl" aria-hidden />
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative mx-auto mb-4 size-28 overflow-hidden rounded-full ring-4 ring-primary/60"
            >
              <ProfilePhoto photoId={profile.primary_photo_id} name={profile.nickname} seed={profile.id} className="size-full" />
            </motion.div>
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="relative"
            >
              <Heart className="mx-auto mb-2 size-7 fill-accent text-accent" />
              <DialogTitle className="text-2xl font-extrabold">
                <span className="text-brand">서로 좋아요!</span> 매칭됐어요
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm">
                {profile.nickname}님과 매칭됐어요. 상대가 매칭 상대에게만 공개한 연락 방법을 이제 볼 수 있어요.
              </DialogDescription>
            </motion.div>
            <div className="relative mt-6 grid gap-2">
              <Button asChild className="h-12 rounded-xl bg-brand text-base font-semibold text-white hover:opacity-90">
                <Link href={`/p/${profile.id}`}>프로필·연락 방법 보기</Link>
              </Button>
              <Button variant="ghost" className="h-11 rounded-xl" onClick={onClose} data-testid="match-continue">
                계속 스와이프
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
