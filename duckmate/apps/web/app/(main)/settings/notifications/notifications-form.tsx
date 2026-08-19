"use client";

// =============================================================================
// E4 · 알림 설정 (client) — notification_prefs + 브라우저 푸시 구독
//
// 규약:
// - 브라우저 알림 권한 허용 ≠ 광고성 수신동의. 동의는 아래 별도 토글만으로 수집한다
//   (B1 §6-③). 동의/철회 시각은 서버 트리거가 기록한다.
// - 안전·법적 고지 알림은 이 토글과 무관하게 발송됨을 화면에 명시한다.
// - 권한 거부 상태에서 재요청 팝업을 띄우지 않는다 (D7 subscribe.ts 규약 2).
// =============================================================================

import * as React from "react";
import { Button, Card, CardContent } from "@duckmate/ui";
import { saveNotificationPrefs } from "@/lib/notifications/actions";
import type { NotificationPrefs } from "@/lib/notifications/schemas";
import {
  getPushPermission,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/notifications/subscribe";

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <span className="flex flex-col gap-1">
        <span className="text-body">{label}</span>
        <span className="text-caption text-ink-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-current text-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function NotificationsForm({ initial }: { initial: NotificationPrefs }) {
  const [prefs, setPrefs] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const [permission, setPermission] = React.useState<string>("default");
  const [subscribed, setSubscribed] = React.useState(false);
  const [pushBusy, setPushBusy] = React.useState(false);
  const [pushNotice, setPushNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPermission(getPushPermission());
    void isPushSubscribed().then(setSubscribed);
  }, []);

  const update = (patch: Partial<NotificationPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const save = async () => {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await saveNotificationPrefs({
      channelDaily: prefs.channelDaily,
      channelEvent: prefs.channelEvent,
      channelReminder: prefs.channelReminder,
      marketingConsent: prefs.marketingConsent,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaved(true);
  };

  const togglePush = async () => {
    setPushBusy(true);
    setPushNotice(null);
    if (subscribed) {
      const result = await unsubscribeFromPush();
      setSubscribed(false);
      if (!result.ok) setPushNotice(result.message ?? "구독 해제에 실패했어요.");
      else setPushNotice("이 브라우저에서는 알림을 받지 않아요.");
    } else {
      const result = await subscribeToPush();
      if (result.status === "subscribed") {
        setSubscribed(true);
        setPushNotice("이 브라우저에서 알림을 받아요.");
      } else if (result.status === "denied") {
        setPushNotice("브라우저 설정에서 알림을 '허용'으로 바꾸면 받을 수 있어요.");
      } else if (result.status === "unsupported") {
        setPushNotice("이 브라우저는 웹 알림을 지원하지 않아요.");
      } else if (result.status === "error") {
        setPushNotice(result.message);
      }
      setPermission(getPushPermission());
    }
    setPushBusy(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="py-2">
          <Toggle
            label="매칭·메시지 알림"
            description="매칭 성사, 새 메시지, 받은 좋아요처럼 내가 기다리는 소식"
            checked={prefs.channelEvent}
            onChange={(v) => update({ channelEvent: v })}
          />
          <Toggle
            label="오늘의 추천 알림"
            description="매일 새 추천이 준비되면 알려드려요"
            checked={prefs.channelDaily}
            onChange={(v) => update({ channelDaily: v })}
          />
          <Toggle
            label="대화 이어가기 알림"
            description="답장이 끊긴 대화를 가볍게 상기시켜 드려요"
            checked={prefs.channelReminder}
            onChange={(v) => update({ channelReminder: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-2">
          <Toggle
            label="광고성 정보 수신 동의 (선택)"
            description="이벤트·혜택 안내. 동의하지 않아도 서비스 이용에는 제한이 없어요. 밤 9시~아침 8시에는 보내지 않아요."
            checked={prefs.marketingConsent}
            onChange={(v) => update({ marketingConsent: v })}
          />
          {prefs.marketingConsentAt && (
            <p className="pb-3 text-caption text-ink-muted">
              최근 동의/철회 처리 시각: {new Date(prefs.marketingConsentAt).toLocaleString("ko-KR")}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-caption text-ink-muted">
        신고 처리 결과, 제재 통보, 약관 변경 같은 안전·법적 고지는 위 설정과 관계없이 보내드려요.
      </p>

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-body-sm text-success">
          알림 설정을 저장했어요.
        </p>
      )}

      <Button size="lg" loading={pending} onClick={() => void save()}>
        저장
      </Button>

      <section className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-h3">이 브라우저에서 알림 받기</h2>
        <p className="text-body-sm text-ink-muted">
          {permission === "denied"
            ? "브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 '허용'으로 바꾸면 받을 수 있어요."
            : subscribed
              ? "이 브라우저는 알림을 받도록 등록돼 있어요."
              : "위 설정을 켜도 브라우저 알림 등록이 있어야 푸시가 도착해요."}
        </p>
        <div>
          <Button
            variant="ghost"
            loading={pushBusy}
            disabled={permission === "denied"}
            onClick={() => void togglePush()}
          >
            {subscribed ? "이 브라우저 알림 끄기" : "이 브라우저 알림 켜기"}
          </Button>
        </div>
        {pushNotice && (
          <p role="status" className="text-body-sm text-ink-muted">
            {pushNotice}
          </p>
        )}
      </section>
    </div>
  );
}
