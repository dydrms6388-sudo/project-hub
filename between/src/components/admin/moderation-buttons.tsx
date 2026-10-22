"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { moderateAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { action: "dismiss_report", label: "기각", hours: null, variant: "ghost" },
  { action: "warn", label: "경고", hours: null, variant: "secondary" },
  { action: "hide_profile", label: "프로필 숨김", hours: null, variant: "secondary" },
  { action: "suspend", label: "24시간 정지", hours: 24, variant: "secondary" },
  { action: "suspend", label: "7일 정지", hours: 168, variant: "secondary" },
  { action: "ban", label: "영구 이용제한", hours: null, variant: "destructive" },
] as const;

export function ModerationButtons({ target, reportId }: { target: string; reportId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <Button
          key={a.label}
          size="sm"
          variant={a.variant}
          disabled={pending}
          data-testid={`mod-${a.action}${a.hours ? `-${a.hours}` : ""}`}
          onClick={() =>
            start(async () => {
              if (a.action === "ban" && !window.confirm("영구 이용제한할까요?")) return;
              const r = await moderateAction({ target, action: a.action, hours: a.hours, reportId, reason: a.label });
              if (!r.ok) return void toast.error(r.error);
              toast.success(`${a.label} 처리했어요.`);
              router.refresh();
            })
          }
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
