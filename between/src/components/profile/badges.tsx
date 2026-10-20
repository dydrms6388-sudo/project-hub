import { Zap } from "lucide-react";
import type { ProfileCard } from "@/lib/types";
import { availabilityLabel, presenceLabel } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

export function PresenceDot({ presence, className }: { presence: ProfileCard["presence"]; className?: string }) {
  if (presence === "away" || presence === "week") return null;
  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-full ring-2 ring-black/40",
        presence === "online" ? "bg-success" : "bg-amber-400",
        className,
      )}
      aria-label={presenceLabel(presence)}
      title={presenceLabel(presence)}
    />
  );
}

export function AvailabilityBadge({
  availability,
  className,
}: {
  availability: ProfileCard["availability"];
  className?: string;
}) {
  if (availability === "off") return null;
  const now = availability === "now";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        now ? "bg-brand text-white shadow-lg shadow-accent/30" : "bg-black/50 text-white/90 backdrop-blur",
        className,
      )}
    >
      {now && <Zap className="size-3 fill-current" />}
      {availabilityLabel(availability)}
    </span>
  );
}
