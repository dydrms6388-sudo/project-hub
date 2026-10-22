import Link from "next/link";
import type { ProfileCard } from "@/lib/types";
import { bodySummary, presenceLabel } from "@/lib/domain/format";
import { AvailabilityBadge, PresenceDot } from "./badges";
import { ProfilePhoto } from "./photo";

export function ProfileGridCard({ p, priority }: { p: ProfileCard; priority?: boolean }) {
  return (
    <Link
      href={`/p/${p.id}`}
      className="group bg-card relative block aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/5 transition-transform active:scale-[0.98]"
      data-testid="profile-card"
    >
      <ProfilePhoto
        photoId={p.primary_photo_id}
        name={p.nickname}
        seed={p.id}
        priority={priority}
        className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <AvailabilityBadge availability={p.availability} />
        {p.is_new && (
          <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-black">NEW</span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <div className="flex items-center gap-1.5">
          <PresenceDot presence={p.presence} />
          <p className="truncate text-[15px] font-bold text-white">
            {p.nickname} <span className="font-medium text-white/80">{p.age}</span>
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-white/70">
          {p.sigungu ?? p.sido}
          {bodySummary(p) && ` · ${bodySummary(p)}`}
        </p>
      </div>
    </Link>
  );
}

export function ProfileListRow({ p }: { p: ProfileCard }) {
  return (
    <Link
      href={`/p/${p.id}`}
      className="bg-card hover:bg-secondary/60 flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-white/5 transition-colors"
      data-testid="profile-row"
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
        <ProfilePhoto photoId={p.primary_photo_id} name={p.nickname} seed={p.id} className="size-full text-xl" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <PresenceDot presence={p.presence} />
          <p className="truncate font-semibold">
            {p.nickname} <span className="text-muted-foreground font-normal">{p.age}</span>
          </p>
          <AvailabilityBadge availability={p.availability} className="ml-auto" />
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {[p.sido, p.sigungu].filter(Boolean).join(" ")}
          {bodySummary(p) && ` · ${bodySummary(p)}`}
        </p>
        <p className="text-muted-foreground/80 truncate text-xs">
          {presenceLabel(p.presence)}
          {p.bio ? ` · ${p.bio}` : ""}
        </p>
      </div>
    </Link>
  );
}
