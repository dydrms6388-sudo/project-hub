"use client";

import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { forwardRef, useImperativeHandle } from "react";
import { AvailabilityBadge, PresenceDot } from "@/components/profile/badges";
import { ProfilePhoto } from "@/components/profile/photo";
import { bodySummary, regionLabel } from "@/lib/domain/format";
import { INTERESTS, labelOf } from "@/lib/domain/options";
import type { ProfileCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SwipeDir = "like" | "pass";
export type SwipeCardHandle = { fling: (dir: SwipeDir) => void };

const THRESHOLD = 110;
const VELOCITY = 600;

export function CardFace({ p }: { p: ProfileCard }) {
  const summary = bodySummary(p);
  return (
    <>
      <ProfilePhoto
        photoId={p.primary_photo_id}
        name={p.nickname}
        seed={p.id}
        priority
        className="absolute inset-0 size-full text-7xl"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <div className="absolute top-3 left-3">
        <AvailabilityBadge availability={p.availability} className="px-2.5 py-1 text-xs" />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5">
        <div className="flex items-center gap-2">
          <PresenceDot presence={p.presence} />
          <p className="text-[26px] leading-tight font-extrabold text-white">
            {p.nickname} <span className="font-semibold text-white/85">{p.age}</span>
          </p>
        </div>
        <p className="text-sm text-white/80">
          {regionLabel(p)}
          {summary && ` · ${summary}`}
        </p>
        {p.interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {p.interests.slice(0, 4).map((i) => (
              <span
                key={i}
                className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur"
              >
                {labelOf(INTERESTS, i as never)}
              </span>
            ))}
          </div>
        )}
        {p.bio && <p className="line-clamp-2 pt-1 text-sm text-white/80">{p.bio}</p>}
      </div>
    </>
  );
}

/** 맨 위 카드: 드래그 + 버튼/키보드로 날리기 */
export const SwipeCard = forwardRef<SwipeCardHandle, { p: ProfileCard; onSwiped: (dir: SwipeDir) => void }>(
  function SwipeCard({ p, onSwiped }, ref) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 0, 300], [-14, 0, 14]);
    const likeOpacity = useTransform(x, [20, THRESHOLD], [0, 1]);
    const passOpacity = useTransform(x, [-THRESHOLD, -20], [1, 0]);

    const fling = (dir: SwipeDir) => {
      const w = typeof window !== "undefined" ? window.innerWidth : 600;
      animate(x, dir === "like" ? w * 1.2 : -w * 1.2, { duration: 0.28, ease: "easeIn" }).then(() => onSwiped(dir));
    };
    useImperativeHandle(ref, () => ({ fling }));

    const onDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.x > THRESHOLD || info.velocity.x > VELOCITY) return fling("like");
      if (info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY) return fling("pass");
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    };

    return (
      <motion.div
        className="bg-card absolute inset-0 cursor-grab touch-pan-y overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10 active:cursor-grabbing"
        style={{ x, rotate }}
        drag="x"
        dragElastic={0.9}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={onDragEnd}
        initial={{ scale: 0.95, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        data-testid="swipe-card"
        data-profile-id={p.id}
        aria-label={`${p.nickname}, ${p.age}세`}
      >
        <CardFace p={p} />
        <Stamp
          label="LIKE"
          style={{ opacity: likeOpacity }}
          className="border-success text-success left-5 -rotate-12"
        />
        <Stamp
          label="PASS"
          style={{ opacity: passOpacity }}
          className="border-destructive text-destructive right-5 rotate-12"
        />
      </motion.div>
    );
  },
);

function Stamp({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style: React.ComponentProps<typeof motion.span>["style"];
}) {
  return (
    <motion.span
      aria-hidden
      style={style}
      className={cn(
        "pointer-events-none absolute top-8 rounded-xl border-4 px-3 py-1 text-3xl font-black tracking-widest",
        className,
      )}
    >
      {label}
    </motion.span>
  );
}
