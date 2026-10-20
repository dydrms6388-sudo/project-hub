"use client";

import { Clock, MapPinOff, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { setActivityAction } from "@/app/actions/profile";
import { Chip } from "@/components/app/chips";
import { AVAILABILITY, NOW_DURATIONS, type Availability } from "@/lib/domain/options";
import type { ActivityStatus } from "@/lib/types";

type Hours = (typeof NOW_DURATIONS)[number]["hours"];

function remaining(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${Math.max(m, 1)}분`;
}

export function ActivitySelector({ initial }: { initial: ActivityStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Availability>(initial.status);
  const [hours, setHours] = useState<Hours>(2);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const left = initial.status === "now" ? remaining(initial.expires_at, now) : null;
  const isNow = initial.status === "now" && left !== null;

  function save(next: Availability, h: Hours | null) {
    start(async () => {
      const r = await setActivityAction({ status: next, hours: next === "now" ? h : null });
      if (!r.ok) {
        toast.error(r.error);
        setStatus(initial.status);
        return;
      }
      toast.success(next === "off" ? "상태를 비활성으로 바꿨어요." : "만남 상태를 업데이트했어요.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {isNow && (
        <div className="flex items-center gap-3 rounded-xl bg-brand p-3 text-white" data-testid="now-active">
          <Zap className="size-5 fill-current" />
          <div className="text-sm">
            <p className="font-bold">지금 만남 가능으로 표시 중</p>
            <p className="text-white/85">{left} 후 자동 해제</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="만남 상태">
        {AVAILABILITY.map((o) => (
          <Chip
            key={o.value}
            role="radio"
            aria-checked={status === o.value}
            selected={status === o.value}
            disabled={pending}
            onClick={() => {
              setStatus(o.value);
              if (o.value !== "now") save(o.value, null);
            }}
          >
            {o.value === "now" && <Zap className="size-3.5" />}
            {o.label}
          </Chip>
        ))}
      </div>

      {status === "now" && (
        <div className="space-y-2 rounded-xl bg-secondary/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Clock className="size-4 text-primary" /> 얼마 동안 표시할까요?
          </p>
          <div className="flex flex-wrap gap-2">
            {NOW_DURATIONS.map((d) => (
              <Chip key={d.hours} size="sm" selected={hours === d.hours} onClick={() => setHours(d.hours)}>
                {d.label}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => save("now", hours)}
            className="mt-1 h-10 w-full rounded-xl bg-brand text-sm font-bold text-white transition-opacity active:opacity-80 disabled:opacity-50"
            data-testid="activity-now-save"
          >
            {isNow ? "시간 다시 설정" : `${hours}시간 동안 '지금 가능' 표시`}
          </button>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPinOff className="size-3.5" /> 정확한 위치나 이동 경로는 공유되지 않아요. 설정한 시간이 지나면 자동으로 해제돼요.
      </p>
    </div>
  );
}
