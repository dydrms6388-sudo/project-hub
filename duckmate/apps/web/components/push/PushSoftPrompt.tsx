"use client";

/**
 * 푸시 권한 소프트 프롬프트 (20_notifications §0-4, 10_brand #34) — H2.
 *
 *  - 브라우저 권한 프롬프트는 **[알림 켜기] 클릭 핸들러 안에서만** 호출한다(`enablePush()`).
 *  - 노출 조건: 지원 브라우저 + `Notification.permission === "default"` + VAPID 공개키 있음 + 30일 쿨다운 경과 + loop_date 당 1회.
 *  - 순서: 첫 매칭 성공 후 `/match/[id]` 에서 설명 카드 → 사용자가 눌러야 권한 요청. 홈은 보완 노출(같은 컴포넌트·같은 스토어).
 *  - [다음에] → `usePushStore.dismissBanner(loopDate)`(localStorage 보존) → 30일간 재노출 없음. `denied` 면 영구 미노출(인앱 배너만).
 */
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { loopDate } from "@duckmate/db";
import { Button, useToast } from "@duckmate/ui";
import { track } from "@/lib/analytics/track";
import { enablePush, getPermissionState, markPermissionBannerShown, shouldShowPermissionBanner, vapidPublicKeyFromEnv } from "@/lib/push/client";
import { subscribePush } from "@/lib/push/actions";
import { NOTIFY_COPY } from "@/components/settings/copy";
import { pushPromptCooledDown, usePushStore } from "@/stores/push";

export const PUSH_PROMPT_COPY = {
  title: "새 추천이 오면 알려드릴까요?",
  body: "하루 최대 2번, 밤에는 보내지 않아요.",
  enable: "알림 켜기",
  later: "다음에",
} as const;

export function PushSoftPrompt({ surface, className }: { surface: "match" | "home"; className?: string }) {
  const { toast } = useToast();
  const permission = usePushStore((s) => s.permission);
  const subscribed = usePushStore((s) => s.subscribed);
  const dismissedLoopDate = usePushStore((s) => s.bannerDismissedLoopDate);
  const setPermission = usePushStore((s) => s.setPermission);
  const setSubscribed = usePushStore((s) => s.setSubscribed);
  const dismissBanner = usePushStore((s) => s.dismissBanner);

  const [today, setToday] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);

  // 브라우저 API 는 마운트 후에만 (SSR/hydration 안전)
  useEffect(() => {
    const ld = loopDate();
    setToday(ld);
    const p = getPermissionState();
    setPermission(p);
    if (p !== "default" || !vapidPublicKeyFromEnv()) return;
    if (!shouldShowPermissionBanner(ld)) return; // loop_date 당 1회
    setEligible(true);
    markPermissionBannerShown(ld);
  }, [setPermission]);

  const cooled = pushPromptCooledDown(dismissedLoopDate, today ?? "");
  if (!eligible || !today || !cooled || subscribed || permission === "denied" || permission === "granted") return null;

  const enable = async () => {
    setBusy(true);
    track("push_permission_prompted", { surface, attempt_no: 1 });
    const r = await enablePush();
    setPermission(r.status);
    if (r.status !== "granted" || !r.subscription) {
      setBusy(false);
      if (r.status === "denied") toast({ title: NOTIFY_COPY.denied });
      else if (r.reason === "no_vapid_key") toast({ title: NOTIFY_COPY.noVapid });
      dismissBanner(today);
      return;
    }
    track("push_permission_granted", { surface });
    const s = await subscribePush({ subscription: r.subscription, userAgent: navigator.userAgent.slice(0, 300) });
    setBusy(false);
    if (!s.ok) {
      toast({ title: s.message, variant: "error" });
      return;
    }
    setSubscribed(true);
    dismissBanner(today);
    toast({ title: "알림을 켰어요", variant: "success" });
  };

  const later = () => {
    dismissBanner(today);
    setEligible(false);
  };

  return (
    <section className={className} aria-labelledby="push-prompt-title" data-testid="push-soft-prompt">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <BellRing size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p id="push-prompt-title" className="text-label text-foreground">
            {PUSH_PROMPT_COPY.title}
          </p>
          <p className="text-body-sm mt-0.5 text-muted-foreground">{PUSH_PROMPT_COPY.body}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void enable()} loading={busy} data-testid="push-prompt-enable">
              {PUSH_PROMPT_COPY.enable}
            </Button>
            <Button size="sm" variant="ghost" onClick={later} disabled={busy} data-testid="push-prompt-later">
              {PUSH_PROMPT_COPY.later}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
