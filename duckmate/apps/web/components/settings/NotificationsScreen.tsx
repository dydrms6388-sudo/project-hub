"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { Button, Label, SafetyBanner, Switch, useToast } from "@duckmate/ui";
import { enablePush, getPermissionState, unsubscribeBrowser, vapidPublicKeyFromEnv, type PermissionState } from "@/lib/push/client";
import { subscribePush, unsubscribePush, updatePushPrefs } from "@/lib/push/actions";
import type { PushPrefsView, UpdatePushPrefsInput } from "@/lib/push/schemas";
import { usePushStore } from "@/stores/push";
import { formatDateKo } from "@/components/profile/format";
import { NOTIFY_COPY } from "./copy";
import { track } from "./track";

type Props = { initial: PushPrefsView | null; loadError: string | null };

function ToggleRow({ id, label, hint, checked, onChange, disabled, testId }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; testId?: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={id} className="text-body">
          {label}
        </Label>
        {hint ? <p className="text-caption mt-0.5 text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} data-testid={testId} />
    </div>
  );
}

export function NotificationsScreen({ initial, loadError }: Props) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [prefs, setPrefs] = useState<PushPrefsView | null>(initial);
  const [perm, setPerm] = useState<PermissionState | "unknown">("unknown");
  const [quiet, setQuiet] = useState<{ start: string; end: string }>(initial?.quietHours ?? { start: "22:00", end: "08:00" });
  const setStorePerm = usePushStore((s) => s.setPermission);
  const setStoreSub = usePushStore((s) => s.setSubscribed);
  const vapid = vapidPublicKeyFromEnv();

  useEffect(() => {
    const p = getPermissionState();
    setPerm(p);
    setStorePerm(p);
    track("notification_settings_viewed", { permission: p, subscribed: Boolean(initial?.subscribed) });
  }, [initial?.subscribed, setStorePerm]);

  const apply = (patch: UpdatePushPrefsInput, okMsg = "저장했어요") =>
    start(async () => {
      const r = await updatePushPrefs(patch);
      if (!r.ok) {
        toast({ title: r.message, variant: "error" });
        return;
      }
      setPrefs(r.data);
      setStoreSub(r.data.subscribed);
      toast({ title: okMsg, variant: "success" });
    });

  /** 브라우저 프롬프트는 반드시 버튼 클릭 핸들러 안에서 (20_notifications 결정 4) */
  const enable = () =>
    start(async () => {
      track("push_permission_prompted", { attempt_no: 1, surface: "settings" });
      const r = await enablePush();
      setPerm(r.status);
      setStorePerm(r.status);
      if (r.status !== "granted" || !r.subscription) {
        if (r.status === "denied") toast({ title: NOTIFY_COPY.denied, variant: "error" });
        else if (r.reason === "no_vapid_key") toast({ title: NOTIFY_COPY.noVapid });
        else toast({ title: "알림을 켜지 못했어요. 다시 시도해 주세요", variant: "error" });
        return;
      }
      track("push_permission_granted", { surface: "settings" });
      const s = await subscribePush({ subscription: r.subscription, userAgent: navigator.userAgent.slice(0, 300) });
      if (!s.ok) {
        toast({ title: s.message, variant: "error" });
        return;
      }
      setPrefs(s.data.prefs);
      setStoreSub(true);
      toast({ title: "알림을 켰어요", variant: "success" });
    });

  const disableDevice = () =>
    start(async () => {
      const endpoint = await unsubscribeBrowser();
      if (!endpoint) {
        toast({ title: "이 기기에는 구독이 없어요" });
        return;
      }
      const r = await unsubscribePush({ endpoint });
      if (!r.ok) {
        toast({ title: r.message, variant: "error" });
        return;
      }
      setPrefs(r.data.prefs);
      setStoreSub(r.data.prefs.subscribed);
      toast({ title: "이 기기의 알림을 껐어요", variant: "success" });
    });

  const supported = perm !== "unsupported";

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-safe" data-testid="notifications-screen">
      <header className="flex h-14 items-center gap-2">
        <Link href="/settings" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <h1 className="text-h2">알림</h1>
      </header>

      {loadError ? <SafetyBanner variant="warn">{loadError}</SafetyBanner> : null}

      {/* (a) 브라우저 권한 */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-h3">브라우저 알림</h2>
        {perm === "unknown" ? (
          <p className="text-body-sm mt-1 text-muted-foreground">권한 상태를 확인하고 있어요…</p>
        ) : !supported ? (
          <p className="text-body-sm mt-1 text-muted-foreground">{NOTIFY_COPY.unsupported}</p>
        ) : perm === "denied" ? (
          <p className="text-body-sm mt-1 text-muted-foreground">{NOTIFY_COPY.denied}</p>
        ) : !vapid ? (
          <p className="text-body-sm mt-1 text-muted-foreground">{NOTIFY_COPY.noVapid}</p>
        ) : prefs?.subscribed && perm === "granted" ? (
          <div className="mt-1">
            <p className="text-body-sm text-muted-foreground">이 계정에 연결된 기기 {prefs.subscriptions.length}대에 알림을 보내요.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={disableDevice} loading={pending} data-testid="push-disable-device">
              이 기기 알림 끄기
            </Button>
          </div>
        ) : (
          <div className="mt-1">
            <p className="text-body-sm text-muted-foreground">{NOTIFY_COPY.enableHint}</p>
            <Button className="mt-3 w-full" onClick={enable} loading={pending} data-testid="push-enable">
              {NOTIFY_COPY.enable}
            </Button>
          </div>
        )}
      </section>

      {/* (b) 서비스 알림 */}
      <h2 className="text-label mt-6 px-1 text-muted-foreground">서비스 알림</h2>
      <div className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
        <ToggleRow id="svc" label="서비스 알림" hint="추천·매칭·답장 알림 전체" checked={prefs?.service ?? true} onChange={(v) => apply({ service: v })} disabled={pending || !prefs} testId="push-service" />
        <ToggleRow id="slotA" label="아침 추천 (07:30)" hint="오늘의 추천이 준비되면" checked={Boolean(prefs?.slots.slotA)} onChange={(v) => apply({ slots: { slotA: v } })} disabled={pending || !prefs || !prefs.service} testId="push-slot-a" />
        <ToggleRow id="slotB" label="저녁 알림 (1건)" hint="미확인 매칭·미답장·사진 검수 결과 중 하나" checked={Boolean(prefs?.slots.slotB)} onChange={(v) => apply({ slots: { slotB: v } })} disabled={pending || !prefs || !prefs.service} testId="push-slot-b" />
        <ToggleRow id="instant" label="매칭·메시지 즉시" checked={Boolean(prefs?.slots.instant)} onChange={(v) => apply({ slots: { instant: v } })} disabled={pending || !prefs || !prefs.service} testId="push-instant" />
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-body">방해금지 시간</p>
            {prefs?.quietHours ? (
              <button type="button" className="text-caption text-primary underline underline-offset-4" onClick={() => apply({ quiet_hours: null }, "방해금지를 해제했어요")} disabled={pending}>
                해제
              </button>
            ) : null}
          </div>
          <p className="text-caption mt-0.5 text-muted-foreground">{NOTIFY_COPY.quietSystem}</p>
          <div className="mt-2 flex items-center gap-2">
            <label className="sr-only" htmlFor="quiet-start">
              시작
            </label>
            <input id="quiet-start" type="time" value={quiet.start} onChange={(e) => setQuiet((q) => ({ ...q, start: e.target.value }))} className="tnum h-10 flex-1 rounded-md border border-input bg-card px-2 text-body" />
            <span className="text-body-sm text-muted-foreground">~</span>
            <label className="sr-only" htmlFor="quiet-end">
              끝
            </label>
            <input id="quiet-end" type="time" value={quiet.end} onChange={(e) => setQuiet((q) => ({ ...q, end: e.target.value }))} className="tnum h-10 flex-1 rounded-md border border-input bg-card px-2 text-body" />
            <Button size="sm" variant="outline" onClick={() => apply({ quiet_hours: quiet }, "방해금지 시간을 저장했어요")} disabled={pending || !prefs || quiet.start === quiet.end} data-testid="push-quiet-save">
              적용
            </Button>
          </div>
          {prefs?.quietHours ? (
            <p className="tnum text-caption mt-1 text-muted-foreground">
              지금: {prefs.quietHours.start}~{prefs.quietHours.end} (KST)
            </p>
          ) : null}
        </div>
      </div>

      {/* (c) 마케팅 수신 — consents 새 행. 권한 허용 ≠ 마케팅 동의 */}
      <h2 className="text-label mt-6 px-1 text-muted-foreground">마케팅 수신</h2>
      <div className="mt-2 rounded-lg border border-border bg-card">
        <ToggleRow
          id="marketing"
          label="이벤트·혜택 알림 (광고)"
          hint={prefs?.marketing.agreed && prefs.marketing.agreedAt ? `동의일 ${formatDateKo(prefs.marketing.agreedAt)}${prefs.marketing.recheckDueAt ? ` · 다음 확인 ${formatDateKo(prefs.marketing.recheckDueAt)}` : ""}` : NOTIFY_COPY.marketingRecheck}
          checked={Boolean(prefs?.marketing.agreed)}
          onChange={(v) => apply({ marketing: v }, v ? "마케팅 수신에 동의했어요" : "마케팅 수신을 철회했어요")}
          disabled={pending || !prefs}
          testId="push-marketing"
        />
        <p className="text-caption border-t border-border px-4 py-3 text-muted-foreground">{NOTIFY_COPY.marketingConsent}</p>
      </div>
    </div>
  );
}
